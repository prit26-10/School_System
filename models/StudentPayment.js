const mongoose = require("mongoose");

const StudentPaymentSchema = new mongoose.Schema(
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
    totalFees: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    lastPaymentDate: {
      type: Date,
    },
    razorpayOrderId: {
      type: String,
    },
    paymentHistory: [{
      amount: {
        type: Number,
        required: true,
      },
      paymentDate: {
        type: Date,
        default: Date.now,
      },
      paymentMethod: {
        type: String,
        enum: ["online", "bank_transfer", "razorpay"],
        default: "online",
      },
      razorpayPaymentId: {
        type: String,
      },
      razorpayOrderId: {
        type: String,
      },
      razorpaySignature: {
        type: String,
      },
      receiptNumber: {
        type: String,
        required: true,
      },
      notes: {
        type: String,
        default: "",
      },
    }],
    academicYear: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Calculate payment status before saving
StudentPaymentSchema.pre('save', function() {
  // Check if paidAmount was modified
  if (this.isModified('paidAmount')) {
    this.lastPaymentDate = new Date();
    
    // Update payment status (Full payment only)
    if (this.paidAmount >= this.totalFees) {
      this.paymentStatus = "paid";
    } else {
      this.paymentStatus = "pending";
    }
  }
});

module.exports = mongoose.model("StudentPayment", StudentPaymentSchema);
