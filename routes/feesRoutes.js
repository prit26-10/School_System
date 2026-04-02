const express = require("express");
const router = express.Router();
const {
  saveOrUpdateFees,
  getFeesByClass,
  getAllClassFees,
} = require("../controllers/Admin/feesController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes are protected for admin
router.use(jwtAuth);
router.use(roleAuth("admin"));

// POST /api/fees/class-fees
router.post("/class-fees", saveOrUpdateFees);

// GET /api/fees/class-fees/:classId
router.get("/class-fees/:classId", getFeesByClass);

// GET /api/fees/class-fees
router.get("/class-fees", getAllClassFees);

module.exports = router;
