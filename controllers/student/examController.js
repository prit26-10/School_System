const ExamTimetable = require("../../models/ExamTimetable");
const Exam = require("../../models/Exam");
const User = require("../../models/User");
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

    const studentClass = user.studentData.class;

    // Get all timetable entries for the student's class
    const timetable = await ExamTimetable.find({ class: studentClass })
      .populate('examId', 'name academicYear startDate endDate')
      .sort({ date: 1, startTime: 1 });

    const now = moment();

    // Filter exams that have questions, and are currently active (based on date & time roughly, maybe within 24h for demonstration)
    // For simplicity, we just return those with questions so the UI can render them
    const availableExams = timetable.filter(t => t.questions && t.questions.length > 0)
    .map(t => {
      const isSubmitted = t.submissions.some(s => s.studentId.toString() === req.user.id);
      return {
        _id: t._id,
        subjectName: t.subjectName,
        examName: t.examId ? t.examId.name : "Exam",
        date: t.date,
        startTime: t.startTime,
        endTime: t.endTime,
        duration: t.duration,
        isSubmitted
      };
    });

    res.status(200).json({
      success: true,
      data: availableExams
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
        questions: timetable.questions
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
