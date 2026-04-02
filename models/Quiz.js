const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    required: true,
    validate: v => v.length === 4
  },
  correctOption: {
    type: String,
    enum: ["a", "b", "c", "d"],
    required: true
  }

});

const QuizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    class: {
      type: String,
      required: true,
      trim: true
    },
    startTime: {
      type: Date
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    questions: {
      type: [QuestionSchema],
      required: true
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", QuizSchema);
