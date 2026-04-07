const mongoose = require("mongoose");

const FeePaymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSubject",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paymentId: {
      type: String, // Payment Gateway Session/Order ID
      required: true,
      unique: true,
    },
    transactionId: {
      type: String, // Final transaction/capture ID
    },
    paymentMethod: {
      type: String,
      default: "stripe",
    },
    payerEmail: {
      type: String,
    },
    payerName: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeePayment", FeePaymentSchema);
