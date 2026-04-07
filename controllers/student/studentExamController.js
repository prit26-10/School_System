const ExamEntry = require("../../models/ExamEntry");
const ExamTimetable = require("../../models/ExamTimetable");
const mongoose = require("mongoose");

/**
 * Get exam questions for a specific timetable entry
 */
exports.getExamPaper = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const studentId = req.user.id;

    // Check if student already submitted (either old ANSWER style or new SUBMISSION style)
    const existingSubmission = await ExamEntry.findOne({ 
      timetableId, 
      studentId, 
      type: { $in: ['ANSWER', 'SUBMISSION'] }
    });

    if (existingSubmission) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already submitted this exam." 
      });
    }

    // Fetch timetable to get metadata
    const timetable = await ExamTimetable.findById(timetableId).populate('examId', 'name');
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    // Fetch questions (Master questions still use type: QUESTION)
    const questions = await ExamEntry.find({ 
      timetableId, 
      type: 'QUESTION' 
    }).select('-correctAnswer').sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        subjectName: timetable.subjectName,
        examName: (timetable.examId ? timetable.examId.name : "Online Exam"),
        duration: timetable.duration,
        questions: questions
      }
    });
  } catch (error) {
    console.error("Error fetching exam paper:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit exam answers
 */
exports.submitExamAnswers = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { answers, isAutoSubmission, submissionReason } = req.body; 
    const studentId = req.user.id;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: "Invalid answers format" });
    }

    // Check if already submitted
    const existingSubmission = await ExamEntry.findOne({ 
      timetableId, 
      studentId, 
      type: { $in: ['ANSWER', 'SUBMISSION'] } 
    });

    if (existingSubmission) {
      return res.status(400).json({ success: false, message: "Exam already submitted" });
    }

    // Fetch all master questions for this exam
    const masterQuestions = await ExamEntry.find({ timetableId, type: 'QUESTION' }).sort({ createdAt: 1 });
    
    if (!masterQuestions || masterQuestions.length === 0) {
      return res.status(404).json({ success: false, message: "No questions found for this exam." });
    }

    const submissionType = isAutoSubmission ? 'AUTO_PROCTOR' : 'MANUAL';
    const reason = submissionReason || "";
    let totalMarksObtained = 0;

    // Map answers into the nested question structure
    const questionsWithAnswers = masterQuestions.map(mq => {
      const studentAns = answers.find(a => a.questionId.toString() === mq._id.toString());
      const studentAnswer = studentAns ? studentAns.studentAnswer : "";
      
      let marksObtained = 0;
      let status = 'SUBMITTED';

      // Auto-grading for MCQ and TF
      if (mq.questionType === 'MCQ' || mq.questionType === 'TF') {
        const correct = mq.correctAnswer.toString().trim().toLowerCase();
        const provided = studentAnswer.toString().trim().toLowerCase();

        if (provided === correct) {
          marksObtained = mq.maxMarks;
          status = 'EVALUATED';
        } else if (provided) {
          status = 'EVALUATED'; // Wrong but evaluated
        }
      }

      totalMarksObtained += marksObtained;

      return {
        questionId: mq._id,
        questionText: mq.questionText,
        questionType: mq.questionType,
        options: mq.options,
        correctAnswer: mq.correctAnswer,
        studentAnswer: studentAnswer,
        maxMarks: mq.maxMarks,
        marksObtained: marksObtained,
        status: status
      };
    });

    // Create a single SUBMISSION document
    const submission = await ExamEntry.create({
      timetableId,
      studentId,
      type: 'SUBMISSION',
      questions: questionsWithAnswers,
      submissionType,
      submissionReason: reason,
      totalMarksObtained,
      overallStatus: 'SUBMITTED' // Default to submitted until all descriptive are graded
    });

    res.status(201).json({
      success: true,
      message: "Exam submitted successfully",
      data: submission
    });
  } catch (error) {
    console.error("Error submitting exam:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
