const ExamTimetable = require("../../models/ExamTimetable");
const Exam = require("../../models/Exam");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
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
