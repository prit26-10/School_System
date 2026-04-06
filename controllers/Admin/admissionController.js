const Admission = require("../../models/Admission");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const sendEmail = require("../../utils/sendEmail");
const { generateRandomPassword } = require("../../utils/passwordUtils");

function generateApplicationId() {
  return 'APP-' + Date.now().toString(36).toUpperCase();
}

exports.submitApplication = async (req, res) => {
  try {
    const {
      fullName,
      dob,
      gender,
      class: studentClass,
      studentEmail,
      contactNumber,
      parentName,
      relationship,
      phone,
      email,
      occupation,
      streetAddress,
      city,
      state,
      zipCode,
      country,
      timezone,
      studentPhoto,
      birthCertificate,
      previousMarksheet,
      transferCertificate,
      termsAccepted
    } = req.body;

    const numericClass = studentClass ? parseInt(studentClass.toString().replace(/[^0-9]/g, '')) : undefined;

    // Check for duplicate parent email
    const existingApplication = await Admission.findOne({ email: email.toLowerCase() });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "An application with this parent email already exists"
      });
    }

    // Check for duplicate student email if provided
    if (studentEmail) {
      const existingStudentEmail = await Admission.findOne({ studentEmail: studentEmail.toLowerCase() });
      if (existingStudentEmail) {
        return res.status(400).json({
          success: false,
          message: "An application with this student email already exists"
        });
      }
    }

    const applicationId = generateApplicationId();

    const admission = new Admission({
      studentName: fullName,
      dob: new Date(dob),
      gender,
      class: numericClass,
      studentEmail,
      contactNumber,
      parentName,
      relationship,
      phone,
      email: email.toLowerCase(),
      occupation,
      streetAddress,
      city,
      state,
      zipCode,
      country,
      timezone: timezone || "Asia/Kolkata",
      studentPhoto,
      birthCertificate,
      previousMarksheet,
      transferCertificate,
      termsAccepted,
      status: "pending",
      applicationId
    });

    await admission.save();

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      applicationId
    });
  } catch (error) {
    console.error("Admission submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getApplicationStatus = async (req, res) => {
  try {
    const application = await Admission.findOne({ applicationId: req.params.applicationId })
      .select("applicationId status createdAt studentName email");

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    res.json({
      success: true,
      data: {
        applicationId: application.applicationId,
        status: application.status,
        submittedAt: application.createdAt,
        name: application.studentName,
        email: application.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllApplications = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { studentName: searchRegex },
        { email: searchRegex },
        { applicationId: searchRegex }
      ];
    }

    const applications = await Admission.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Admission.countDocuments(filter);

    res.json({
      success: true,
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, applications: [], message: 'Server error' });
  }
};

exports.getApplicationCounts = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      Admission.countDocuments({ status: 'pending' }),
      Admission.countDocuments({ status: 'approved' }),
      Admission.countDocuments({ status: 'rejected' })
    ]);

    res.json({
      success: true,
      pending,
      approved,
      rejected,
      total: pending + approved + rejected
    });
  } catch (error) {
    res.status(500).json({ success: false, pending: 0, approved: 0, rejected: 0 });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Admission.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({
      success: true,
      application
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
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
    // Find the highest roll number in this class using the new schema
    const lastStudent = await User.findOne({ 
      role: 'student',
      'studentData.class': className,
      'studentData.rollNo': { $exists: true, $ne: null }
    }).sort({ 'studentData.rollNo': -1 }).lean();
    
    // Return next roll number (start from 1 if no students exist)
    return lastStudent && lastStudent.studentData?.rollNo ? lastStudent.studentData.rollNo + 1 : 1;
  } catch (error) {
    console.error('Error generating roll number:', error);
    return 1;
  }
}

exports.approveApplication = async (req, res) => {
  try {
    console.log('Approving application:', req.params.id);
    const application = await Admission.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Application already approved' });
    }

    const studentEmail = application.studentEmail || application.email;
    const parentEmail = application.email;

    if (!studentEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot approve application: No student email provided' 
      });
    }

    // Check if user with student email already exists
    let user = await User.findOne({ email: studentEmail.toLowerCase() });
    let userExisted = false;
    let randomPassword = "";

    if (!user) {
      const numericClass = application.class ? parseInt(application.class.toString().replace(/[^0-9]/g, '')) : undefined;
      if (!numericClass) {
        return res.status(400).json({ success: false, message: 'Invalid class format for student' });
      }

      const rollNo = await generateRollNumber(numericClass);
      randomPassword = generateRandomPassword(8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const userId = 'STU-' + Date.now().toString(36).toUpperCase();

      user = await User.create({
        userId,
        name: application.studentName,
        email: studentEmail.toLowerCase(),
        password: hashedPassword,
        role: 'student',
        profileImage: application.studentPhoto,
        mobileNumber: application.contactNumber,
        timezone: application.timezone || 'Asia/Kolkata',
        studentData: {
          class: numericClass,
          rollNo: rollNo,
          dob: application.dob,
          gender: application.gender,
          parentDetails: {
            name: application.parentName,
            relationship: application.relationship,
            phone: application.phone,
            email: parentEmail
          },
          streetAddress: application.streetAddress,
          city: application.city,
          state: application.state,
          zipCode: application.zipCode,
          country: application.country,
          admissionId: application._id
        }
      });
      console.log(`Created student ${user.name} with roll number ${rollNo}`);
    } else {
      userExisted = true;
      const updates = { $set: { role: 'student' } };
      const numericClass = application.class ? parseInt(application.class.toString().replace(/[^0-9]/g, '')) : undefined;

      if (!user.studentData?.class && numericClass) updates.$set['studentData.class'] = numericClass;
      if (!user.studentData?.rollNo) updates.$set['studentData.rollNo'] = await generateRollNumber(numericClass || user.studentData?.class);
      if (!user.studentData?.admissionId) updates.$set['studentData.admissionId'] = application._id;
      
      await User.findByIdAndUpdate(user._id, updates);
      console.log('Linked existing user to application');
    }

    application.status = 'approved';
    application.userId = user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Handle Fees and Payments
    const ClassSubject = require("../../models/ClassSubject");
    const ClassFees = require("../../models/ClassFees");
    const StudentPayment = require("../../models/StudentPayment");
    
    let classSubject = await ClassSubject.findOne({ class: application.class });
    if (!classSubject) classSubject = await ClassSubject.findOne({ name: application.class });
    if (!classSubject) {
      const match = application.class?.toString().match(/\d+/);
      if (match) classSubject = await ClassSubject.findOne({ name: `Class ${match[0]}` });
    }

    let totalFeeAmount = 0;
    if (classSubject) {
      const classFees = await ClassFees.findOne({ classId: classSubject._id });
      if (classFees) {
        totalFeeAmount = classFees.totalFee;
        const existingPayment = await StudentPayment.findOne({ studentId: user._id });
        if (!existingPayment) {
          await StudentPayment.create({
            studentId: user._id,
            classId: classSubject._id,
            totalFees: totalFeeAmount,
            paidAmount: 0,
            dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            academicYear: new Date().getFullYear().toString(),
            paymentStatus: "pending"
          });
        }
      }
    }

    // Send email
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const { admission_approved } = require('../../config/emailTemplates');
    try {
      await sendEmail({
        to: studentEmail,
        subject: admission_approved.subject,
        html: admission_approved.html(
          application.studentName,
          application.applicationId,
          studentEmail,
          userExisted ? "(Use your existing password)" : randomPassword,
          user.studentData?.rollNo || "(Assigned after login)",
          application.class,
          totalFeeAmount,
          appUrl
        )
      });
    } catch (e) {
      console.error("Email send fail:", e);
    }

    res.json({ success: true, message: 'Application approved', userExisted });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await Admission.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Application already processed' });
    }

    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.rejectionReason = reason || '';

    await application.save();

    res.json({
      success: true,
      message: 'Application rejected'
    });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
