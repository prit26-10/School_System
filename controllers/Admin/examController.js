const Exam = require("../../models/Exam");
const ExamTimetable = require("../../models/ExamTimetable");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const PublicHoliday = require("../../models/PublicHoliday");
const moment = require("moment-timezone");

// Create a new exam period
exports.createExam = async (req, res) => {
  try {
    const { name, academicYear, startDate, endDate, description } = req.body;

    if (!name || !academicYear || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, academicYear, startDate, and endDate",
      });
    }

    const exam = new Exam({
      name,
      academicYear,
      startDate,
      endDate,
      description,
    });

    await exam.save();

    res.status(201).json({
      success: true,
      message: "Exam period created successfully",
      data: exam,
    });
  } catch (error) {
    console.error("Error creating exam:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all exam periods
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find().sort({ startDate: -1 });
    res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add an entry to the exam timetable
exports.addTimetableEntry = async (req, res) => {
  try {
    const {
      examId,
      examTitle,
      class: className,
      subjectName,
      subjectCode,
      date,
      startTime,
      endTime,
      duration,
    } = req.body;

    if ((!examId && !examTitle) || !className || !subjectName || !subjectCode || !date || !startTime || !endTime || !duration) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let finalExamId = examId;
    if (examTitle) {
      let exam = await Exam.findOne({ name: examTitle });
      if (!exam) {
        exam = new Exam({
          name: examTitle,
          academicYear: moment().format("YYYY") + "-" + moment().add(1, 'year').format("YYYY"),
          startDate: new Date(date),
          endDate: moment(date).add(30, 'days').toDate()
        });
        await exam.save();
      }
      finalExamId = exam._id.toString();
    }

    // 1. Validate Exam Period
    const exam = await Exam.findById(finalExamId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam period not found" });
    }

    // Ignore backend date validation to support flexible scheduling
    // const examDate = moment(date);
    if (examDate.isBefore(moment(exam.startDate)) || examDate.isAfter(moment(exam.endDate))) {
      return res.status(400).json({
        success: false,
        message: `Date must be between ${moment(exam.startDate).format("YYYY-MM-DD")} and ${moment(
          exam.endDate
        ).format("YYYY-MM-DD")}`,
      });
    }

    // 2. Validate Class Existence (Optional but good)
    const classDoc = await ClassSubject.findOne({ class: parseInt(className) });
    if (!classDoc) {
      return res.status(404).json({ success: false, message: `Class ${className} not found` });
    }

    // 3. Check for Subject Conflict (Same subject twice in same exam for same class)
    const existingSubject = await ExamTimetable.findOne({
      examId: finalExamId,
      class: className,
      subjectCode,
    });
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: `Subject ${subjectName} (${subjectCode}) is already scheduled for this exam in Class ${className}`,
      });
    }

    // 4. Check for Time Slot Conflict (Overlapping exams for the same class)
    const start = moment(startTime, "HH:mm");
    const end = moment(endTime, "HH:mm");

    const overlappingExams = await ExamTimetable.find({
      examId: finalExamId,
      class: className,
      date: new Date(date),
    });

    for (const entry of overlappingExams) {
      const entryStart = moment(entry.startTime, "HH:mm");
      const entryEnd = moment(entry.endTime, "HH:mm");

      if (
        (start.isSameOrAfter(entryStart) && start.isBefore(entryEnd)) ||
        (end.isAfter(entryStart) && end.isSameOrBefore(entryEnd)) ||
        (start.isBefore(entryStart) && end.isAfter(entryEnd))
      ) {
        return res.status(400).json({
          success: false,
          message: `Time slot overlaps with existing exam: ${entry.subjectName} (${entry.startTime} - ${entry.endTime})`,
        });
      }
    }

    // 5. Find Subject Teacher
    const subject = classDoc.subjects.find(s => s.code === subjectCode);
    const teacherId = subject?.assignedTeacher?.teacherId || null;

    // 6. Create Entry
    const newEntry = new ExamTimetable({
      examId: finalExamId,
      class: className,
      subjectName,
      subjectCode,
      date,
      startTime,
      endTime,
      duration,
      teacherId, // Link the subject teacher
    });

    await newEntry.save();

    res.status(201).json({
      success: true,
      message: "Exam timetable entry added successfully",
      data: newEntry,
    });
  } catch (error) {
    console.error("Error adding timetable entry:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get timetable for a specific class and exam
exports.getTimetableByClass = async (req, res) => {
  try {
    const { examId, class: className } = req.params;
    const mongoose = require('mongoose');

    let searchExamId = examId;
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      const examObj = await Exam.findOne({ name: examId });
      if (examObj) {
        searchExamId = examObj._id;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const timetable = await ExamTimetable.find({
      examId: searchExamId,
      class: parseInt(className),
    }).sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: timetable,
    });
  } catch (error) {
    console.error("Error fetching timetable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a timetable entry
exports.deleteTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await ExamTimetable.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Exam timetable entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting timetable entry:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate an automated exam timetable
exports.generateTimetable = async (req, res) => {
  try {
    const { examId, timeSlots: requestedSlots } = req.body;

    if (!examId) {
      return res.status(400).json({ success: false, message: "examId is required" });
    }

    // 1. Fetch Data 
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam period not found" });
    }

    const classes = await ClassSubject.find();
    const holidays = await PublicHoliday.find({ academicYear: exam.academicYear });

    if (classes.length === 0) return res.status(400).json({ success: false, message: "No classes found to schedule" });

    // 2. Setup Configuration
    const defaultSlots = [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:00" }
    ];
    const timeSlots = requestedSlots || defaultSlots;

    // 3. Helper: Get available dates (excluding holidays and Sundays)
    const availableDates = [];
    let currentDate = moment(exam.startDate).startOf("day");
    const endDate = moment(exam.endDate).endOf("day");

    const holidayDates = holidays.map(h => moment(h.date).format("YYYY-MM-DD"));

    while (currentDate.isSameOrBefore(endDate)) {
      const isSunday = currentDate.day() === 0;
      const isHoliday = holidayDates.includes(currentDate.format("YYYY-MM-DD"));

      if (!isSunday && !isHoliday) {
        availableDates.push(currentDate.format("YYYY-MM-DD"));
      }
      currentDate.add(1, "day");
    }

    if (availableDates.length === 0) {
      return res.status(400).json({ success: false, message: "No available dates in the given exam period (all holidays/Sundays)" });
    }

    // 4. Generate Requirements List
    const requirements = [];
    classes.forEach(cls => {
      cls.subjects.forEach(sub => {
        requirements.push({
          class: cls.class,
          className: cls.name,
          subjectName: sub.name,
          subjectCode: sub.code
        });
      });
    });

    // Shuffle requirements for randomness
    requirements.sort(() => Math.random() - 0.5);

    // 5. Allocation State
    const timetableResults = [];
    const classBusy = {}; // { class: { date: { slotIndex: true } } }
    const classLastExamDate = {}; // { class: moment }

    // 6. Algorithm (Greedy with randomized date/slot selection)
    const errorsList = [];
    
    for (const reqObj of requirements) {
      let assigned = false;
      
      const shuffledDates = [...availableDates].sort(() => Math.random() - 0.5);
      
      // Try with gap rule
      for (const dateStr of shuffledDates) {
        const date = moment(dateStr);
        const lastDate = classLastExamDate[reqObj.class];
        if (lastDate && Math.abs(date.diff(lastDate, 'days')) < 2) {
          continue; 
        }

        const shuffledSlots = timeSlots.map((s, i) => ({ ...s, index: i })).sort(() => Math.random() - 0.5);
        for (const slot of shuffledSlots) {
          if (classBusy[reqObj.class]?.[dateStr]?.[slot.index]) continue;
          
          timetableResults.push({
            date: dateStr,
            time_slot: `${slot.start} - ${slot.end}`,
            startTime: slot.start,
            endTime: slot.end,
            class: reqObj.class,
            className: reqObj.className,
            subject: reqObj.subjectName,
            subjectCode: reqObj.subjectCode
          });

          if (!classBusy[reqObj.class]) classBusy[reqObj.class] = {};
          if (!classBusy[reqObj.class][dateStr]) classBusy[reqObj.class][dateStr] = {};
          classBusy[reqObj.class][dateStr][slot.index] = true;
          
          classLastExamDate[reqObj.class] = date;
          assigned = true;
          break;
        }
        if (assigned) break;
      }

      // If still not assigned, try without gap rule
      if (!assigned) {
        for (const dateStr of shuffledDates) {
          const shuffledSlots = timeSlots.map((s, i) => ({ ...s, index: i })).sort(() => Math.random() - 0.5);
          for (const slot of shuffledSlots) {
            if (classBusy[reqObj.class]?.[dateStr]?.[slot.index]) continue;
            
            timetableResults.push({
              date: dateStr,
              time_slot: `${slot.start} - ${slot.end}`,
              startTime: slot.start,
              endTime: slot.end,
              class: reqObj.class,
              className: reqObj.className,
              subject: reqObj.subjectName,
              subjectCode: reqObj.subjectCode
            });
            if (!classBusy[reqObj.class]) classBusy[reqObj.class] = {};
            if (!classBusy[reqObj.class][dateStr]) classBusy[reqObj.class][dateStr] = {};
            classBusy[reqObj.class][dateStr][slot.index] = true;
            
            assigned = true;
            break;
          }
          if (assigned) break;
        }
      }

      if (!assigned) {
        errorsList.push(`Could not schedule ${reqObj.subjectName} for Class ${reqObj.class} due to resource/time constraints.`);
      }
    }

    // 7. Return Result
    res.status(200).json({
      status: errorsList.length === 0 ? "success" : "failure",
      timetable: timetableResults.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
      errors: errorsList
    });

  } catch (error) {
    console.error("Error generating timetable:", error);
    res.status(500).json({ status: "failure", errors: [error.message] });
  }
};
// Get timetable for the current student's class
exports.getStudentTimetable = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "student") {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    const studentClass = user.studentData.class;
    
    // Find active/upcoming exams
    const activeExams = await Exam.find({
      endDate: { $gte: moment().startOf('day').toDate() }
    }).sort({ startDate: 1 });

    if (activeExams.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active or upcoming exams found",
        data: []
      });
    }

    // By default, get timetable for all upcoming exams
    const examIds = activeExams.map(e => e._id);
    const timetable = await ExamTimetable.find({
      examId: { $in: examIds },
      class: studentClass
    }).sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: timetable,
      exams: activeExams
    });
  } catch (error) {
    console.error("Error fetching student timetable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get timetable for the current teacher (invigilation schedule)
exports.getTeacherTimetable = async (req, res) => {
  try {
    const timetable = await ExamTimetable.find({
      invigilatorId: req.user.id
    })
    .populate('examId', 'name academicYear')
    .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: timetable
    });
  } catch (error) {
    console.error("Error fetching teacher timetable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all evaluated exam submissions for admin review
exports.getEvaluatedExams = async (req, res) => {
  try {
    const timetables = await ExamTimetable.find({
      'submissions.status': 'evaluated'
    }).populate('examId', 'name');

    const resultData = [];
    timetables.forEach(timetable => {
      const evaluatedSubmissions = timetable.submissions.filter(s => s.status === 'evaluated' || s.status === 'published');
      if (evaluatedSubmissions.length > 0) {
        resultData.push({
          timetableId: timetable._id,
          examName: timetable.examId ? timetable.examId.name : 'Unknown Exam',
          subjectName: timetable.subjectName,
          className: timetable.class,
          date: timetable.date,
          evaluatedCount: evaluatedSubmissions.length,
          submissions: evaluatedSubmissions
        });
      }
    });

    res.status(200).json({
      success: true,
      data: resultData
    });
  } catch (error) {
    console.error("Error fetching evaluated exams:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Publish exam results (Admin approval)
exports.publishExamResults = async (req, res) => {
  try {
    const { timetableId } = req.params;
    
    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam timetable not found" });
    }

    let updatedCount = 0;
    timetable.submissions.forEach(sub => {
      if (sub.status === 'evaluated') {
        sub.status = 'published';
        updatedCount++;
      }
    });

    await timetable.save();

    res.status(200).json({
      success: true,
      message: `Successfully published results for ${updatedCount} students`,
      data: timetable
    });
  } catch (error) {
    console.error("Error publishing results:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
