const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null, 
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

SessionSchema.index({ teacherId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model("Session", SessionSchema);
