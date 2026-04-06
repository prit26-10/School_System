const mongoose = require("mongoose");

const ExamEntrySchema = new mongoose.Schema(
  {
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamTimetable",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["QUESTION", "ANSWER", "SUBMISSION"],
      required: true,
      index: true,
    },

    // Question Fields (for type: QUESTION)
    questionType: {
      type: String,
      enum: ["MCQ", "TF", "DESCRIPTIVE"],
    },
    questionText: {
      type: String,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String, // Correct option index or 'true'/'false'
    },
    maxMarks: {
      type: Number,
      default: 0,
    },

    // Submission Fields (for type: SUBMISSION)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    questions: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId },
        questionText: String,
        questionType: String,
        options: [String],
        correctAnswer: String,
        studentAnswer: String,
        maxMarks: Number,
        marksObtained: { type: Number, default: 0 },
        status: { type: String, enum: ["SUBMITTED", "PENDING", "EVALUATED"], default: "SUBMITTED" },
        feedback: { type: String, default: "" }
      }
    ],
    submissionType: {
      type: String,
      enum: ["MANUAL", "AUTO_PROCTOR", "AUTO_TIMEOUT"],
      default: "MANUAL",
    },
    submissionReason: {
      type: String,
      default: "",
    },
    overallStatus: {
      type: String,
      enum: ["SUBMITTED", "EVALUATED", "SUBMITTED_TO_ADMIN", "PUBLISHED"],
      default: "SUBMITTED"
    },
    totalMarksObtained: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Indexes for performance
ExamEntrySchema.index({ timetableId: 1, type: 1 });
ExamEntrySchema.index({ studentId: 1, timetableId: 1 });

module.exports = mongoose.model("ExamEntry", ExamEntrySchema);
