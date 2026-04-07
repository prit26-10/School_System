const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["present", "absent", "late"],
        default: "present"
    }
});

const LiveSessionSchema = new mongoose.Schema(
    {
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
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSubject",
            required: true
        },
        className: {
            type: String,
            required: true
        },
        subjectName: {
            type: String,
            required: true
        },
        subjectCode: {
            type: String,
            default: ""
        },
        scheduledDate: {
            type: Date,
            required: true
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        },
        meetingLink: {
            type: String,
            required: true
        },
        hostLink: {
            type: String,
            default: ""
        },
        meetingId: {
            type: String,
            default: ""
        },
        meetingPassword: {
            type: String,
            default: ""
        },
        platform: {
            type: String,
            enum: ["zoom", "google_meet", "teams", "custom"],
            default: "zoom"
        },
        status: {
            type: String,
            enum: ["scheduled", "live", "ended", "cancelled", "completed"],
            default: "scheduled"
        },
        isActive: {
            type: Boolean,
            default: true
        },
        startedAt: {
            type: Date,
            default: null
        },
        endedAt: {
            type: Date,
            default: null
        },
        attendance: [AttendanceSchema],
        notificationsSent: {
            type: Boolean,
            default: false
        },
        notificationSentAt: {
            type: Date,
            default: null
        },
        description: {
            type: String,
            default: ""
        },
        recordingUrl: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

// Index for efficient queries
LiveSessionSchema.index({ teacherId: 1, scheduledDate: 1 });
LiveSessionSchema.index({ classId: 1, status: 1 });
LiveSessionSchema.index({ scheduledDate: 1, status: 1 });

module.exports = mongoose.model("LiveSession", LiveSessionSchema);
