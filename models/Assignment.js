const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    studentUserId: {
        type: String,
        required: true
    },
    submissionDate: {
        type: Date,
        default: Date.now
    },
    fileUrl: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    marks: {
        type: Number,
        default: null,
        min: 0
    },
    totalMarks: {
        type: Number,
        default: 100
    },
    feedback: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["submitted", "late", "evaluated", "published"],
        default: "submitted"
    },
    evaluatedAt: {
        type: Date
    },
    evaluatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    publishedAt: {
        type: Date
    }
}, { _id: true, timestamps: true });

const AssignmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    class: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    teacherName: {
        type: String,
        required: true
    },
    deadline: {
        type: Date,
        required: true
    },
    fileUrl: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    totalMarks: {
        type: Number,
        default: 100,
        min: 1
    },
    status: {
        type: String,
        enum: ["draft", "published", "closed"],
        default: "published"
    },
    submissions: [SubmissionSchema],
    allowLateSubmission: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Indexes for efficient queries
AssignmentSchema.index({ teacherId: 1, createdAt: -1 });
AssignmentSchema.index({ class: 1, subject: 1 });
AssignmentSchema.index({ deadline: 1 });

module.exports = mongoose.model("Assignment", AssignmentSchema);
