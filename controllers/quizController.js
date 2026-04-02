const Quiz = require("../models/Quiz");
const User = require("../models/User");
const Mark = require("../models/Mark");

exports.createQuiz = async (req, res) => {
  try {
    const { 
      title, 
      subject, 
      class: studentClass, 
      questions = [], 
      startTime, 
      endTime, 
      duration, 
      status = 'draft' 
    } = req.body;

    // If status is 'published', validate required fields
    if (status === 'published') {
      if (!questions || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Published quizzes must have at least one question"
        });
      }

      if (!studentClass) {
        return res.status(400).json({
          success: false,
          message: "Class is required for published quizzes"
        });
      }
    }

    const quiz = await Quiz.create({
      title: status === 'draft' ? (title || "Untitled Quiz") : title,
      subject: status === 'draft' ? (subject || "") : subject,
      class: status === 'draft' ? (studentClass || "") : studentClass,
      questions,
      totalMarks: questions.length,
      itemOffset: 0,
      startTime: startTime || null,
      endTime: endTime || null,
      duration: duration || null,
      teacherId: req.user.id,
      status
    });

    res.status(201).json({
      success: true,
      message: `Quiz ${status === 'draft' ? 'draft' : ''} created successfully`,
      quiz
    });
  } catch (err) {
    console.error('Error creating quiz:', err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

exports.getMyQuizzes = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { teacherId: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const quizzes = await Quiz.find(query)
      .select("-__v")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: quizzes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user.id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    res.json({
      success: true,
      data: quiz
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user.id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Server-side validation: Check if published quiz can be edited
    if (quiz.status === 'published') {
      const now = new Date();
      const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
      
      if (startTime && startTime <= now) {
        return res.status(403).json({
          success: false,
          message: "Cannot edit published quiz after start time"
        });
      }
    }

    const { 
      title, 
      subject, 
      class: studentClass, 
      questions, 
      startTime, 
      endTime, 
      duration,
      status
    } = req.body;

    // If updating to published, validate required fields
    if (status === 'published' || (status === undefined && quiz.status === 'draft' && !req.body.status)) {
      if ((questions || quiz.questions).length === 0) {
        return res.status(400).json({
          success: false,
          message: "Published quizzes must have at least one question"
        });
      }

      if (!studentClass && !quiz.class) {
        return res.status(400).json({
          success: false,
          message: "Class is required for published quizzes"
        });
      }
    }

    // Update fields if provided
    if (title !== undefined) quiz.title = title;
    if (subject !== undefined) quiz.subject = subject;
    if (studentClass !== undefined) quiz.class = studentClass;
    if (startTime !== undefined) quiz.startTime = startTime;
    if (endTime !== undefined) quiz.endTime = endTime;
    if (duration !== undefined) quiz.duration = duration;
    if (status) quiz.status = status;

    if (questions !== undefined) {
      quiz.questions = questions;
      quiz.totalMarks = questions.length;
    }

    await quiz.save();

    res.json({
      success: true,
      message: `Quiz ${quiz.status === 'draft' ? 'draft ' : ''}updated successfully`,
      quiz
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.updateQuizQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const { question, options, correctOption } = req.body;

    const quiz = await Quiz.findOne({
      _id: quizId,
      teacherId: req.user.id
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Server-side validation: Check if published quiz can be edited
    if (quiz.status === 'published') {
      const now = new Date();
      const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
      
      if (startTime && startTime <= now) {
        return res.status(403).json({
          success: false,
          message: "Cannot edit published quiz after start time"
        });
      }
    }

    const ques = quiz.questions.id(questionId);

    if (!ques) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (question) ques.question = question;
    if (options) ques.options = options;
    if (correctOption !== undefined) ques.correctOption = correctOption;

    await quiz.save();

    res.json({
      message: "Question updated successfully",
      question: ques
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.user.id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    res.json({
      success: true,
      message: "Quiz deleted successfully"
    });
  } catch (err) {
    console.error('Error deleting quiz:', err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.getAvailableQuizzes = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("teacherId class");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (!student.teacherId) {
      return res.status(400).json({
        success: false,
        message: "Teacher not assigned to this student"
      });
    }

    // Fetch quizzes only for the student's class and teacher (filter by class so students cannot see other class quizzes)
    const query = {
      teacherId: student.teacherId,
      status: { $ne: "draft" }
    };
    if (student.class) {
      query.class = student.class;
    }
    const quizzes = await Quiz.find(query)
      .select("-__v -questions.correctOption")
      .sort({ createdAt: -1 });

    const quizIds = quizzes.map((q) => q._id);
    const submittedMarks = await Mark.find({
      student_id: req.user.id,
      quizId: { $in: quizIds }
    })
      .select("quizId marks totalMarks submissionTime")
      .lean();

    const markByQuizId = {};
    submittedMarks.forEach((m) => {
      markByQuizId[m.quizId.toString()] = m;
    });

    const quizzesWithDetails = quizzes.map((quiz) => {
      const quizIdStr = quiz._id.toString();
      const submission = markByQuizId[quizIdStr];
      const alreadySubmitted = !!submission;

      return {
        _id: quiz._id,
        title: quiz.title || 'Untitled Quiz',
        subject: quiz.subject || 'General Knowledge',
        class: quiz.class || student.class || 'Not Assigned',
        description: quiz.description || `Test your knowledge in ${quiz.subject || 'this subject'}`,
        duration: quiz.duration || 30,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        status: quiz.status === 'published' ? 'ACTIVE' : 'DRAFT',
        questionCount: quiz.questions ? quiz.questions.length : 0,
        totalMarks: quiz.totalMarks || (quiz.questions ? quiz.questions.length : 0),
        createdAt: quiz.createdAt,
        alreadySubmitted,
        ...(alreadySubmitted && {
          obtainedMarks: submission.marks,
          submissionTotalMarks: submission.totalMarks,
          submissionTime: submission.submissionTime
        })
      };
    });

    res.json({
      success: true,
      data: quizzesWithDetails
    });
  } catch (err) {
    console.error("Error getting available quizzes:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

