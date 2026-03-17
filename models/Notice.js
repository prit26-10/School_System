const mongoose = require("mongoose");

const NoticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["General", "Academic", "Event", "Emergency"],
      required: true,
    },
    recipientGroup: {
      type: String,
      enum: ["All", "Students", "Teachers"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for backward compatibility with admin notices
    },
    createdByRole: {
      type: String,
      enum: ["admin", "teacher"],
      default: "admin", // Default to admin for backward compatibility
    },
    targetClass: {
      type: String,
      required: false, // Optional, "All" or empty means all classes in recipientGroup
    },
    target: {
      type: String,
      enum: ["all_students", "specific_class", "teachers", "all_users"],
      required: false,
    },
    class_id: {
      type: String,
      required: false,
    },
    date: {
        type: Date,
        default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notice", NoticeSchema);
