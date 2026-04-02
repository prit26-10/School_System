const mongoose = require("mongoose");

const MarkSchema = new mongoose.Schema({
  studentUserId: { type: String, required: true, index: true }, 
  subject: { type: String, required: true, trim: true },
  marks: { type: Number, required: true, min: 0 },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  // Enhanced quiz tracking fields
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", index: true },
  totalMarks: { type: Number, min: 0 },
  answers: [{
    questionIndex: Number,
    selectedOption: Number,
    selectedAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean
  }],
  submissionTime: { type: Date, default: Date.now, index: true },
  quizTitle: { type: String, trim: true },
  quizClass: { type: String, trim: true }
}, { timestamps: true });

// Compound indexes for efficient queries
MarkSchema.index({ quizId: 1, studentId: 1 }, { unique: true });
MarkSchema.index({ teacherId: 1, quizId: 1 });
MarkSchema.index({ studentUserId: 1, submissionTime: -1 });

module.exports = mongoose.model("Mark", MarkSchema);
