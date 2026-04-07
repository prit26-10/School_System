const ClassFees = require("../../models/ClassFees");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const FeePayment = require("../../models/FeePayment");
const mongoose = require("mongoose");
const axios = require("axios");

// @desc    Save or update class fees
// @route   POST /api/fees/class-fees
// @access  Admin
exports.saveOrUpdateFees = async (req, res) => {
  try {
    const { classId, tuitionFee, examFee } = req.body;

    if (!classId) {
      return res.status(400).json({ success: false, message: "classId is required" });
    }

    if (isNaN(tuitionFee) || isNaN(examFee)) {
      return res.status(400).json({ success: false, message: "tuitionFee and examFee must be numbers" });
    }

    const annualFee = Number(tuitionFee);
    const examinationFee = Number(examFee);
    const totalFee = annualFee + examinationFee;

    // Check if class exists
    let classExists = null;
    if (mongoose.Types.ObjectId.isValid(classId)) {
      classExists = await ClassSubject.findById(classId);
    } else {
      classExists = await ClassSubject.findOne({ class: Number(classId) });
    }

    if (!classExists) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }
    
    const actualClassId = classExists._id;

    // Upsert the fee record
    const feeRecord = await ClassFees.findOneAndUpdate(
      { classId: actualClassId },
      {
        tuitionFee: annualFee,
        examFee: examinationFee,
        totalFee,
      },
      { new: true, upsert: true, runValidators: true }
    ).populate("classId", "class");

    res.status(200).json({
      success: true,
      message: "Fees saved successfully",
      data: feeRecord,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Fetch fees for a specific class
// @route   GET /api/fees/class-fees/:classId
// @access  Admin
exports.getFeesByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    let fees = null;
    if (mongoose.Types.ObjectId.isValid(classId)) {
      fees = await ClassFees.findOne({ classId }).populate("classId", "class");
    } else {
      const classObj = await ClassSubject.findOne({ class: Number(classId) });
      if (classObj) {
        fees = await ClassFees.findOne({ classId: classObj._id }).populate("classId", "class");
      }
    }

    if (!fees) {
      return res.status(404).json({ success: false, message: "Fees not defined for this class" });
    }

    res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Return a list of all classes with their fees
// @route   GET /api/fees/class-fees
// @access  Admin
exports.getAllClassFees = async (req, res) => {
  try {
    // Only fetch records with valid classId references
    let fees = await ClassFees.find({ classId: { $ne: null } })
      .populate("classId", "class")
      .sort({ "classId.class": 1 }); // Sort by class in ascending order

    // Manual fallback: If populate didn't work (e.g., invalid ObjectId format),
    // manually fetch class data for each fee record
    const ClassSubject = require("../../models/ClassSubject");
    
    fees = await Promise.all(
      fees.map(async (fee) => {
        // If classId is not populated (still an object with just the ID or string)
        if (!fee.classId || !fee.classId.class) {
          try {
            const classData = await ClassSubject.findById(fee.classId).select("class");
            if (classData) {
              fee.classId = classData;
            }
          } catch (e) {
            // Invalid classId format, skip this record
            console.warn(`Invalid classId for fee record: ${fee._id}`);
          }
        }
        return fee;
      })
    );

    // Filter out any records where classId couldn't be resolved
    fees = fees.filter(fee => fee.classId && fee.classId.class !== undefined);

    res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Get current payment settings and configuration (Stripe)
// @route   GET /api/fees/settings
// @access  Admin/Student
exports.getPaymentSettings = async (req, res) => {
  try {
    const stripeConfigured = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
    
    res.status(200).json({
      success: true,
      data: {
        stripe: {
          configured: stripeConfigured,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'Not Configured'
        },
        currency: 'INR',
        schoolName: 'Smart School System'
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// @desc    Get current student's fees
// @route   GET /api/fees/my-fees
// @access  Student
exports.getMyFees = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role.toLowerCase() !== 'student') {
      return res.status(404).json({ success: false, message: "Student record not found or invalid role" });
    }

    const studentClass = user.studentData?.class;
    if (!studentClass) {
      return res.status(400).json({ success: false, message: "Student class not defined" });
    }

    // Find class object to get ID
    const classObj = await ClassSubject.findOne({ class: studentClass });
    if (!classObj) {
      return res.status(404).json({ success: false, message: "Class definition not found" });
    }

    const fees = await ClassFees.findOne({ classId: classObj._id }).populate("classId", "class");
    
    // Also fetch payment status
    const payment = await FeePayment.findOne({ 
      studentId: req.user.id, 
      classId: classObj._id,
      status: "completed"
    });

    res.status(200).json({
      success: true,
      data: fees || { tuitionFee: 0, examFee: 0, totalFee: 0, classId: classObj },
      isPaid: !!payment,
      paymentDetails: payment
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create Stripe Checkout Session
// @route   POST /api/fees/stripe/session
// @access  Student
exports.createStripeSession = async (req, res) => {
    try {
        const { amount, classId } = req.body;
        const studentId = req.user.id;

        if (!amount || !classId) {
            return res.status(400).json({ success: false, message: "Amount and classId are required" });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: req.user.email,
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: 'Academic Fees',
                        description: `Class Fee Installment`,
                    },
                    unit_amount: Math.round(parseFloat(amount) * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/student/html/studentDashboard.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/student/html/studentDashboard.html?payment=cancel`,
            metadata: {
                studentId: studentId.toString(),
                classId: classId.toString()
            }
        });

        // Save pending payment record
        await FeePayment.create({
            studentId: studentId,
            classId: classId,
            amount: amount,
            paymentId: session.id, // Store session ID
            paymentMethod: 'stripe',
            status: "pending"
        });

        res.status(201).json({
            success: true,
            url: session.url,
            sessionId: session.id
        });
    } catch (err) {
        console.error("Stripe Session Error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to create Stripe session" });
    }
};

// @desc    Verify Stripe Payment Status
// @route   POST /api/fees/stripe/verify
// @access  Student
exports.verifyStripePayment = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
            // Update payment record
            await FeePayment.findOneAndUpdate(
                { paymentId: sessionId },
                { 
                    status: "completed",
                    payerEmail: session.customer_details?.email,
                    payerName: session.customer_details?.name
                }
            );

            res.status(200).json({ success: true, message: "Payment verified" });
        } else {
            res.status(400).json({ success: false, message: "Payment not completed" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
