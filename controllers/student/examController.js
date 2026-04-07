const ExamTimetable = require("../../models/ExamTimetable");
const Exam = require("../../models/Exam");
const User = require("../../models/User");
const ExamEntry = require("../../models/ExamEntry");
const moment = require("moment-timezone");

// Get full exam timetable for the current student's class
exports.getStudentTimetable = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "student") {
      return res.status(403).json({ success: false, message: "Unauthorized access: Only students can view their timetable" });
    }

    const studentClass = user.studentData.class;
    
    // Find all exams related to the student's academic context
    // We fetch all exams to ensure the timetable is visible, sorting by start date
    const exams = await Exam.find({}).sort({ startDate: 1 });

    if (exams.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No examinations found in the system",
        data: [],
        exams: []
      });
    }

    // Get timetable for all exams for this class
    const examIds = exams.map(e => e._id);
    const timetable = await ExamTimetable.find({
      examId: { $in: examIds },
      class: studentClass
    })
    .populate('examId', 'name academicYear startDate endDate')
    .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: timetable,
      exams: exams
    });
  } catch (error) {
    console.error("Error fetching student timetable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get currently available/active exams for a student
 */
exports.getAvailableExams = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "student") {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    const studentClass = user.class || (user.studentData && user.studentData.class);
    
    if (!studentClass) {
      console.log(`[DEBUG] No class found for student: ${user.name}`);
      return res.status(200).json({ 
        success: true, 
        data: [], 
        studentClass: null,
        message: "No class assigned to your profile. Please contact administration." 
      });
    }

    // Get all timetable entries for the student's class
    console.log(`[DEBUG] Fetching available exams for Student ID: ${req.user.id}, Class: ${studentClass}`);
    
    const timetable = await ExamTimetable.find({ class: Number(studentClass) })
      .populate('examId', 'name academicYear startDate endDate')
      .sort({ date: 1, startTime: 1 });

    const today = moment().tz("Asia/Kolkata").startOf('day');

    const availableExams = (await Promise.all(timetable.map(async t => {
      const hasTimetableSubmission = t.submissions.some(s => s.studentId.toString() === req.user.id);
      const hasOnlineSubmission = await ExamEntry.exists({ 
        timetableId: t._id, 
        studentId: req.user.id, 
        type: { $in: ['ANSWER', 'SUBMISSION'] } 
      });

      const isSubmitted = hasTimetableSubmission || hasOnlineSubmission;
      
      const onlineQuestionsCount = await ExamEntry.countDocuments({ timetableId: t._id, type: 'QUESTION' });
      const isOnlineExam = onlineQuestionsCount > 0;
      
      const examDate = moment(t.date).tz("Asia/Kolkata").startOf('day');
      const isToday = examDate.isSame(today);
      const isUpcoming = examDate.isAfter(today);
      const isPast = examDate.isBefore(today);
      const hasQuestions = (t.questions && t.questions.length > 0) || isOnlineExam || t.questionPaper;
      
      return {
        _id: t._id,
        subjectName: t.subjectName,
        examName: t.examId ? t.examId.name : "Exam",
        date: t.date,
        startTime: t.startTime,
        endTime: t.endTime,
        duration: t.duration,
        isSubmitted,
        isToday,
        isUpcoming,
        isPast,
        hasQuestions,
        isOnlineExam
      };
    }))).sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        if (a.isUpcoming && b.isPast) return -1;
        if (a.isPast && b.isUpcoming) return 1;
        return new Date(a.date) - new Date(b.date) || a.startTime.localeCompare(b.startTime);
    });

    res.status(200).json({
      success: true,
      data: availableExams,
      studentClass: studentClass
    });
  } catch (error) {
    console.error("Error fetching available exams:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get specific exam questions
 */
exports.getExamQuestions = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const timetable = await ExamTimetable.findById(timetableId).populate('examId', 'name');
    
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }
    
    // Check if submitted
    const isSubmitted = timetable.submissions.some(s => s.studentId.toString() === req.user.id);
    if (isSubmitted) {
      return res.status(400).json({ success: false, message: "You have already submitted this exam." });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: timetable._id,
        subjectName: timetable.subjectName,
        examName: timetable.examId ? timetable.examId.name : "Exam",
        questions: timetable.questions,
        questionPaper: timetable.questionPaper
      }
    });

  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit exam answers
 */
exports.submitExam = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { answers } = req.body; // array of { questionId, answerText }

    const user = await User.findById(req.user.id);

    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    const isSubmitted = timetable.submissions.some(s => s.studentId.toString() === req.user.id);
    if (isSubmitted) {
      return res.status(400).json({ success: false, message: "Exam already submitted." });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot submit without answers." });
    }
    
    let totalMarks = 0;
    timetable.questions.forEach(q => totalMarks += q.maxMarks);

    timetable.submissions.push({
      studentId: user._id,
      studentName: user.name,
      studentUserId: user.userId,
      submissionDate: new Date(),
      answers: answers.map(a => ({
        questionId: a.questionId,
        answerText: a.answerText,
        marksGiven: null
      })),
      marks: null,
      totalMarks: totalMarks,
      feedback: "",
      status: "submitted"
    });

    await timetable.save();

    res.status(200).json({
      success: true,
      message: "Exam submitted successfully."
    });

  } catch (error) {
    console.error("Error submitting exam:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get published results for the student
 */
exports.getMyResults = async (req, res) => {
  try {
    // Find all published submissions for this student
    const results = await ExamEntry.find({
      studentId: req.user.id,
      type: 'SUBMISSION',
      overallStatus: 'PUBLISHED'
    })
    .populate({
      path: 'timetableId',
      populate: { path: 'examId', select: 'name academicYear' }
    })
    .sort({ createdAt: -1 });

    const formattedResults = results.map(r => {
      if (!r.timetableId) return null;
      return {
        _id: r._id,
        examName: r.timetableId.examId ? r.timetableId.examId.name : 'Unknown Exam',
        subjectName: r.timetableId.subjectName,
        date: r.timetableId.date,
        totalMarks: r.totalMarksObtained,
        totalMaxMarks: r.totalMaxMarks,
        percentage: ((r.totalMarksObtained / r.totalMaxMarks) * 100).toFixed(2),
        status: 'Published'
      };
    }).filter(r => r !== null);

    res.status(200).json({
      success: true,
      data: formattedResults
    });
  } catch (error) {
    console.error("Error fetching student results:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
