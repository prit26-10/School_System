const mongoose = require("mongoose");

const TeacherApplicationSchema = new mongoose.Schema({
  fullName: {
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
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String
  },
  maritalStatus: {
    type: String,
    enum: ["single", "married", "divorced", "widowed"]
  },
  position: {
    type: String,
    required: true,
    enum: ["teacher", "principal", "vice-principal", "coordinator", "counselor", "librarian"]
  },
  department: {
    type: String,
    enum: ["mathematics", "science", "english", "history", "geography", "physics", "chemistry", "biology", "computer", "arts", "music", "physical-education"]
  },
  experience: {
    type: String,
    required: true,
    enum: ["0-1", "1-3", "3-5", "5-10", "10+"]
  },
  qualification: {
    type: String,
    required: true,
    enum: ["high-school", "diploma", "bachelors", "masters", "phd"]
  },
  university: {
    type: String,
    required: true
  },
  yearPassing: {
    type: Number,
    required: true
  },
  additionalQualification: String,
  additionalInstitution: String,
  percentage: String,
  previousExperience: String,
  skills: String,
  streetAddress: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  timezone: {
    type: String,
    default: "Asia/Kolkata"
  },
  resume: String,
  coverLetter: String,
  certificates: [String],
  profilePhoto: String,
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

function generateApplicationId() {
  return 'TAPP-' + Date.now().toString(36).toUpperCase();
}

module.exports = mongoose.model("TeacherApplication", TeacherApplicationSchema);
