const mongoose = require("mongoose");

const AdmissionSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: true
  },
  class: {
    type: String,
    required: true
  },
  studentEmail: String,
  contactNumber: String,
  parentName: {
    type: String,
    required: true
  },
  relationship: {
    type: String,
    enum: ["father", "mother", "guardian"],
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  occupation: String,
  streetAddress: String,
  city: String,
  state: String,
  zipCode: String,
  country: String,
  timezone: {
    type: String,
    default: "Asia/Kolkata"
  },
  studentPhoto: String,
  birthCertificate: String,
  previousMarksheet: String,
  transferCertificate: String,
  termsAccepted: {
    type: Boolean,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  applicationId: {
    type: String,
    unique: true
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectionReason: String
}, { timestamps: true });

module.exports = mongoose.model("Admission", AdmissionSchema);
