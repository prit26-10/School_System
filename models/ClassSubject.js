const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    credits: {
        type: Number,
        default: 3,
    },
    assignedTeacher: {
        teacherId: {
            type: String,
            required: false
        },
        teacherName: {
            type: String,
            required: false
        },
        teacherEmail: {
            type: String,
            required: false
        },
        assignedAt: {
            type: Date,
            default: Date.now
        }
    }
}, { _id: true });

const ClassSubjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    class: {
        type: Number,
        required: true,
    },
    subjects: [SubjectSchema],
    assignedTeacher: {
        teacherId: {
            type: String,
            required: false
        },
        teacherName: {
            type: String,
            required: false
        },
        teacherEmail: {
            type: String,
            required: false
        },
        assignedAt: {
            type: Date,
            default: Date.now
        }
    }
}, { timestamps: true });

// Add timetable field to schema
ClassSubjectSchema.add({
    timetable: [{
        day: { type: String },
        startTime: String,
        endTime: String,
        subjectName: String,
        subjectCode: String,
        teacherName: String,
        teacherId: String
    }]
});

// Ensure unique class
ClassSubjectSchema.index({ class: 1 }, { unique: true });

module.exports = mongoose.model("ClassSubject", ClassSubjectSchema);
