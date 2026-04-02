const moment = require("moment-timezone");
const Session = require("../models/Session");
const TeacherAvailability = require("../models/TeacherAvailability");
const User = require("../models/User");
const { parseDDMMYYYYWithTime } = require("../utils/dateParser");

const isWithinAvailability = (availability, start, end) => {
  const day = start.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  const slot = availability.weeklyAvailability.find(d => d.day === day);
  if (!slot) return false;

  const [sh, sm] = slot.startTime.split(":").map(Number);
  const [eh, em] = slot.endTime.split(":").map(Number);

  const startLimit = new Date(start);
  startLimit.setHours(sh, sm, 0, 0);

  const endLimit = new Date(start);
  endLimit.setHours(eh, em, 0, 0);

  return start >= startLimit && end <= endLimit;
};

const isHoliday = (availability, start, end) => {
  return availability.holidays.some(h =>
    start <= h.endDate && end >= h.startDate
  );
};

exports.createSession = async (req, res) => {
  try {
    const { title, studentId } = req.body;
    const teacherId = req.user.id;

    const start = req.parsedStartTime;
    const end = req.parsedEndTime;

    if (studentId) {
      const student = await User.findOne({
        _id: studentId,
        teacherId
      });

      if (!student) {
        return res.status(404).json({
          message: "Student not found or not assigned to this teacher"
        });
      }
    }

    const overlap = await Session.findOne({
      teacherId,
      startTime: { $lt: end },
      endTime: { $gt: start }
    });

    if (overlap) {
      return res.status(400).json({
        message: "Session overlaps with existing session"
      });
    }

    const availability = await TeacherAvailability.findOne({ teacherId });

    if (!availability) {
      return res.status(400).json({
        message: "Teacher availability not set"
      });
    }

    if (!isWithinAvailability(availability, start, end)) {
      return res.status(400).json({
        message: "Session outside teacher availability"
      });
    }

    if (isHoliday(availability, start, end)) {
      return res.status(400).json({
        message: "Session falls on a holiday"
      });
    }

    const session = await Session.create({
      teacherId,
      studentId: studentId || null,
      title,
      startTime: start,
      endTime: end
    });

    res.status(201).json({
      message: studentId
        ? "Session created for particular student"
        : "Session created for all students",
      session
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStudentSessions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const timezone = student.timezone || "Asia/Kolkata";
    const teacherId = student.teacherId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      teacherId,
      $or: [
        { studentId: null },
        { studentId: studentId }
      ]
    };

    const totalSessions = await Session.countDocuments(query);

    const sessions = await Session.find(query)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit);

    const formattedSessions = sessions.map(s => ({
      _id: s._id,
      title: s.title,
      type: s.studentId ? "personal" : "common",
      startTime: moment(s.startTime).tz(timezone).format("DD-MM-YYYY HH:mm"),
      endTime: moment(s.endTime).tz(timezone).format("DD-MM-YYYY HH:mm")
    }));

    res.json({
      pagination: {
        totalSessions,
        currentPage: page,
        totalPages: Math.ceil(totalSessions / limit),
        limit
      },
      sessions: formattedSessions
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
