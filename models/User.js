const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "teacher"],
      default: "student"
    },
    
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
        
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    age: {
      type: Number
    },

    class: {
      type: String
    },

    rollNo: {
      type: Number
    },

    // Student-specific fields from admission
    dob: {
      type: Date
    },
    
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    
    // Parent/Guardian information
    parentName: {
      type: String,
      default: ""
    },
    
    parentRelationship: {
      type: String,
      enum: ["father", "mother", "guardian", ""],
      default: ""
    },
    
    parentPhone: {
      type: String,
      default: ""
    },
    
    parentEmail: {
      type: String,
      default: ""
    },
    
    // Address fields
    streetAddress: {
      type: String,
      default: ""
    },
    
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    country: { type: String, default: "" },
    
    profileImage: { type: String, default: "" },
    mobileNumber: { type: String, default: "" },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    // Track admission source
    admissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admission",
      default: null
    },
    
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    }
  },
  { timestamps: true }
);

// Compound index for unique roll numbers within a class
UserSchema.index({ class: 1, rollNo: 1 }, { unique: true, partialFilterExpression: { rollNo: { $exists: true } } });
module.exports = mongoose.model("User", UserSchema);
