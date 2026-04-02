const mongoose = require("mongoose");

const BookedSlotSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  bookedByTeacher: {
    type: Boolean,
    default: false
  }
});

const SessionSlotSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    allowedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    title: {
      type: String,
      required: true
    },

    date: {
      type: Date,
      required: true,
      index: true
    },

    sessionDuration: {
      type: Number, 
      required: true,
      default: 60 
    },

    breakDuration: {
      type: Number, 
      required: true,
      default: 10
    },

    bookedSlots: [BookedSlotSchema]
  },
  { timestamps: true }
);

SessionSlotSchema.index(
  { teacherId: 1, title: 1, date: 1 },
  { unique: true }
);
module.exports = mongoose.model("SessionSlot", SessionSlotSchema);