const mongoose = require("mongoose");

const ClassFeesSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSubject",
      required: true,
      unique: true,
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
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassFees", ClassFeesSchema);
