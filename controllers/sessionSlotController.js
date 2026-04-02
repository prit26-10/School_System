const { redisClient } = require("../config/redis");
const moment = require("moment-timezone");
const SessionSlot = require("../models/SessionSlot");
const TeacherAvailability = require("../models/TeacherAvailability");
const User = require("../models/User");
const generateAvailableSlots = require("../utils/generateAvailableSlots");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../config/emailTemplates");


exports.createSessionSlots = async (req, res) => {
  try {
    const {
      title,
      date,
      sessionDuration,
      breakDuration,
      studentSelectionType,
      student_id
    } = req.body;

    const teacherId = req.user.id;
    const teacherTimezone = req.user.timezone || "Asia/Kolkata";

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: "Title and date are required"
      });
    }

    const sanitizedTitle = title.trim().replace(/[<>]/g, "");
    const parsedDate = moment(date, "DD-MM-YYYY", true);

    if (!parsedDate.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use DD-MM-YYYY"
      });
    }

    const sessionDate = parsedDate.startOf("day").toDate();

    const duplicateSession = await SessionSlot.findOne({
      teacherId,
      title: sanitizedTitle,
      date: sessionDate
    });

    if (duplicateSession) {
      return res.status(409).json({
        success: false,
        message: "Session with same title already exists on this date"
      });
    }

    const availability = await TeacherAvailability.findOne({ teacherId });
    if (!availability) {
      return res.status(400).json({
        success: false,
        message: "Please set your weekly availability first"
      });
    }

    const isHoliday = availability.holidays.some(h =>
      parsedDate.isBetween(
        moment(h.startDate).startOf("day"),
        moment(h.endDate).endOf("day"),
        null,
        "[]"
      )
    );

    if (isHoliday) {
      return res.status(400).json({
        success: false,
        message: "Cannot create sessions on holidays"
      });
    }

    const dayOfWeek = parsedDate.format("dddd").toLowerCase();
    const dayAvailability = availability.weeklyAvailability.find(
      d => d.day.toLowerCase() === dayOfWeek
    );

    if (
      !dayAvailability ||
      !dayAvailability.startTime ||
      !dayAvailability.endTime ||
      (dayAvailability.startTime === "00:00" &&
        dayAvailability.endTime === "00:00")
    ) {
      return res.status(400).json({
        success: false,
        message: `Teacher is not available on ${parsedDate.format("dddd")}`
      });
    }

    /* Student validation */
    let allowedStudentId = null;
    let selectedStudent = null;

    if (studentSelectionType === "particular" && student_id) {
      selectedStudent = await User.findOne({
        _id: student_id,
        teacherId
      });

      if (!selectedStudent) {
        return res.status(403).json({
          success: false,
          message: "Invalid student for this teacher"
        });
      }

      allowedStudentId = selectedStudent._id;
    }

    /* Prevent duplicate personal/common session */
    const existingSession = await SessionSlot.findOne({
      teacherId,
      date: sessionDate,
      allowedStudentId: studentSelectionType === "particular" ? student_id : null
    });

    if (existingSession) {
      return res.status(409).json({
        success: false,
        message: "Session already exists for this date"
      });
    }

    /* Create session */
    const session = await SessionSlot.create({
      teacherId,
      title: sanitizedTitle,
      date: sessionDate,
      sessionDuration: Math.max(15, Math.min(240, Number(sessionDuration) || 60)),
      breakDuration: Math.max(0, Math.min(60, Number(breakDuration) || 10)),
      allowedStudentId
    });

    /* Generate slots */
    const slots = await generateAvailableSlots(
      {
        date: sessionDate,
        availability: dayAvailability,
        sessionId: session._id,
        teacherId
      },
      {
        Duration: session.sessionDuration,
        breakDuration: session.breakDuration,
        teacherTimezone
      },
      []
    );

    if (!slots.length) {
      await SessionSlot.findByIdAndDelete(session._id);
      return res.status(400).json({
        success: false,
        message: "No slots can be generated within availability"
      });
    }

    /* Cache clear */
    if (redisClient?.isOpen) {
      const keys = await redisClient.keys(`teacher:${teacherId}:sessions:*`);
      if (keys.length) await redisClient.del(keys);
    }

    /* 📧 SEND EMAIL (ONLY FOR PERSONAL SESSION) */
    // if (selectedStudent) {
    //   setImmediate(async () => {
    //     try {
    //       await sendEmail({
    //         to: selectedStudent.email,
    //         subject: emailTemplates.personal_session_created.subject,
    //         html: emailTemplates.personal_session_created.html(
    //           selectedStudent.name,
    //           sanitizedTitle,
    //           parsedDate.format("DD-MM-YYYY"),
    //           session.sessionDuration,
    //           slots.length
    //         )
    //       });
    //     } catch (mailErr) {
    //       console.error("Mailtrap email failed:", mailErr.message);
    //     }
    //   });
    // }

    /* Success */
    return res.status(201).json({
      success: true,
      message: "Session slots created successfully",
      data: {
        sessionId: session._id,
        title: session.title,
        date: parsedDate.format("DD-MM-YYYY"),
        day: parsedDate.format("dddd"),
        sessionType: allowedStudentId ? "personal" : "common",
        sessionDuration: session.sessionDuration,
        breakDuration: session.breakDuration,
        totalSlots: slots.length,
        slots,
        bookedSlots: []
      }
    });

  } catch (err) {
    console.error("createSessionSlots error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating session slots"
    });
  }
};

exports.getMySessionSlots = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });

    const studentTimezone =
      student.timezone || student[" timezone"] || "Asia/Kolkata";

    const teacher = await User.findById(student.teacherId).lean();
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const teacherTZ = teacher.timezone || "Asia/Kolkata";

    const sessions = await SessionSlot.find({
      teacherId: student.teacherId,
      $or: [{ allowedStudentId: null }, { allowedStudentId: student._id }]
    })
      .sort({ date: 1 })
      .lean();

    const availability = await TeacherAvailability.findOne({
      teacherId: student.teacherId
    }).lean();

    if (!availability) {
      return res.status(404).json({ message: "Teacher availability not found" });
    }

    const response = [];

    for (const session of sessions) {
      // ✅ day based on TEACHER timezone
      const day = moment(session.date).tz(teacherTZ).format("dddd").toLowerCase();

      const dayAvailability = availability.weeklyAvailability.find(d => d.day === day);
      if (!dayAvailability) continue;

      // ✅ 1) Available slots returned from generator (already removes booked)
      const availableSlotsRaw = await generateAvailableSlots(
        {
          date: session.date,
          availability: dayAvailability,
          sessionId: session._id,
          teacherId: teacher._id,
          studentId: student._id
        },
        {
          Duration: session.sessionDuration,
          breakDuration: session.breakDuration,
          teacherTimezone: teacherTZ,
          studentTimezone: studentTimezone
        },
        session.bookedSlots || []
      );

      // ✅ 2) My booked slots (same position ma show karva mate slots array ma merge karvana)
      const myBookedSlots = (session.bookedSlots || [])
        .filter(b => String(b.bookedBy) === String(student._id))
        .map(b => {
          // Normalize to start of minute to ensure consistency with available slots
          const startTimeUTC = moment(b.startTime).utc().startOf('minute').toISOString();
          const endTimeUTC = moment(b.endTime).utc().startOf('minute').toISOString();
          
          return {
            startTime: moment(b.startTime).tz(studentTimezone).format("HH:mm"),
            endTime: moment(b.endTime).tz(studentTimezone).format("HH:mm"),
            startTimeUTC: startTimeUTC,
            endTimeUTC: endTimeUTC,
            isBooked: true,
            isBookedByMe: true
          };
        });

      // ✅ 3) Remove past slots (student timezone)
      const nowStudent = moment().tz(studentTimezone);

      const availableSlots = (availableSlotsRaw || [])
        .filter(slot => {
          const slotStartStudent = moment.utc(slot.startTimeUTC).tz(studentTimezone);
          return slotStartStudent.isAfter(nowStudent);
        })
        .map(slot => {
          // Normalize to start of minute to ensure consistency with booked slots
          const startTimeUTC = moment.utc(slot.startTimeUTC).startOf('minute').toISOString();
          const endTimeUTC = moment.utc(slot.endTimeUTC).startOf('minute').toISOString();
          
          return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            startTimeUTC: startTimeUTC,
            endTimeUTC: endTimeUTC,
            isBooked: false,
            isBookedByMe: false
          };
        });

      // ✅ 4) Merge both in ONE ARRAY (same place, no extra row)
      const finalMap = new Map();

      // ✅ add available first
      availableSlots.forEach(s => {
        finalMap.set(s.startTimeUTC, s);
      });

      // ✅ overwrite with booked (GREEN)
      myBookedSlots.forEach(s => {
        finalMap.set(s.startTimeUTC, s);
      });

      // ✅ 5) Sort using UTC time (perfect order including 23:40-00:40 etc)
      const slots = Array.from(finalMap.values()).sort((a, b) => {
        return moment.utc(a.startTimeUTC).valueOf() - moment.utc(b.startTimeUTC).valueOf();
      });

      response.push({
        sessionId: session._id,
        title: session.title,
        sessionType: session.allowedStudentId ? "personal" : "common",
        date: moment(session.date).tz(studentTimezone).format("DD-MM-YYYY / dddd"),
        teacherName: teacher.name,
        duration: session.sessionDuration,
        slots
      });
    }

    return res.json({
      pagination: { page: 1, limit: 10, count: response.length },

      meta: {
        teacherName: teacher.name,
        studentTimezone: studentTimezone
      },

      sessions: response
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.confirmSessionSlot = async (req, res) => {
  let lockKey;

  try {
    const { sessionId, startTimeUTC, endTimeUTC } = req.body;
    const studentId = req.user.id;

    if (!sessionId || !startTimeUTC || !endTimeUTC) {
      return res.status(400).json({
        message: "sessionId, startTimeUTC, endTimeUTC are required"
      });
    }

    const student = await User.findById(studentId).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });

    const studentTZ = student.timezone || "Asia/Kolkata";

    const session = await SessionSlot.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (String(session.teacherId) !== String(student.teacherId)) {
      return res.status(403).json({ message: "Not allowed to book this session" });
    }

    if (
      session.allowedStudentId &&
      String(session.allowedStudentId) !== String(studentId)
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const startUTC = moment.utc(startTimeUTC);
    const endUTC = moment.utc(endTimeUTC);

    if (!startUTC.isValid() || !endUTC.isValid()) {
      return res.status(400).json({ message: "Invalid UTC time format" });
    }

    if (!endUTC.isAfter(startUTC)) {
      return res.status(400).json({ message: "Invalid slot duration" });
    }

    lockKey = `lock:session:${sessionId}:slot:${startUTC.toISOString()}`;

    if (redisClient?.isOpen) {
      const lock = await redisClient.set(lockKey, "locked", {
        NX: true,
        EX: 10
      });

      if (!lock) {
        return res.status(409).json({
          message: "Slot is being booked by another student. Try again."
        });
      }
    }

    const overlap = (session.bookedSlots || []).some(b =>
      startUTC.isBefore(moment(b.endTime)) &&
      endUTC.isAfter(moment(b.startTime))
    );

    if (overlap) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    session.bookedSlots.push({
      startTime: startUTC.toDate(),
      endTime: endUTC.toDate(),
      bookedBy: studentId
    });

    await session.save();

    // ✅ Clear caches
    if (redisClient?.isOpen) {
      const keys = [
        ...(await redisClient.keys(`slots:teacher:${session.teacherId}:${session._id}:*`)),
        ...(await redisClient.keys(`slots:student:*:${session._id}:*`)),
        ...(await redisClient.keys(`slots:student:${studentId}:${session._id}:*`)),
        ...(await redisClient.keys(`teacher:${session.teacherId}:sessions:*`)),
        ...(await redisClient.keys(`student:${studentId}:sessions:*`))
      ];


      if (keys.length > 0) await redisClient.del(keys);
    }

    return res.json({
      message: "Slot booked successfully",
      booking: {
        sessionId: session._id,
        date: startUTC.clone().tz(studentTZ).format("DD-MM-YYYY"),
        startTime: startUTC.clone().tz(studentTZ).format("HH:mm"),
        endTime: endUTC.clone().tz(studentTZ).format("HH:mm")
      }
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  } finally {
    if (redisClient?.isOpen && lockKey) {
      await redisClient.del(lockKey);
    }
  }
};

exports.getMyConfirmedSessions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const timezone = student.timezone || "Asia/Kolkata";

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `student:${studentId}:confirmed-sessions:page:${page}:limit:${limit}`;

    // 🔴 1️⃣ TRY REDIS FIRST
    if (redisClient?.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    // 🔴 2️⃣ DATABASE FETCH (UNCHANGED LOGIC)
    const sessions = await SessionSlot.find({
      "bookedSlots.bookedBy": studentId
    })
      .populate("teacherId", "name userId")
      .lean();

    const bookedSlots = [];

    for (const session of sessions) {
      for (const slot of session.bookedSlots) {
        if (String(slot.bookedBy) === String(studentId)) {
          bookedSlots.push({
            sessionId: session._id,
            title: session.title,
            teacherName: session.teacherId.name,
            startTime: slot.startTime,
            endTime: slot.endTime
          });
        }
      }
    }

    const totalSessions = bookedSlots.length;
    const paginatedSlots = bookedSlots.slice(skip, skip + limit);

    const formattedSessions = paginatedSlots.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      teacherName: s.teacherName,
      date: moment(s.startTime).tz(timezone).format("DD-MM-YYYY"),
      startTime: moment(s.startTime).tz(timezone).format("HH:mm"),
      endTime: moment(s.endTime).tz(timezone).format("HH:mm")
    }));

    const finalResponse = {
      pagination: {
        totalSessions,
        currentPage: page,
        totalPages: Math.ceil(totalSessions / limit),
        limit
      },
      sessions: formattedSessions
    };

    // 🔴 3️⃣ SAVE TO REDIS (TTL = 60s)
    if (redisClient?.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(finalResponse));
    }

    res.json(finalResponse);

  } catch (error) {
    console.error('Error in getMyConfirmedSessions:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getTeacherSessions = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const teacherUser = await User.findById(teacherId).lean();
    const teacherTZ = teacherUser?.timezone || "Asia/Kolkata";

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const type = req.query.type || "all";

    const query = { teacherId };
    if (type === "personal") query.allowedStudentId = { $ne: null };
    if (type === "common") query.allowedStudentId = null;

    const totalSessions = await SessionSlot.countDocuments(query);

    const sessions = await SessionSlot.find(query)
      .populate("allowedStudentId", "name email userId")
      .populate({
        path: "bookedSlots.bookedBy",
        select: "name email"
      })
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const teacherAvailability = await TeacherAvailability.findOne({ teacherId }).lean();

    const formattedSessions = await Promise.all(
      sessions.map(async (s) => {
        const dayOfWeek = moment(s.date).tz(teacherTZ).format("dddd").toLowerCase();

        const weeklyDay = teacherAvailability?.weeklyAvailability?.find(
          d => d.day?.toLowerCase() === dayOfWeek && d.isAvailable !== false
        );

        let availableSlots = [];
        if (weeklyDay?.startTime && weeklyDay?.endTime) {
          availableSlots = await generateAvailableSlots(
            {
              date: s.date,
              availability: weeklyDay,
              sessionId: s._id,
              teacherId,
              studentId: null
            },
            {
              Duration: s.sessionDuration,
              breakDuration: s.breakDuration,
              teacherTimezone: teacherTZ,
              studentTimezone: teacherTZ
            },
            s.bookedSlots || []
          );
        }

        const bookedSlots = (s.bookedSlots || []).map(b => ({
          startTime: moment(b.startTime).tz(teacherTZ).format("HH:mm"),
          endTime: moment(b.endTime).tz(teacherTZ).format("HH:mm"),
          startUTC: moment(b.startTime).utc().toISOString(),
          endUTC: moment(b.endTime).utc().toISOString(),
          bookedBy: b.bookedBy,
          bookedByTeacher: b.bookedByTeacher || false,
          studentName: b.bookedBy?.name || 'Unknown'
        }));

        // ✅ FIXED TOTAL: base = available + booked always
        const totalSlots = availableSlots.length + bookedSlots.length;

        return {
          sessionId: s._id,
          title: s.title,
          date: moment(s.date).tz(teacherTZ).format("DD-MM-YYYY"),
          day: moment(s.date).tz(teacherTZ).format("dddd"),
          sessionType: s.allowedStudentId ? "personal" : "common",
          sessionDuration: s.sessionDuration,
          breakDuration: s.breakDuration,
          allowedStudent: {
            _id: s.allowedStudentId?._id,
            name: s.allowedStudentId?.name || 'Unknown'
          },

          totalSlots,
          slots: availableSlots, // available
          bookedSlots,           // booked
        };
      })
    );

    return res.json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSessions / limit),
        totalSessions,
        limit
      },
      sessions: formattedSessions
    });

  } catch (error) {
    console.error("Error in getTeacherSessions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching teacher sessions"
    });
  }
};

exports.assignSlotByTeacher = async (req, res) => {
  let lockKey;

  try {
    const teacherId = req.user.id;
    const teacherTimezone = req.user.timezone || "Asia/Kolkata";
    const teacherName = req.user.name;
    const {
      sessionId,
      studentId,
      date,
      startTime,
      endTime
    } = req.body;

    if (!sessionId || !studentId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "sessionId, studentId, date, startTime, endTime are required"
      });
    }

    // 🔐 Validate student belongs to teacher
    const student = await User.findOne({
      _id: studentId,
      teacherId
    });

    if (!student) {
      return res.status(403).json({
        message: "Invalid student for this teacher"
      });
    }

    const session = await SessionSlot.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (String(session.teacherId) !== String(teacherId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // 🔐 Personal session validation
    if (
      session.allowedStudentId &&
      String(session.allowedStudentId) !== String(studentId)
    ) {
      return res.status(403).json({
        message: "This session is restricted to another student"
      });
    }

    // 🕒 Convert TEACHER LOCAL TIME → UTC
    const startUTC = moment.tz(
      `${date} ${startTime}`,
      "DD-MM-YYYY HH:mm",
      teacherTimezone
    ).utc();

    const endUTC = moment.tz(
      `${date} ${endTime}`,
      "DD-MM-YYYY HH:mm",
      teacherTimezone
    ).utc();

    if (!startUTC.isValid() || !endUTC.isValid()) {
      return res.status(400).json({ message: "Invalid date or time format" });
    }

    if (!endUTC.isAfter(startUTC)) {
      return res.status(400).json({
        message: "End time must be after start time"
      });
    }

    // 🔒 Redis lock
    lockKey = `lock:teacher:${teacherId}:session:${sessionId}:slot:${startUTC.toISOString()}`;

    if (redisClient?.isOpen) {
      const lock = await redisClient.set(lockKey, "locked", {
        NX: true,
        EX: 10
      });

      if (!lock) {
        return res.status(409).json({
          message: "Slot is being processed. Try again."
        });
      }
    }

    // ❌ Prevent overlap
    const overlap = (session.bookedSlots || []).some(b =>
      startUTC.isBefore(moment(b.endTime)) &&
      endUTC.isAfter(moment(b.startTime))
    );

    if (overlap) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    // ✅ BOOK SLOT (UTC STORE)
    session.bookedSlots.push({
      startTime: startUTC.toDate(),
      endTime: endUTC.toDate(),
      bookedBy: studentId,
      bookedByTeacher: true
    });

    await session.save();

    // 🧹 Clear cache
    if (redisClient?.isOpen) {
      const keys = await redisClient.keys(`*${sessionId}*`);
      if (keys.length) await redisClient.del(keys);
    }
    
    return res.json({
      success: true,
      message: "Slot assigned successfully",
      data: {
        sessionId,
        studentId,
        startTimeUTC: startUTC.toISOString(),
        endTimeUTC: endUTC.toISOString()
      }
    });

  } catch (err) {
    console.error("assignSlotByTeacher error:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    if (redisClient?.isOpen && lockKey) {
      await redisClient.del(lockKey);
    }
  }
};

exports.cancelAssignedSlot = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { sessionId, startTimeUTC, endTimeUTC } = req.body;

    if (!sessionId || !startTimeUTC || !endTimeUTC) {
      return res.status(400).json({
        success: false,
        message: "sessionId, startTimeUTC, endTimeUTC are required"
      });
    }

    const session = await SessionSlot.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // 🔐 Teacher ownership check
    if (String(session.teacherId) !== String(teacherId)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to modify this session"
      });
    }

    const startUTC = moment.utc(startTimeUTC);
    const endUTC = moment.utc(endTimeUTC);

    if (!startUTC.isValid() || !endUTC.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid UTC time format"
      });
    }

    // 🔍 Find the specific booked slot
    const bookedSlotIndex = (session.bookedSlots || []).findIndex(b =>
      moment.utc(b.startTime).isSame(startUTC) &&
      moment.utc(b.endTime).isSame(endUTC)
    );

    if (bookedSlotIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Booked slot not found"
      });
    }

    const bookedSlot = session.bookedSlots[bookedSlotIndex];

    // ❌ STRICT RULE: Check if this slot was assigned by teacher
    // Only slots with bookedByTeacher: true can be cancelled by teacher
    if (!bookedSlot.bookedByTeacher) {
      return res.status(403).json({
        success: false,
        message: "Cannot cancel slots booked directly by students"
      });
    }

    // ✅ Remove the booked slot
    session.bookedSlots.splice(bookedSlotIndex, 1);
    await session.save();

    // 🧹 Clear relevant caches
    if (redisClient?.isOpen) {
      const keys = [
        ...(await redisClient.keys(`teacher:${teacherId}:sessions:*`)),
        ...(await redisClient.keys(`slots:teacher:${teacherId}:${sessionId}:*`)),
        ...(await redisClient.keys(`slots:student:*:${sessionId}:*`)),
        ...(await redisClient.keys(`student:${bookedSlot.bookedBy}:sessions:*`))
      ];
      if (keys.length > 0) await redisClient.del(keys);
    }

    return res.json({
      success: true,
      message: "Teacher-assigned slot cancelled successfully",
      data: {
        sessionId,
        startTimeUTC: startUTC.toISOString(),
        endTimeUTC: endUTC.toISOString(),
        cancelledStudentId: bookedSlot.bookedBy
      }
    });

  } catch (err) {
    console.error("cancelTeacherAssignedSlot error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while cancelling slot"
    });
  }
};

exports.deleteSessionByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ message: "SessionId is required" });
    }

    const session = await SessionSlot.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // 🔐 ownership check
    if (String(session.teacherId) !== String(teacherId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // ❌ prevent delete if slots already booked
    if (session.bookedSlots && session.bookedSlots.length > 0) {
      return res.status(400).json({
        message: "Cannot delete session with booked slots"
      });
    }

    await SessionSlot.findByIdAndDelete(sessionId);

    return res.json({
      success: true,
      message: "Session deleted successfully",
      sessionId
    });

  } catch (err) {
    console.error("deleteSessionByTeacher error:", err);
    return res.status(500).json({ message: err.message });
  }
};
