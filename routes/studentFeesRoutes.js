const express = require("express");
const router = express.Router();
const { getMyFeesStatus, createRazorpayOrder, verifyPayment, getMyReceipt } = require("../controllers/student/feesController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes are protected for students
router.use(jwtAuth);
router.use(roleAuth("student"));

// GET fees status
router.get("/status", getMyFeesStatus);

// POST create razorpay order
router.post("/create-order", createRazorpayOrder);

// POST verify payment
router.post("/verify-payment", verifyPayment);

// GET receipt
router.get("/receipt", getMyReceipt);

module.exports = router;
