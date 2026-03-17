const TeacherApplication = require("../../models/TeacherApplication");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const sendEmail = require("../../utils/sendEmail");
const { generateRandomPassword } = require("../../utils/passwordUtils");

function generateApplicationId() {
  return 'TAPP-' + Date.now().toString(36).toUpperCase();
}

exports.submitTeacherApplication = async (req, res) => {
  try {
    console.log('Received teacher application data:', JSON.stringify(req.body, null, 2));

    const {
      fullName,
      dob,
      gender,
      email,
      phone,
      maritalStatus,
      position,
      department,
      experience,
      qualification,
      university,
      yearPassing,
      additionalQualification,
      additionalInstitution,
      percentage,
      previousExperience,
      skills,
      streetAddress,
      city,
      state,
      zipCode,
      country,
      timezone,
      resume,
      coverLetter,
      certificates,
      profilePhoto
    } = req.body;

    const existingApplication = await TeacherApplication.findOne({ email: email?.toLowerCase() });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "An application with this email already exists"
      });
    }

    const dobDate = dob ? new Date(dob) : null;
    if (!dobDate || isNaN(dobDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date of birth"
      });
    }

    if (!fullName || !email || !gender || !position || !experience || !qualification || !university || !yearPassing || !streetAddress || !city || !state || !zipCode || !country) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Generate application ID
    const applicationId = generateApplicationId();

    const application = new TeacherApplication({
      fullName,
      dob: dobDate,
      gender,
      email: email?.toLowerCase(),
      phone,
      maritalStatus,
      position,
      department,
      experience,
      qualification,
      university,
      yearPassing,
      additionalQualification,
      additionalInstitution,
      percentage,
      previousExperience,
      skills,
      streetAddress,
      city,
      state,
      zipCode,
      country,
      timezone: timezone || "Asia/Kolkata",
      resume,
      coverLetter,
      certificates: certificates ? (typeof certificates === 'string' ? [certificates] : (Array.isArray(certificates) ? certificates : [])) : [],
      profilePhoto,
      status: "pending",
      applicationId
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: "Teacher application submitted successfully",
      applicationId: application.applicationId
    });
  } catch (error) {
    console.error("Teacher application submission error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.getAllTeacherApplications = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { applicationId: searchRegex }
      ];
    }

    const applications = await TeacherApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await TeacherApplication.countDocuments(filter);

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
    console.error('Get teacher applications error:', error);
    res.status(500).json({ success: false, applications: [], message: 'Server error' });
  }
};

exports.getTeacherApplicationCounts = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      TeacherApplication.countDocuments({ status: 'pending' }),
      TeacherApplication.countDocuments({ status: 'approved' }),
      TeacherApplication.countDocuments({ status: 'rejected' })
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

exports.getTeacherApplicationById = async (req, res) => {
  try {
    const application = await TeacherApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Teacher application not found' });
    }

    res.json({
      success: true,
      application
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.approveTeacherApplication = async (req, res) => {
  try {
    console.log('Approving teacher application:', req.params.id);
    const application = await TeacherApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Teacher application not found' });
    }

    console.log('Teacher application status:', application.status);

    // Check if user with this email already exists
    let user = await User.findOne({ email: application.email });
    let userExisted = false;

    if (!user) {
      // Create teacher account
      const randomPassword = generateRandomPassword(8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const userId = 'TCH-' + Date.now().toString(36).toUpperCase();

      user = await User.create({
        userId,
        name: application.fullName,
        email: application.email,
        password: hashedPassword,
        role: 'teacher',
        mobileNumber: application.phone,
        streetAddress: application.streetAddress,
        city: application.city,
        state: application.state,
        country: application.country,
        timezone: application.timezone || 'Asia/Kolkata',
        department: application.department,
        position: application.position,
        experience: application.experience,
        qualification: application.qualification
      });

      // Send approval email with credentials
      // await sendEmail({
      //   to: application.email,
      //   subject: 'Teacher Application Approved - School System',
      //   html: `
      //     <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      //       <h2 style="color: #4CAF50;">Welcome to our Team!</h2>
      //       <p>Dear ${application.fullName},</p>
      //       <p>Your application for the position of ${application.position} (ID: ${application.applicationId}) has been approved.</p>
      //       <p>Your teacher account has been created. Here are your login credentials:</p>
      //       <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
      //         <p><strong>Login URL:</strong> <a href="http://localhost:5000/login">School Portal</a></p>
      //         <p><strong>Email:</strong> ${application.email}</p>
      //         <p><strong>Password:</strong> ${randomPassword}</p>
      //       </div>
      //       <p>Please log in and change your password as soon as possible.</p>
      //       <p>Regards,<br>School Administration</p>
      //     </div>
      //   `
      // });
    } else {
      userExisted = true;
      console.log('User already exists, linking to teacher application');
    }

    // Update application status
    application.status = 'approved';
    application.userId = user._id;
    application.reviewedAt = new Date();
    await application.save();
    console.log('Teacher application approved');

    res.json({
      success: true,
      message: 'Teacher application approved successfully',
      userExisted
    });
  } catch (error) {
    console.error('Approve teacher application error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

exports.rejectTeacherApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await TeacherApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Teacher application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Application already processed' });
    }

    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.rejectionReason = reason || '';

    await application.save();

    // Send rejection email
    // await sendEmail({
    //   to: application.email,
    //   subject: 'Update on Your Teacher Application - School System',
    //   html: `
    //     <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    //       <h2 style="color: #f44336;">Application Update</h2>
    //       <p>Dear ${application.fullName},</p>
    //       <p>We have reviewed your application for the position of ${application.position} (ID: ${application.applicationId}).</p>
    //       <p>Unfortunately, we have decided not to move forward with your application at this time.</p>
    //       ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    //       <p>We appreciate your interest in joining our school and wish you the best in your future endeavors.</p>
    //       <p>Regards,<br>School Administration</p>
    //     </div>
    //   `
    // });

    res.json({
      success: true,
      message: 'Teacher application rejected'
    });
  } catch (error) {
    console.error('Reject teacher application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
