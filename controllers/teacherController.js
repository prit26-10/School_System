const User = require("../models/User");
const Mark = require("../models/Mark");
const Quiz = require("../models/Quiz");
const SessionSlot = require("../models/SessionSlot");
const TeacherAvailability = require("../models/TeacherAvailability");
const PublicHoliday = require("../models/PublicHoliday");
const ClassSubject = require("../models/ClassSubject");
const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../config/emailTemplates");

/**
 * Helper function to normalize class value
 * Extracts numeric class value from various formats ("11", "Class 11", "class 11")
 * @param {string} classValue - The class value to normalize
 * @returns {string|null} - The normalized numeric class value or null
 */
function normalizeClassValue(classValue) {
  if (!classValue) return null;
  const str = String(classValue).trim();
  // Extract numeric part from strings like "Class 11", "class 11", "11"
  const match = str.match(/(\d+)/);
  return match ? match[1] : str;
}

/**
 * Helper function to check if a student's class matches any of the assigned classes
 * @param {string} studentClass - The student's class value
 * @param {Array} assignedClasses - Array of assigned ClassSubject objects
 * @returns {boolean} - True if class matches any assigned class
 */
function isClassMatch(studentClass, assignedClasses) {
  if (!studentClass) return false;
  const normalizedStudentClass = normalizeClassValue(studentClass);
  return assignedClasses.some(cls => {
    const normalizedClassValue = normalizeClassValue(cls.class);
    return normalizedStudentClass === normalizedClassValue;
  });
}

exports.getTeacherStats = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const teacherMongoId = req.user._id.toString();

    // Get all classes where the teacher is assigned
    const assignedClasses = await ClassSubject.find({
      $or: [
        { "assignedTeacher.teacherId": teacherMongoId },
        { "subjects.assignedTeacher.teacherId": teacherMongoId },
        { "timetable.teacherId": teacherMongoId }
      ]
    }).lean();

    if (!assignedClasses || assignedClasses.length === 0) {
      return res.json({
        success: true,
        data: {
          totalStudents: 0,
          totalQuizzes: await Quiz.countDocuments({ teacherId }),
          totalSessions: await SessionSlot.countDocuments({ teacherId }),
          totalClasses: 0
        }
      });
    }

    // Get all unique class values assigned to this teacher
    const assignedClassValues = assignedClasses.map(cls => normalizeClassValue(cls.class)).filter(Boolean);

    // Calculate unique subjects assigned to this teacher
    const uniqueSubjects = new Set();
    assignedClasses.forEach(cls => {
      if (cls.subjects) {
        cls.subjects.forEach(sub => {
          if (sub.assignedTeacher && sub.assignedTeacher.teacherId === teacherMongoId) {
            uniqueSubjects.add(sub.name);
          }
        });
      }
      if (cls.timetable) {
        cls.timetable.forEach(t => {
          if (t.teacherId === teacherMongoId) {
            uniqueSubjects.add(t.subjectName);
          }
        });
      }
    });
    
    // Fetch all students and filter by class in JS to avoid Mongoose casting issues
    const allStudents = await User.find({ role: "student" }).select("class studentData").lean();

    // Filter students by class match
    const validStudents = allStudents.filter(s => {
      const studentClass = s.class || s.studentData?.class;
      return isClassMatch(studentClass, assignedClasses);
    });

    const totalQuizzes = await Quiz.countDocuments({ teacherId });
    const totalSessions = await SessionSlot.countDocuments({ teacherId });

    res.json({
      success: true,
      data: {
        totalStudents: validStudents.length,
        totalQuizzes,
        totalSessions,
        totalClasses: assignedClasses.length,
        totalSubjects: uniqueSubjects.size,
        todayAttendance: 95 // Placeholder for now as simple per image
      }
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const teacherMongoId = req.user._id.toString();

    // Get all classes where the teacher is assigned
    const assignedClasses = await ClassSubject.find({
      $or: [
        { "assignedTeacher.teacherId": teacherMongoId },
        { "subjects.assignedTeacher.teacherId": teacherMongoId },
        { "timetable.teacherId": teacherMongoId }
      ]
    }).lean();

    if (!assignedClasses || assignedClasses.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get all unique class values assigned to this teacher
    const assignedClassValues = assignedClasses.map(cls => normalizeClassValue(cls.class)).filter(Boolean);
    
    // Fetch all students and filter by class in JS to avoid Mongoose casting issues
    const allStudents = await User.find({ role: "student" })
      .select("class name email userId profileImage mobileNumber studentData")
      .lean();

    // Filter students by class match
    const filteredStudents = allStudents.filter(s => {
      const studentClass = s.class || s.studentData?.class;
      return isClassMatch(studentClass, assignedClasses);
    });

    // Sort students by class and rollNo
    filteredStudents.sort((a, b) => {
      const classA = a.class || a.studentData?.class || "";
      const classB = b.class || b.studentData?.class || "";
      if (classA !== classB) {
        return String(classA).localeCompare(String(classB), undefined, { numeric: true });
      }
      const rollA = a.studentData?.rollNo || 0;
      const rollB = b.studentData?.rollNo || 0;
      return rollA - rollB;
    });

    res.json({ success: true, data: filteredStudents });
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const studentId = req.params.userId;
    const teacherMongoId = req.user._id.toString();

    // Get all classes where the teacher is assigned
    const assignedClasses = await ClassSubject.find({
      $or: [
        { "assignedTeacher.teacherId": teacherMongoId },
        { "subjects.assignedTeacher.teacherId": teacherMongoId },
        { "timetable.teacherId": teacherMongoId }
      ]
    }).lean();

    if (!assignedClasses || assignedClasses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    // Try to find student by MongoDB _id or userId
    let student = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : new mongoose.Types.ObjectId() },
        { userId: studentId }
      ],
      role: "student"
    }).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Check if student belongs to any of the teacher's assigned classes
    const studentClassMatch = isClassMatch(student.class, assignedClasses);

    if (!studentClassMatch) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    // All student data is now in the User table - no need to fetch from Admission
    const studentObj = student.toObject();
    
    // Build address string from stored fields
    const addressParts = [
      studentObj.streetAddress,
      studentObj.city,
      studentObj.state,
      studentObj.zipCode,
      studentObj.country
    ].filter(Boolean);
    
    studentObj.address = addressParts.join(', ') || null;

    return res.status(200).json({
      success: true,
      message: "Get student successful",
      data: studentObj
    });
  }
  catch (err) {
    console.error("Get student by ID error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
/**
 * Generate the next roll number for a class
 * Roll numbers start from 1 and auto-increment within each class
 * @param {string} className - The class name
 * @returns {number} - The next roll number
 */
async function generateRollNumber(className) {
  try {
    // Find the highest roll number in this class
    const lastStudent = await User.findOne({ 
      role: 'student', 
      class: className,
      rollNo: { $exists: true, $ne: null }
    }).sort({ rollNo: -1 }).lean();
    
    // Return next roll number (start from 1 if no students exist)
    return lastStudent && lastStudent.rollNo ? lastStudent.rollNo + 1 : 1;
  } catch (error) {
    console.error('Error generating roll number:', error);
    return 1;
  }
}

exports.createStudent = async (req, res) => {
  const { userId, name, email, password, age, class: className, city, state, country, mobileNumber, role, timezone, gender, parentName, parentRelationship, parentPhone, dob } = req.body;

  try {
    const exists = await User.findOne({ $or: [{ userId }, { email }] });
    if (exists) {
      return res.status(400).json({ success: false, message: "UserId or Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate roll number for the class
    const rollNo = await generateRollNumber(className);

    const studentData = {
      role: "student",
      userId,
      name,
      email,
      password: hashedPassword,
      age,
      class: className,
      rollNo,
      gender: gender || undefined,
      dob: dob || undefined,
      parentName: parentName || '',
      parentRelationship: parentRelationship || '',
      parentPhone: parentPhone || '',
      city: city || '',
      state: state || '',
      country: country || '',
      mobileNumber: mobileNumber || '',
      timezone: timezone || "Asia/Kolkata",
      teacherId: req.user.id,
      profileImage: req.file ? `/uploads/profiles/${req.file.filename}` : ""
    };

    const student = await User.create(studentData);

    // Send emails to both teacher and student (non-blocking)
    // setImmediate(async () => {
    //   try {
    //     // Get teacher details
    //     const teacher = await User.findById(req.user.id).select('name email');

    //     // Send email to teacher
    //     await sendEmail({
    //       to: teacher.email,
    //       subject: emailTemplates.student_added.teacher.subject,
    //       html: emailTemplates.student_added.teacher.html(teacher.name, name, email)
    //     });

    //     // Send email to student
    //     await sendEmail({
    //       to: email,
    //       subject: emailTemplates.student_added.student.subject,
    //       html: emailTemplates.student_added.student.html(name, teacher.name)
    //     });
    //   } catch (emailErr) {
    //     console.error("Failed to send student addition emails:", emailErr.message);
    //   }
    // });

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: student
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateStudent = async (req, res) => {
  try {
    const { name, email, age, class: className, city, state, country, timezone, mobileNumber } = req.body;
    const studentId = req.params.userId;
    const teacherMongoId = req.user._id.toString();

    // Get all classes where the teacher is assigned
    const assignedClasses = await ClassSubject.find({
      $or: [
        { "assignedTeacher.teacherId": teacherMongoId },
        { "subjects.assignedTeacher.teacherId": teacherMongoId },
        { "timetable.teacherId": teacherMongoId }
      ]
    }).lean();

    if (!assignedClasses || assignedClasses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    // First find the student
    const existingStudent = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : new mongoose.Types.ObjectId() },
        { userId: studentId }
      ],
      role: "student"
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Check if student belongs to any of the teacher's assigned classes
    const studentClassMatch = isClassMatch(existingStudent.class, assignedClasses);
    
    // Also check admission record if exists
    const admission = await Admission.findOne({
      email: existingStudent.email,
      status: "approved"
    }).select("class").lean();
    
    const admissionClassMatch = admission ? isClassMatch(admission.class, assignedClasses) : false;

    if (!studentClassMatch && !admissionClassMatch) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    const update = {};
    if (name) update.name = name;
    if (age !== undefined) update.age = age;
    if (className) update.class = className;
    if (city) update.city = city;
    if (state) update.state = state;
    if (country) update.country = country;
    if (timezone) update.timezone = timezone;
    if (mobileNumber) update.mobileNumber = mobileNumber;
    if (email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: existingStudent._id }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already used by another user"
        });
      }
      update.email = email.toLowerCase().trim();
    }

    if (req.file) {
      update.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    // Update the student
    const student = await User.findByIdAndUpdate(
      existingStudent._id,
      update,
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Student updated successfully",
      data: student
    });
  } catch (err) {
    console.error("Update student error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.userId;
    const teacherMongoId = req.user._id.toString();

    // Get all classes where the teacher is assigned
    const assignedClasses = await ClassSubject.find({
      $or: [
        { "assignedTeacher.teacherId": teacherMongoId },
        { "subjects.assignedTeacher.teacherId": teacherMongoId },
        { "timetable.teacherId": teacherMongoId }
      ]
    }).lean();

    if (!assignedClasses || assignedClasses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    // First find the student
    const student = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : new mongoose.Types.ObjectId() },
        { userId: studentId }
      ],
      role: "student"
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Check if student belongs to any of the teacher's assigned classes
    const studentClassMatch = isClassMatch(student.class, assignedClasses);
    
    // Also check admission record if exists
    const admission = await Admission.findOne({
      email: student.email,
      status: "approved"
    }).select("class").lean();
    
    const admissionClassMatch = admission ? isClassMatch(admission.class, assignedClasses) : false;

    if (!studentClassMatch && !admissionClassMatch) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not in your classes"
      });
    }

    await User.findByIdAndDelete(student._id);

    res.json({
      success: true,
      message: "Student deleted successfully"
    });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getStudentMarks = async (req, res) => {
  try {
    const marks = await Mark.find({
      studentUserId: req.params.userId,
      teacherId: req.user.userId
    });

    res.json({
      success: true,
      data: marks
    });
  } catch (err) {
    console.error("Get student marks error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addMark = async (req, res) => {
  try {
    const { subject, marks } = req.body;
    const userId = req.params.userId;

    const student = await User.findOne({ userId, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const exists = await Mark.findOne({ studentUserId: userId, subject });
    if (exists) {
      return res.status(400).json({
        message: "Marks for this subject are already added"
      });
    }

    const newMark = await Mark.create({
      studentUserId: userId,
      subject,
      marks
    });
    return res.status(201).json(newMark);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMark = async (req, res) => {
  try {
    const mark = await Mark.findById(req.params.id);
    if (!mark) return res.status(404).json({ message: "Mark not found" });

    const update = {};
    if (req.body.subject) update.subject = req.body.subject;
    if (req.body.marks !== undefined) update.marks = req.body.marks;

    const updated = await Mark.findByIdAndUpdate(mark._id, update, {
      new: true
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMark = async (req, res) => {
  try {
    const mark = await Mark.findById(req.params.id);
    if (!mark) return res.status(404).json({ message: "Mark not found" });

    await mark.deleteOne();

    return res.json({ message: "Mark deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const teacher = await User.findOne({
      userId: req.user.userId,
      role: "teacher"
    }).select("-password -__v").lean();

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    const profileData = {
      id: teacher._id,
      employee_id: teacher.userId,
      userId: teacher.userId,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.mobileNumber || "",
      mobileNumber: teacher.mobileNumber || "",
      city: teacher.city || "",
      state: teacher.state || "",
      country: teacher.country || "",
      role: teacher.role,
      profileImage: teacher.profileImage || "",
      created_at: teacher.createdAt,
      updated_at: teacher.updatedAt,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    };

    return res.json({
      success: true,
      data: profileData
    });
  } catch (err) {
    console.error("Get teacher profile error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const update = {};

    if (req.body.name !== undefined) update.name = req.body.name;
    if (req.body.city !== undefined) update.city = req.body.city;
    if (req.body.state !== undefined) update.state = req.body.state;
    if (req.body.country !== undefined) update.country = req.body.country;

    const resolvedPhone = req.body.mobileNumber !== undefined
      ? req.body.mobileNumber
      : req.body.phone;
    if (resolvedPhone !== undefined) update.mobileNumber = resolvedPhone;

    if (req.body.email) {
      const emailExists = await User.findOne({
        email: req.body.email,
        userId: { $ne: userId }
      });

      if (emailExists) {
        return res.status(400).json({
          message: "Email already in use"
        });
      }
      update.email = req.body.email;
    }

    if (req.file) {
      update.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    const teacher = await User.findOneAndUpdate(
      { userId, role: "teacher" },
      update,
      { new: true }
    ).select("-password");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: teacher._id,
        employee_id: teacher.userId,
        userId: teacher.userId,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.mobileNumber || "",
        mobileNumber: teacher.mobileNumber || "",
        city: teacher.city || "",
        state: teacher.state || "",
        country: teacher.country || "",
        role: teacher.role,
        profileImage: teacher.profileImage || "",
        created_at: teacher.createdAt,
        updated_at: teacher.updatedAt,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadStudentsCSV = async (req, res) => {
  try {
    const teacherId = req.user.id;

    let inserted = 0;
    let skipped = req.csvSkippedDetails.length;
    const results = [...req.csvSkippedDetails];

    for (let i = 0; i < req.csvRows.length; i++) {
      const row = req.csvRows[i];

      const alreadyInvalid = req.csvSkippedDetails.find(r => r.row === i + 2);
      if (alreadyInvalid) continue;

      const {
        userId,
        name,
        email,
        password,
        age,
        class: className,
        city,
        state,
        country,
        mobileNumber,
        timezone
      } = row;

      const exists = await User.findOne({
        $or: [{ userId }, { email }]
      });

      if (exists) {
        skipped++;
        results.push({
          row: i + 2,
          userId,
          reasons: ["UserId or Email already exists"]
        });
        continue;
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
          role: "student",
          userId,
          name,
          email,
          password: hashedPassword,
          age,
          class: className,
          city: city || "",
          state: state || "",
          country: country || "",
          mobileNumber,
          timezone: timezone || "Asia/Kolkata",
          teacherId
        });

        inserted++;
      } catch (err) {
        console.error("Error creating student:", err);
        skipped++;
        results.push({
          row: i + 2,
          userId,
          reasons: ["Database error: " + err.message]
        });
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error("Error deleting uploaded file:", err);
    }

    return res.json({
      success: true,
      message: "CSV upload completed",
      total: req.csvRows.length,
      inserted,
      skipped,
      skippedDetails: results
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    // Clean up uploaded file in case of error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting uploaded file:", err);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Error processing CSV: " + error.message
    });
  }
};

exports.getQuizSampleCSV = async (req, res) => {
  try {
    const fields = ["Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer"];
    const data = [
      {
        "Question": "What is the capital of France?",
        "Option A": "London",
        "Option B": "Berlin",
        "Option C": "Paris",
        "Option D": "Madrid",
        "Correct Answer": "C"
      },
      {
        "Question": "Which planet is known as the Red Planet?",
        "Option A": "Mars",
        "Option B": "Venus",
        "Option C": "Jupiter",
        "Option D": "Saturn",
        "Correct Answer": "Mars"
      }
    ];

    const { Parser } = require("json2csv");
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment("quiz_sample.csv");
    return res.send(csv);
  } catch (error) {
    console.error("Get sample CSV error:", error);
    return res.status(500).json({ message: "Error generating sample CSV" });
  }
};

exports.parseQuizCSV = async (req, res) => {
  try {
    const rows = req.csvRows;
    const skipped = req.csvSkippedDetails;

    const questions = rows.map(row => {
      let correctOption = "";
      const validOptions = ["a", "b", "c", "d"];
      const answer = row["Correct Answer"].trim();

      if (validOptions.includes(answer.toLowerCase())) {
        correctOption = answer.toLowerCase();
      } else {
        const opts = [
          row["Option A"],
          row["Option B"],
          row["Option C"],
          row["Option D"]
        ];
        const index = opts.findIndex(o => o.trim().toLowerCase() === answer.toLowerCase());
        if (index !== -1) {
          correctOption = validOptions[index];
        }
      }

      return {
        question: row["Question"],
        options: [
          row["Option A"],
          row["Option B"],
          row["Option C"],
          row["Option D"]
        ],
        correctOption: correctOption
      };
    });

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error("Error deleting file", e);
      }
    }

    return res.json({
      success: true,
      questions: questions,
      skipped: skipped,
      totalParsed: rows.length,
      totalSkipped: skipped.length
    });

  } catch (error) {
    console.error("Parse quiz CSV error:", error);
    return res.status(500).json({ message: "Error parsing CSV" });
  }
};

// Get quiz attempts for a specific quiz
exports.getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.id;

    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID"
      });
    }

    const quiz = await Quiz.findOne({
      _id: quizId,
      teacherId: teacherId
    }).select('title subject class totalMarks');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Include all students belonging to the quiz class
    const className = (quiz.class || "").trim();

    let assignedStudentsQuery = { role: "student" };
    if (className) {
      // tolerate casing / extra spaces (common data issue)
      assignedStudentsQuery.class = new RegExp(`^\\s*${escapeRegex(className)}\\s*$`, "i");
    }

    let assignedStudents = await User.find(assignedStudentsQuery).select("name class").lean();

    const assignedStudentIds = assignedStudents.map((s) => s._id);

    // Latest submission per student counts as "Attempted"
    const marks = await Mark.find({
      quizId,
      teacherId,
      student_id: { $in: assignedStudentIds }
    })
      .populate("student_id", "name")
      .sort({ submissionTime: -1 })
      .lean();

    const attemptedSet = new Set(marks.map(a => a.student_id.toString()));
    const attemptByStudent = {};
    marks.forEach(a => {
      attemptByStudent[a.student_id.toString()] = {
        score: a.marks,
        totalMarks: a.totalMarks,
        attemptedAt: a.submissionTime
      };
    });

    const attempted = [];
    const notAttempted = [];

    assignedStudents.forEach(student => {
      const idStr = student._id.toString();
      const record = {
        studentId: student._id,
        name: student.name,
        class: student.class || "Not Assigned"
      };
      if (attemptedSet.has(idStr)) {
        const a = attemptByStudent[idStr];
        attempted.push({
          ...record,
          score: a.score,
          totalMarks: a.totalMarks,
          attemptedAt: a.attemptedAt
        });
      } else {
        notAttempted.push(record);
      }
    });

    // Sort attempted by attemptedAt desc (most recent first)
    attempted.sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt));

    res.json({
      success: true,
      data: {
        totalStudents: assignedStudents.length,
        attemptedCount: attempted.length,
        notAttemptedCount: notAttempted.length,
        attemptedStudents: attempted,
        notAttemptedStudents: notAttempted
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getHolidays = async (req, res) => {
  try {
    const { academicYear } = req.query;
    if (!academicYear) {
      return res.status(400).json({ success: false, message: "Academic Year is required" });
    }

    const holidays = await PublicHoliday.find({
      academicYear,
      type: "holiday"
    }).sort({ date: 1 });

    res.json({ success: true, data: holidays });
  } catch (err) {
    console.error("Get holidays error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { academicYear } = req.query;
    if (!academicYear) {
      return res.status(400).json({ success: false, message: "Academic Year is required" });
    }

    const events = await PublicHoliday.find({
      academicYear,
      type: "event"
    }).sort({ date: 1 });

    res.json({ success: true, data: events });
  } catch (err) {
    console.error("Get events error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
