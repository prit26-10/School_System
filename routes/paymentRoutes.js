const express = require("express");
const router = express.Router();
const {
  getAllStudentPayments,
  updatePayment,
  generateReceipt,
  generateBulkReceipts,
  debugData,
  getStudentsWithPayments,
  updateStudentPayment,
  getFeesCollectionOverview,
} = require("../controllers/Admin/paymentController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes are protected for admin
router.use(jwtAuth);
router.use(roleAuth("admin"));

// GET /api/payments/collection-overview
router.get("/collection-overview", getFeesCollectionOverview);

// GET /api/payments/students
router.get("/students", getStudentsWithPayments);

// POST /api/payments/update-student-payment
router.post("/update-student-payment", updateStudentPayment);

// GET /api/payments/debug
router.get("/debug", debugData);

// GET /api/payments/student-payments
router.get("/student-payments", getAllStudentPayments);

// PUT /api/payments/update-payment/:paymentId
router.put("/update-payment/:paymentId", updatePayment);

// GET /api/payments/receipt/:paymentId
router.get("/receipt/:paymentId", generateReceipt);

// POST /api/payments/bulk-receipts
router.post("/bulk-receipts", generateBulkReceipts);

module.exports = router;