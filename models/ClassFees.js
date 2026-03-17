const mongoose = require("mongoose");

const ClassFeesSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSubject",
      required: true,
      unique: true,
    },
    tuitionFee: {
      type: Number,
      required: true,
    },
    examFee: {
      type: Number,
      required: true,
    },
    totalFee: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    totalSubjects: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassFees", ClassFeesSchema);
