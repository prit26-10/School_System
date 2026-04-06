const Razorpay = require("razorpay");
const crypto = require("crypto");
const ClassFees = require("../../models/ClassFees");
const StudentPayment = require("../../models/StudentPayment");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const { sendPaymentSuccessEmail } = require("../../config/emailTemplates");
const sendEmail = require("../../utils/sendEmail");

// Initialize Razorpay instance with working test keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G1T",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "1DP5mmOlF5G1T",
});

// @desc    Get current student's fees status
// @route   GET /api/student-fees/status
// @access  Student
exports.getMyFeesStatus = async (req, res) => {
  try {
    const studentId = req.user.id;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Convert student class to string for query
    let studentClass = student.class ? student.class.toString() : '';
    if (!studentClass && student.studentData && student.studentData.class) {
      studentClass = student.studentData.class.toString();
    }

    if (!studentClass) {
      return res.status(400).json({ success: false, message: "Student class not defined" });
    }

    // Find the class subject
    let classSubject = await ClassSubject.findOne({ class: studentClass });
    if (!classSubject) {
      classSubject = await ClassSubject.findOne({ name: studentClass });
    }
    if (!classSubject) {
      const match = studentClass.match(/\d+/);
      if (match) {
        classSubject = await ClassSubject.findOne({ name: `Class ${match[0]}` });
      }
    }

    if (!classSubject) {
       return res.status(404).json({ success: false, message: "Class details not found" });
    }

    // Find fees details for the class
    const classFees = await ClassFees.findOne({ classId: classSubject._id });
    if (!classFees) {
      return res.status(404).json({ success: false, message: "Fees not configured for this class yet" });
    }

    // Find or create student payment record
    let payment = await StudentPayment.findOne({ studentId });
    if (!payment) {
      payment = new StudentPayment({
        studentId,
        classId: classSubject._id,
        totalFees: classFees.totalFee,
        paidAmount: 0,
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // 1 month from now
        academicYear: new Date().getFullYear().toString(),
        paymentStatus: "pending"
      });
      await payment.save();
    }

    res.status(200).json({
      success: true,
      data: {
        feesStatus: student.studentData?.feesStatus || "pending",
        studentName: student.name,
        className: classSubject.name || `Class ${classSubject.class}`,
        totalFees: payment.totalFees,
        paidAmount: payment.paidAmount,
        paymentRecordId: payment._id,
        dueDate: payment.dueDate
      }
    });

  } catch (err) {
    console.error("Get Fees Status Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create Razorpay Order
// @route   POST /api/student-fees/create-order
// @access  Student
exports.createRazorpayOrder = async (req, res) => {
  try {
    const studentId = req.user.id;
    const payment = await StudentPayment.findOne({ studentId, paymentStatus: "pending" });

    if (!payment) {
      return res.status(400).json({ success: false, message: "No pending payment found" });
    }

    const amountToPay = payment.totalFees - payment.paidAmount;
    if (amountToPay <= 0) {
      return res.status(400).json({ success: false, message: "Fees are already fully paid" });
    }

    const amountInPaise = amountToPay * 100;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `RCP_${Date.now()}_${studentId.toString().substring(0, 5)}`,
      payment_capture: 1, // Auto-capture payment
      notes: {
        student_id: studentId.toString(),
        purpose: "Class Fees Payment"
      }
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
      console.log('Razorpay order created:', order);
    } catch (razorpayError) {
      console.error("Razorpay API Error:", razorpayError);
      return res.status(400).json({ 
        success: false, 
        message: "Payment service unavailable. Please try again later." 
      });
    }

    // Save order id to payment record temporarily
    payment.razorpayOrderId = order.id;
    await payment.save();

    const student = await User.findById(studentId);

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        studentName: student.name,
        studentEmail: student.email,
        contact: student.mobileNumber || ''
      }
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

// @desc    Verify Payment Signature
// @route   POST /api/student-fees/verify-payment
// @access  Student
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const studentId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification parameters" });
    }

    const payload = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(payload.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Payment is valid, update db
    const payment = await StudentPayment.findOne({ studentId, razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment order record not found" });
    }

    const paidSessionAmount = payment.totalFees - payment.paidAmount;
    
    // Create new payment history entry
    payment.paymentHistory.push({
      amount: paidSessionAmount,
      paymentDate: new Date(),
      paymentMethod: "razorpay",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      receiptNumber: `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      notes: "Online Payment via Razorpay"
    });

    payment.paidAmount += paidSessionAmount;
    // Pre-save hook will set paymentStatus to "paid" if paidAmount >= totalFees
    await payment.save();

    // Update user feesStatus
    const student = await User.findById(studentId);
    if (student) {
      // Update feesStatus in studentData for students
      if (student.studentData) {
        student.studentData.feesStatus = "paid";
      } else {
        // Fallback for older schema structure
        student.feesStatus = "paid";
      }
      
      try {
        await student.save();
      } catch (saveError) {
        console.error('Error updating student fees status:', saveError);
        // Continue with payment flow even if student update fails
      }
    }

    // Try sending email (if mailtrap configured)
    try {
      const classSubj = await ClassSubject.findById(payment.classId);
      const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4CAF50;">Payment Successful</h2>
            <p>Dear ${student.name},</p>
            <p>Your fees payment for Rs. ${paidSessionAmount} has been successfully received.</p>
            <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
            <p><strong>Class:</strong> ${classSubj ? classSubj.name : ''}</p>
            <p>You can now access your full student dashboard.</p>
            <p>Regards,<br>School Administration</p>
          </div>
      `;
      await sendEmail({
        to: student.email,
        subject: "Fees Payment Successful",
        html: emailHtml
      });
    } catch (e) {
      console.log("Email sending failed or not configured", e);
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully"
    });

  } catch (err) {
    console.error("Verify Payment Error:", err);
    res.status(500).json({ success: false, message: "Server error during verification" });
  }
};

// @desc    Get Student Receipt
// @route   GET /api/student-fees/receipt
// @access  Student
exports.getMyReceipt = async (req, res) => {
  try {
    const studentId = req.user.id;
    const payment = await StudentPayment.findOne({ studentId }).populate("classId");

    if (!payment || payment.paymentHistory.length === 0) {
      return res.status(404).json({ success: false, message: "No payment history found" });
    }

    // Get latest payment
    const latestPayment = payment.paymentHistory[payment.paymentHistory.length - 1];

    res.status(200).json({
      success: true,
      data: {
        studentName: req.user.name,
        className: payment.classId ? (payment.classId.name || `Class ${payment.classId.class}`) : 'N/A',
        totalFees: payment.totalFees,
        paidAmount: latestPayment.amount,
        paymentDate: latestPayment.paymentDate,
        receiptNumber: latestPayment.receiptNumber,
        paymentMethod: latestPayment.paymentMethod,
        transactionId: latestPayment.razorpayPaymentId || 'N/A'
      }
    });

  } catch (err) {
    console.error("Get Receipt Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
