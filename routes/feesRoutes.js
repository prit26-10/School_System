const express = require("express");
const router = express.Router();
const {
  saveOrUpdateFees,
  getFeesByClass,
  getAllClassFees,
  getPaymentSettings,
  getMyFees,
  createStripeSession,
  verifyStripePayment,
} = require("../controllers/Admin/feesController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes require authentication
router.use(jwtAuth);

// GET /api/fees/settings
router.get("/settings", roleAuth("admin", "student"), getPaymentSettings);

// POST /api/fees/class-fees
router.post("/class-fees", roleAuth("admin"), saveOrUpdateFees);

// GET /api/fees/class-fees/:classId
router.get("/class-fees/:classId", roleAuth("admin"), getFeesByClass);

// GET /api/fees/class-fees
router.get("/class-fees", roleAuth("admin"), getAllClassFees);


// --- Student Only Routes ---
// GET /api/fees/my-fees
router.get("/my-fees", roleAuth("student", "Student"), getMyFees);

// Stripe Routes
router.post("/stripe/session", roleAuth("student", "Student"), createStripeSession);
router.post("/stripe/verify", roleAuth("student", "Student"), verifyStripePayment);

module.exports = router;
