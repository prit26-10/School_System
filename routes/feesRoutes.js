const express = require("express");
const router = express.Router();
const {
  saveOrUpdateFees,
  getFeesByClass,
  getAllClassFees,
  deleteFees,
  getPublicFeesByClassNumber,
  getPublicAllFees
} = require("../controllers/Admin/feesController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// Public routes for admission and landing page
router.get("/public/:classNumber", getPublicFeesByClassNumber);
router.get("/public", getPublicAllFees);

// All routes below are protected for admin
router.use(jwtAuth);
router.use(roleAuth("admin"));

// POST /api/fees/class-fees
router.post("/class-fees", saveOrUpdateFees);

// GET /api/fees/class-fees/:classId
router.get("/class-fees/:classId", getFeesByClass);

// GET /api/fees/class-fees
router.get("/class-fees", getAllClassFees);

// DELETE /api/fees/class-fees/:classId
router.delete("/class-fees/:classId", deleteFees);

module.exports = router;
