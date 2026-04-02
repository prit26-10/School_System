const mongoose = require("mongoose");

const ExamTimetableSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    class: {
      type: Number,
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    teacherId: {
      type: String, // Storing as String to match ClassSubject's teacherId format
      required: false,
    },
    questionPaper: {
      type: String,
      default: null,
    },
    paperUploadStatus: {
      type: String,
      enum: ["pending", "uploaded"],
      default: "pending",
    },
    questions: [
      {
        questionText: { type: String, required: true },
        maxMarks: { type: Number, required: true }
      }
    ],
    submissions: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        studentName: { type: String, required: true },
        studentUserId: { type: String, required: true },
        submissionDate: { type: Date, default: Date.now },
        fileUrl: { type: String, default: null }, // Link to answer sheet
        fileName: { type: String, default: null },
        answers: [
          {
            questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
            answerText: { type: String, required: true },
            marksGiven: { type: Number, default: null }
          }
        ],
        marks: { type: Number, default: null, min: 0 },
        totalMarks: { type: Number, default: 100 },
        feedback: { type: String, default: "" },
        status: { 
          type: String, 
          enum: ["submitted", "evaluated", "published"], 
          default: "submitted" 
        }
      }
    ]
  },
  { timestamps: true }
);

// Unique index to prevent same subject twice for one class in one exam
ExamTimetableSchema.index({ examId: 1, class: 1, subjectCode: 1 }, { unique: true });

module.exports = mongoose.model("ExamTimetable", ExamTimetableSchema);
