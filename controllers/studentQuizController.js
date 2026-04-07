const Quiz = require("../models/Quiz");
const Mark = require("../models/Mark");
const User = require("../models/User");

exports.getQuizForStudent = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select("-questions.correctOption");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Prevent access to draft quizzes
    if (quiz.status === "draft") {
      return res.status(403).json({ message: "This quiz is not available yet" });
    }

    // Time validation
    const now = new Date();
    const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
    const endTime = quiz.endTime ? new Date(quiz.endTime) : null;

    // Check if quiz hasn't started yet
    if (startTime && now < startTime) {
      return res.status(403).json({ 
        message: "Quiz has not started yet",
        status: "upcoming",
        startTime: startTime,
        canStart: false
      });
    }

    // Check if quiz has expired
    if (endTime && now > endTime) {
      return res.status(403).json({ 
        message: "Quiz has expired",
        status: "expired",
        endTime: endTime,
        canStart: false
      });
    }

    const student = await User.findOne({
      userId: req.user.userId,
      role: "student"
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (String(quiz.teacherId) !== String(student.teacherId)) {
      return res.status(403).json({
        message: "You are not allowed to access this quiz"
      });
    }

    // Check if student already attempted this quiz
    const existingAttempt = await Mark.findOne({
      student_id: req.user.id,
      quizId: quiz._id
    });

    res.json({
      ...quiz.toObject(),
      canStart: true,
      status: "available",
      alreadyAttempted: !!existingAttempt,
      existingAttempt: existingAttempt ? {
        score: existingAttempt.marks,
        totalMarks: existingAttempt.totalMarks,
        attemptedAt: existingAttempt.submissionTime
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Prevent submission to draft quizzes
    if (quiz.status === "draft") {
      return res.status(403).json({ message: "This quiz is not available for submission" });
    }

    // Time validation for submission
    const now = new Date();
    const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
    const endTime = quiz.endTime ? new Date(quiz.endTime) : null;

    // Check if quiz hasn't started yet
    if (startTime && now < startTime) {
      return res.status(403).json({ 
        message: "Quiz has not started yet",
        status: "upcoming"
      });
    }

    // Check if quiz has expired
    if (endTime && now > endTime) {
      return res.status(403).json({ 
        message: "Quiz has expired",
        status: "expired"
      });
    }

    const student = await User.findOne({
      _id: req.user.id,
      role: "student"
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (String(quiz.teacherId) !== String(student.teacherId)) {
      return res.status(403).json({
        message: "You are not allowed to submit this quiz"
      });
    }

    // Check if student already attempted this quiz
    const existingAttempt = await Mark.findOne({
      student_id: req.user.id,
      quizId: quiz._id
    });

    if (existingAttempt) {
      return res.status(400).json({ 
        message: "Quiz already submitted",
        alreadyAttempted: true,
        submissionTime: existingAttempt.submissionTime
      });
    }

    let score = 0;
    const optionMap = ["a", "b", "c", "d"];
    const detailedAnswers = [];
    
    quiz.questions.forEach((q, index) => {
      const ans = answers[index];
      const studentAnswer = (ans >= 0 && ans <= 3) ? optionMap[ans] : undefined;
      const isCorrect = studentAnswer === q.correctOption;
      
      if (isCorrect) {
        score++;
      }
      
      detailedAnswers.push({
        questionIndex: index,
        selectedOption: answers[index],
        selectedAnswer: studentAnswer,
        correctAnswer: q.correctOption,
        isCorrect: isCorrect
      });
    });

    await Mark.create({
      studentUserId: req.user.userId,
      subject: quiz.subject,
      marks: score,
      student_id: req.user.id,
      teacherId: quiz.teacherId,
      // Enhanced quiz tracking fields
      quizId: quiz._id,
      totalMarks: quiz.totalMarks,
      answers: detailedAnswers,
      submissionTime: new Date(),
      quizTitle: quiz.title,
      quizClass: quiz.class
    });

    res.json({
      message: "Quiz submitted successfully",
      totalMarks: quiz.totalMarks,
      obtainedMarks: score,
      student_id: req.user.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
