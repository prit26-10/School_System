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
      class: studentClass,
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

    // Use student email as primary email for login; fallback to parent email only if student email is not provided
    const studentEmail = application.studentEmail || application.email;
    const parentEmail = application.email;

    if (!studentEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot approve application: No student email provided' 
      });
    }

    console.log('Application status:', application.status);
    console.log('Using student email for account:', studentEmail);

    // Check if user with student email already exists
    let user = await User.findOne({ email: studentEmail.toLowerCase() });
    let userExisted = false;

    if (!user) {
      // Generate roll number for the class
      const rollNo = await generateRollNumber(application.class);
      
      // Create student account
      const randomPassword = generateRandomPassword(8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const userId = 'STU-' + Date.now().toString(36).toUpperCase();

      user = await User.create({
        userId,
        name: application.studentName,
        email: studentEmail.toLowerCase(),
        password: hashedPassword,
        role: 'student',
        class: application.class,
        rollNo: rollNo,
        dob: application.dob,
        gender: application.gender,
        mobileNumber: application.contactNumber || '',
        // Parent information
        parentName: application.parentName || '',
        parentRelationship: application.relationship || '',
        parentPhone: application.phone || '',
        parentEmail: parentEmail || '',
        // Address information
        streetAddress: application.streetAddress || '',
        city: application.city || '',
        state: application.state || '',
        zipCode: application.zipCode || '',
        country: application.country || '',
        timezone: application.timezone || 'Asia/Kolkata',
        // Link to admission record
        admissionId: application._id,
        profileImage: application.studentPhoto || ''
      });

      console.log(`Created student ${user.name} with roll number ${rollNo} in class ${application.class}`);

      // Send approval email with credentials to STUDENT EMAIL
      // await sendEmail({
      //   to: studentEmail,
      //   subject: 'Student Application Approved - School System',
      //   html: `
      //     <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      //       <h2 style="color: #4CAF50;">Congratulations!</h2>
      //       <p>Dear ${application.studentName},</p>
      //       <p>Your admission application (ID: ${application.applicationId}) has been approved.</p>
      //       <p>Your student account has been created. Here are your login credentials:</p>
      //       <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
      //         <p><strong>Login URL:</strong> <a href="http://localhost:5000/login">School Portal</a></p>
      //         <p><strong>Email:</strong> ${studentEmail}</p>
      //         <p><strong>Password:</strong> ${randomPassword}</p>
      //         <p><strong>Roll Number:</strong> ${rollNo}</p>
      //         <p><strong>Class:</strong> ${application.class}</p>
      //       </div>
      //       <p>Please log in and change your password as soon as possible.</p>
      //       <p>Regards,<br>School Admissions Team</p>
      //     </div>
      //   `
      // });
    } else {
      userExisted = true;
      console.log('User already exists, linking to application');
      
      // Update existing user with admission data if missing
      const updates = {};
      if (!user.class && application.class) updates.class = application.class;
      if (!user.rollNo) updates.rollNo = await generateRollNumber(application.class);
      if (!user.dob && application.dob) updates.dob = application.dob;
      if (!user.gender && application.gender) updates.gender = application.gender;
      if (!user.parentName && application.parentName) updates.parentName = application.parentName;
      if (!user.parentRelationship && application.relationship) updates.parentRelationship = application.relationship;
      if (!user.parentPhone && application.phone) updates.parentPhone = application.phone;
      if (!user.parentEmail && parentEmail) updates.parentEmail = parentEmail;
      if (!user.admissionId) updates.admissionId = application._id;
      
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(user._id, updates);
        console.log('Updated existing user with admission data');
      }
    }

    // Update application status
    application.status = 'approved';
    application.userId = user._id;
    application.reviewedAt = new Date();
    await application.save();
    console.log('Application approved');

    res.json({
      success: true,
      message: 'Application approved successfully',
      userExisted,
      rollNo: user.rollNo
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
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
    // reviewedBy is not set since admin is not a database user
    application.rejectionReason = reason || '';

    await application.save();

    // Send rejection email
    // await sendEmail({
    //   to: application.email,
    //   subject: 'Update on Your Student Application - School System',
    //   html: `
    //     <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    //       <h2 style="color: #f44336;">Application Update</h2>
    //       <p>Dear ${application.studentName},</p>
    //       <p>We have reviewed your application (ID: ${application.applicationId}).</p>
    //       <p>Unfortunately, your application for admission has been rejected at this time.</p>
    //       ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    //       <p>If you have any questions, please feel free to contact us.</p>
    //       <p>Regards,<br>School Admissions Team</p>
    //     </div>
    //   `
    // });

    res.json({
      success: true,
      message: 'Application rejected'
    });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
