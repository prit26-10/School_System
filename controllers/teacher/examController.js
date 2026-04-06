const mongoose = require("mongoose");
const ExamTimetable = require("../../models/ExamTimetable");
const Exam = require("../../models/Exam");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const ExamEntry = require("../../models/ExamEntry");
const csv = require("csv-parser");
const moment = require("moment-timezone");
const path = require("path");
const fs = require("fs");

/**
 * Get timetable for the current teacher (based on Class Teacher or Subject Teacher role)
 */
exports.getTeacherTimetable = async (req, res) => {
  try {
    const mongoUserId = req.user.id; // User's MongoDB _id used in ClassSubject assignments

    // 1. Find teacher's roles in ClassSubject using their MongoDB _id
    const classTeacherDocs = await ClassSubject.find({ "assignedTeacher.teacherId": mongoUserId });
    const classTeacherClasses = classTeacherDocs.map(c => c.class);

    const subjectTeacherDocs = await ClassSubject.find({ "subjects.assignedTeacher.teacherId": mongoUserId });
    const subjectTeacherAssignments = [];
    subjectTeacherDocs.forEach(cls => {
      cls.subjects.forEach(sub => {
        if (sub.assignedTeacher?.teacherId === mongoUserId) {
          subjectTeacherAssignments.push({
            class: cls.class,
            subjectCode: sub.code
          });
        }
      });
    });

    // 2. Build Union Query for ExamTimetable
    const queryConditions = [];
    if (classTeacherClasses.length > 0) {
      queryConditions.push({ class: { $in: classTeacherClasses } });
    }
    if (subjectTeacherAssignments.length > 0) {
      queryConditions.push({ $or: subjectTeacherAssignments });
    }

    if (queryConditions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No assigned classes or subjects found in ClassSubject schema."
      });
    }

    const timetable = await ExamTimetable.find({ $or: queryConditions })
    .populate('examId', 'name academicYear startDate endDate')
    .sort({ date: 1, startTime: 1 });

    // 3. Mark results with role flags
    const processedTimetable = timetable.map(entry => {
      const entryObj = entry.toObject();
      const isSubjectTeacher = subjectTeacherAssignments.some(
        a => a.class === entry.class && a.subjectCode === entry.subjectCode
      );
      const isClassTeacher = classTeacherClasses.includes(entry.class);

      return {
        ...entryObj,
        isSubjectTeacher,
        isClassTeacher
      };
    });

    res.status(200).json({
      success: true,
      count: processedTimetable.length,
      data: processedTimetable
    });
  } catch (error) {
    console.error("Error fetching teacher timetable:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload question paper for a specific exam entry
 */
exports.uploadQuestionPaper = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const mongoUserId = req.user.id; // User's MongoDB _id
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a file" });
    }

    const timetableEntry = await ExamTimetable.findById(timetableId);
    if (!timetableEntry) {
      return res.status(404).json({ success: false, message: "Exam timetable entry not found" });
    }

    // --- Strict Authorization: ONLY Subject Teacher (as identified in ClassSubject) can upload ---
    const classDoc = await ClassSubject.findOne({ 
      class: timetableEntry.class,
      "subjects.code": timetableEntry.subjectCode
    });

    const subject = classDoc?.subjects.find(s => s.code === timetableEntry.subjectCode);
    const isSubjectTeacher = (subject?.assignedTeacher?.teacherId === mongoUserId);

    if (!isSubjectTeacher) {
      return res.status(403).json({ success: false, message: "Unauthorized: Only the assigned subject teacher in ClassSubject can upload the question paper." });
    }

    // Update entry with file path
    timetableEntry.questionPaper = req.file.path.replace(/\\/g, "/");
    timetableEntry.paperUploadStatus = "uploaded";
    
    // Also store who uploaded it (using MongoDB _id)
    timetableEntry.teacherId = mongoUserId;
    
    await timetableEntry.save();

    res.status(200).json({
      success: true,
      message: "Question paper uploaded successfully",
      data: timetableEntry
    });
  } catch (error) {
    console.error("Error uploading question paper:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get student submissions for a specific exam session
 */
exports.getTimetableSubmissions = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const timetable = await ExamTimetable.findById(timetableId);
    
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    res.status(200).json({
      success: true,
      data: timetable.submissions || []
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a complete grading sheet (students + their marks/files) for an exam
 */
exports.getGradingSheet = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const timetable = await ExamTimetable.findById(timetableId);
    
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    // Find all students in this class
    const students = await User.find({
      role: 'student',
      'studentData.class': timetable.class
    }).select('name userId _id');

    // Merge student list with existing submission data
    const gradingData = students.map(student => {
      const submission = timetable.submissions.find(s => s.studentId.toString() === student._id.toString());
      return {
        studentId: student._id,
        studentName: student.name,
        studentUserId: student.userId,
        fileUrl: submission?.fileUrl || null,
        answers: submission?.answers || [],
        marks: submission?.marks !== undefined ? submission.marks : null,
        totalMarks: submission?.totalMarks || 100,
        feedback: submission?.feedback || "",
        status: submission?.status || "pending"
      };
    });

    res.status(200).json({
      success: true,
      data: gradingData
    });
  } catch (error) {
    console.error("Error fetching grading sheet:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Save marks and feedback for multiple students
 */
exports.saveExamMarks = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { marks } = req.body; // Array of { studentId, marks, feedback }

    if (!Array.isArray(marks)) {
      return res.status(400).json({ success: false, message: "Invalid marks data format" });
    }

    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    // Update each student's record
    for (const entry of marks) {
      const studentIdx = timetable.submissions.findIndex(s => s.studentId.toString() === entry.studentId);
      
      if (studentIdx !== -1) {
        // Update existing submission
        timetable.submissions[studentIdx].marks = entry.marks;
        timetable.submissions[studentIdx].feedback = entry.feedback;
        timetable.submissions[studentIdx].status = "evaluated";
      } else {
        // Create new mark record for student who might not have uploaded a paper yet
        const student = await User.findById(entry.studentId);
        if (student) {
          timetable.submissions.push({
            studentId: student._id,
            studentName: student.name,
            studentUserId: student.userId,
            marks: entry.marks,
            feedback: entry.feedback,
            status: "evaluated",
            submissionDate: new Date()
          });
        }
      }
    }

    await timetable.save();

    res.status(200).json({
      success: true,
      message: "Marks saved successfully"
    });
  } catch (error) {
    console.error("Error saving marks:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add or update questions for a specific exam timetable entry
 */
exports.addQuestions = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, message: "Questions must be an array" });
    }

    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    const mongoUserId = req.user.id;
    const classDoc = await ClassSubject.findOne({
      class: timetable.class,
      "subjects.code": timetable.subjectCode
    });

    const subject = classDoc?.subjects.find(s => s.code === timetable.subjectCode);
    const isSubjectTeacher = (subject?.assignedTeacher?.teacherId === mongoUserId);

    if (!isSubjectTeacher) {
      return res.status(403).json({ success: false, message: "Unauthorized: Only the assigned subject teacher can add test questions." });
    }

    timetable.questions = questions;
    await timetable.save();

    res.status(200).json({
      success: true,
      message: "Questions saved successfully",
      data: timetable.questions
    });
  } catch (error) {
    console.error("Error saving questions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Evaluate specific answers for a student's submission
 */
exports.evaluateExamAnswers = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { studentId, answersFeedback, overallFeedback } = req.body;
    // answersFeedback = [{ questionId, marksGiven }]

    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    const submissionIdx = timetable.submissions.findIndex(s => s.studentId.toString() === studentId);
    if (submissionIdx === -1) {
      return res.status(404).json({ success: false, message: "Student submission not found" });
    }

    let totalGiven = 0;
    const submission = timetable.submissions[submissionIdx];

    answersFeedback.forEach(feedbackItem => {
      const answer = submission.answers.find(a => a.questionId.toString() === feedbackItem.questionId);
      if (answer) {
        answer.marksGiven = Number(feedbackItem.marksGiven);
        totalGiven += answer.marksGiven;
      }
    });

    submission.marks = totalGiven;
    submission.feedback = overallFeedback || submission.feedback;
    submission.status = "evaluated";

    await timetable.save();

    res.status(200).json({
      success: true,
      message: "Submission evaluated successfully",
      data: submission
    });
  } catch (error) {
    console.error("Error evaluating answers:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload questions via CSV for an exam timetable entry
 */
exports.uploadCSVQuestions = async (req, res) => {
  try {
    const { timetableId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a CSV file" });
    }

    const timetable = await ExamTimetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          const questionsToInsert = results.map(row => {
            // Normalize question type
            const rawType = (row.type || row.questionType || '').trim().toUpperCase();
            let questionType = 'DESCRIPTIVE';
            if (rawType === 'MCQ') questionType = 'MCQ';
            else if (rawType === 'TF' || rawType === 'TRUEFALSE' || rawType === 'TRUE/FALSE') questionType = 'TF';

            // Build options array from separate columns (optionA, optionB, optionC, optionD)
            let options = [];
            if (questionType === 'MCQ') {
              ['optionA', 'optionB', 'optionC', 'optionD'].forEach(key => {
                if (row[key] && row[key].trim()) options.push(row[key].trim());
              });
              // Fallback: if no separate columns, try legacy 'options' field
              if (options.length === 0 && row.options) {
                options = row.options.split('|').map(o => o.trim()).filter(Boolean);
              }
            } else if (questionType === 'TF') {
              options = ['True', 'False'];
            }

            return {
              timetableId,
              type: 'QUESTION',
              questionType,
              questionText: row.question || row.questionText || '',
              options,
              correctAnswer: (row.correctAnswer || '').trim(),
              maxMarks: Number(row.maxMarks || row.marks) || 5
            };
          });

          // Remove old questions for this timetableId and replace with new ones
          await ExamEntry.deleteMany({ timetableId, type: 'QUESTION' });
          await ExamEntry.insertMany(questionsToInsert);

          // Update timetable status (using existing field or adding a flag)
          timetable.paperUploadStatus = 'uploaded';
          await timetable.save();

          // Cleanup file
          fs.unlinkSync(req.file.path);

          res.status(200).json({
            success: true,
            message: `Successfully uploaded ${questionsToInsert.length} questions.`,
          });
        } catch (err) {
          console.error("Error processing CSV data:", err);
          res.status(500).json({ success: false, message: "Error processing CSV data" });
        }
      });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get student submissions using the refactored ExamEntry schema (Embedded SUBMISSION)
 */
exports.getCSVExamSubmissions = async (req, res) => {
  try {
    const { timetableId } = req.params;
    
    // Find all submission documents for this timetable
    const submissions = await ExamEntry.find({ 
      timetableId: new mongoose.Types.ObjectId(timetableId), 
      type: 'SUBMISSION' 
    }).populate('studentId', 'name userId');

    const mappedSubmissions = submissions.map(sub => {
      const totalQuestions = sub.questions.length;
      const evaluatedQuestions = sub.questions.filter(q => q.status === 'EVALUATED').length;
      
      return {
        studentId: sub.studentId._id,
        name: sub.studentId.name,
        userId: sub.studentId.userId,
        submissionTime: sub.createdAt,
        isFullyEvaluated: evaluatedQuestions === totalQuestions,
        status: sub.overallStatus === "SUBMITTED_TO_ADMIN" ? "Submitted to Admin" : (evaluatedQuestions === totalQuestions ? "Evaluated" : "Pending"),
        overallStatus: sub.overallStatus,
        submissionId: sub._id
      };
    });

    res.status(200).json({
      success: true,
      data: mappedSubmissions
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get detailed student submission for evaluation
 */
exports.getStudentSubmissionDetail = async (req, res) => {
  try {
    const { timetableId, studentId } = req.params;

    // Find the SUBMISSION document and populate student info
    const submission = await ExamEntry.findOne({ 
      timetableId, 
      studentId, 
      type: 'SUBMISSION' 
    }).populate('studentId', 'name userId');

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Fetch timetable for subject name, date, etc.
    const timetable = await ExamTimetable.findById(timetableId).select('subjectName subjectCode date startTime class');

    const studentInfo = submission.studentId;

    // Build question list with student/exam metadata attached
    const detailedSubmission = submission.questions.map(q => {
      return {
        questionId: q.questionId,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        maxMarks: q.maxMarks,
        studentAnswer: q.studentAnswer,
        marksObtained: q.marksObtained,
        status: q.status,
        feedback: q.feedback,
        answerId: q._id,
        submissionId: submission._id,
        studentName: studentInfo ? studentInfo.name : 'Unknown',
        studentUserId: studentInfo ? studentInfo.userId : '-',
        subjectName: timetable ? timetable.subjectName : '-',
        subjectCode: timetable ? timetable.subjectCode : '-',
        examDate: timetable ? timetable.date : null,
        examClass: timetable ? timetable.class : '-',
        submittedAt: submission.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: detailedSubmission
    });
  } catch (error) {
    console.error("Error fetching submission detail:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Save marks for a descriptive question or update auto-marks within a SUBMISSION
 */
exports.saveManualMarking = async (req, res) => {
  try {
    const { answerId } = req.params; // This is the sub-document ID (q._id)
    const { marksObtained, feedback } = req.body;

    // Find the submission that contains this question ID in its questions array
    const submission = await ExamEntry.findOne({ "questions._id": answerId });
    
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission/Question not found" });
    }

    // Find the specific question and update it
    const q = submission.questions.id(answerId);
    if (!q) return res.status(404).json({ success: false, message: "Question not found" });

    q.marksObtained = marksObtained;
    q.feedback = feedback || "";
    q.status = 'EVALUATED';

    // Recalculate total marks obtained
    submission.totalMarksObtained = submission.questions.reduce((total, qu) => total + (qu.marksObtained || 0), 0);
    
    // Check overall status
    const allEvaluated = submission.questions.every(qu => qu.status === 'EVALUATED');
    if (allEvaluated) {
      submission.overallStatus = 'EVALUATED';
    }

    await submission.save();

    res.status(200).json({
      success: true,
      message: "Marks updated successfully",
      data: q
    });
  } catch (error) {
    console.error("Error saving manual marks:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Download sample CSV for exam questions
 */
exports.getCSVSampleFile = async (req, res) => {
  try {
    const questions = [
      { question: "What is the capital of France?", type: "MCQ", optionA: "London", optionB: "Paris", optionC: "Berlin", optionD: "Madrid", correctAnswer: "B" },
      { question: "Which planet is known as the Red Planet?", type: "MCQ", optionA: "Venus", optionB: "Jupiter", optionC: "Mars", optionD: "Saturn", correctAnswer: "C" },
      { question: "What is the largest mammal?", type: "MCQ", optionA: "Elephant", optionB: "Blue Whale", optionC: "Giraffe", optionD: "Hippopotamus", correctAnswer: "B" },
      { question: "What is 2 + 2?", type: "MCQ", optionA: "3", optionB: "4", optionC: "5", optionD: "6", correctAnswer: "B" },
      { question: "Which element has the symbol 'O'?", type: "MCQ", optionA: "Gold", optionB: "Oxygen", optionC: "Silver", optionD: "Iron", correctAnswer: "B" },
      { question: "The Earth is flat.", type: "TF", optionA: "True", optionB: "False", optionC: "", optionD: "", correctAnswer: "False" },
      { question: "Water boils at 100°C at sea level.", type: "TF", optionA: "True", optionB: "False", optionC: "", optionD: "", correctAnswer: "True" },
      { question: "Sharks are mammals.", type: "TF", optionA: "True", optionB: "False", optionC: "", optionD: "", correctAnswer: "False" },
      { question: "The sun rises in the east.", type: "TF", optionA: "True", optionB: "False", optionC: "", optionD: "", correctAnswer: "True" },
      { question: "Mount Everest is the tallest mountain.", type: "TF", optionA: "True", optionB: "False", optionC: "", optionD: "", correctAnswer: "True" },
      { question: "Explain the process of photosynthesis.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "Discuss the impact of the industrial revolution.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "Describe the water cycle.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "What are the benefits of exercise?", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "Explain the concept of supply and demand.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "How does a blockchain work?", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "Discuss the importance of renewable energy.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "What caused the Great Depression?", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "Describe the structure of an atom.", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" },
      { question: "What is the theory of relativity?", type: "DESCRIPTIVE", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "" }
    ];

    let csvContent = "question,type,optionA,optionB,optionC,optionD,correctAnswer\n";
    questions.forEach(q => {
      const row = [
        `"${q.question.replace(/"/g, '""')}"`,
        q.type,
        `"${q.optionA}"`,
        `"${q.optionB}"`,
        `"${q.optionC}"`,
        `"${q.optionD}"`,
        `"${q.correctAnswer}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    res.header("Content-Type", "text/csv");
    res.attachment("exam_questions_sample.csv");
    return res.send(csvContent);
  } catch (error) {
    console.error("Error generating sample CSV:", error);
    res.status(500).json({ success: false, message: "Error generating sample CSV" });
  }
};

/**
 * Finalize a student submission — locks it as EVALUATED
 * Sets all auto-graded questions to EVALUATED status if not already set,
 * and marks the overall submission as EVALUATED
 */
exports.finalizeSubmission = async (req, res) => {
  try {
    const { timetableId, studentId } = req.params;

    const submission = await ExamEntry.findOne({
      timetableId,
      studentId,
      type: 'SUBMISSION'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Mark any auto-graded questions that are still SUBMITTED as EVALUATED
    let total = 0;
    submission.questions.forEach(q => {
      if ((q.questionType === 'MCQ' || q.questionType === 'TF') && q.status !== 'EVALUATED') {
        q.status = 'EVALUATED';
      }
      total += (q.marksObtained || 0);
    });

    submission.overallStatus = 'EVALUATED';
    submission.totalMarksObtained = total;
    await submission.save();

    res.status(200).json({ success: true, message: 'Submission finalized successfully' });
  } catch (error) {
    console.error('Error finalizing submission:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
/**
 * Submit all evaluated submissions to Admin for a timetable
 */
exports.submitCSVExamsToAdmin = async (req, res) => {
  try {
    const { timetableId } = req.params;

    // Update all submissions that are currently 'EVALUATED' to 'SUBMITTED_TO_ADMIN'
    const result = await ExamEntry.updateMany(
      { 
        timetableId, 
        type: 'SUBMISSION',
        overallStatus: 'EVALUATED'
      },
      {
        $set: { overallStatus: 'SUBMITTED_TO_ADMIN' }
      }
    );

    res.status(200).json({
      success: true,
      message: `Successfully sent ${result.modifiedCount} evaluations to Admin.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error submitting to admin:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
