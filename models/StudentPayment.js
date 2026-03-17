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
    dueAmount: {
      type: Number,
      required: true,
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
        enum: ["online", "bank_transfer"],
        default: "online",
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

// Calculate due amount before saving
StudentPaymentSchema.pre('save', function(next) {
  // Make sure next is a function
  if (typeof next !== 'function') {
    console.error('Pre-save hook: next is not a function');
    return;
  }
  
  if (this.isModified('paidAmount')) {
    this.dueAmount = this.totalFees - this.paidAmount;
    this.lastPaymentDate = new Date();
    
    // Update payment status
    if (this.paidAmount >= this.totalFees) {
      this.paymentStatus = "paid";
    } else {
      this.paymentStatus = "pending";
    }
  }
  next();
});

module.exports = mongoose.model("StudentPayment", StudentPaymentSchema);
