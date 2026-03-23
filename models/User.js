const mongoose = require("mongoose");

// Student-specific schema
const StudentSchema = new mongoose.Schema({
  class: {
    type: Number,
    required: true
  },
  rollNo: {
    type: Number
  },
  dob: {
    type: Date
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"]
  },
  parentDetails: {
    name: String,
    relationship: {
      type: String,
      enum: ["father", "mother", "guardian"]
    },
    phone: String,
    email: String
  },
  streetAddress: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  zipCode: {
    type: String
  },
  country: {
    type: String
  },
  admissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admission"
  }
}, { _id: false });

// Teacher-specific schema
const TeacherSchema = new mongoose.Schema({
  department: {
    type: String
  },
  qualification: {
    type: String
  },
  experience: {
    type: String
  },
  employeeId: {
    type: String
  },
  streetAddress: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  zipCode: {
    type: String
  },
  country: {
    type: String
  }
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "teacher"],
      required: true
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

    profileImage: {
      type: String
    },
    
    mobileNumber: {
      type: String
    },
    
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },

    // Role-specific data
    studentData: {
      type: StudentSchema,
      default: function() { return this.role === 'student' ? {} : undefined; }
    },
    
    teacherData: {
      type: TeacherSchema,
      default: function() { return this.role === 'teacher' ? {} : undefined; }
    }
  },
  { timestamps: true }
);

// Compound index for unique roll numbers within a class
UserSchema.index({ "studentData.class": 1, "studentData.rollNo": 1 }, { 
  unique: true, 
  partialFilterExpression: { 
    role: "student", 
    "studentData.rollNo": { $exists: true, $ne: null } 
  } 
});

// Virtual fields for backward compatibility
UserSchema.virtual('class').get(function() {
  return this.role === 'student' ? this.studentData?.class : undefined;
});

UserSchema.virtual('rollNo').get(function() {
  return this.role === 'student' ? this.studentData?.rollNo : undefined;
});

UserSchema.virtual('dob').get(function() {
  return this.role === 'student' ? this.studentData?.dob : undefined;
});

UserSchema.virtual('gender').get(function() {
  return this.role === 'student' ? this.studentData?.gender : undefined;
});

UserSchema.virtual('parentName').get(function() {
  return this.role === 'student' ? this.studentData?.parentDetails?.name : undefined;
});

UserSchema.virtual('parentRelationship').get(function() {
  return this.role === 'student' ? this.studentData?.parentDetails?.relationship : undefined;
});

UserSchema.virtual('parentPhone').get(function() {
  return this.role === 'student' ? this.studentData?.parentDetails?.phone : undefined;
});

UserSchema.virtual('parentEmail').get(function() {
  return this.role === 'student' ? this.studentData?.parentDetails?.email : undefined;
});

UserSchema.virtual('streetAddress').get(function() {
  if (this.role === 'student') return this.studentData?.streetAddress;
  if (this.role === 'teacher') return this.teacherData?.streetAddress;
  return undefined;
});

UserSchema.virtual('city').get(function() {
  if (this.role === 'student') return this.studentData?.city;
  if (this.role === 'teacher') return this.teacherData?.city;
  return undefined;
});

UserSchema.virtual('state').get(function() {
  if (this.role === 'student') return this.studentData?.state;
  if (this.role === 'teacher') return this.teacherData?.state;
  return undefined;
});

UserSchema.virtual('zipCode').get(function() {
  if (this.role === 'student') return this.studentData?.zipCode;
  if (this.role === 'teacher') return this.teacherData?.zipCode;
  return undefined;
});

UserSchema.virtual('country').get(function() {
  if (this.role === 'student') return this.studentData?.country;
  if (this.role === 'teacher') return this.teacherData?.country;
  return undefined;
});

UserSchema.virtual('admissionId').get(function() {
  return this.role === 'student' ? this.studentData?.admissionId : undefined;
});

// Teacher virtuals
UserSchema.virtual('department').get(function() {
  return this.role === 'teacher' ? this.teacherData?.department : undefined;
});

UserSchema.virtual('qualification').get(function() {
  return this.role === 'teacher' ? this.teacherData?.qualification : undefined;
});

UserSchema.virtual('experience').get(function() {
  return this.role === 'teacher' ? this.teacherData?.experience : undefined;
});

UserSchema.virtual('employeeId').get(function() {
  return this.role === 'teacher' ? this.teacherData?.employeeId : undefined;
});

// Ensure virtuals are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", UserSchema);
