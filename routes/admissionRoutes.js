const express = require("express");
const router = express.Router();
const admissionController = require("../controllers/Admin/admissionController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const User = require("../models/User");

router.post("/submit", admissionController.submitApplication);
router.get("/status/:applicationId", admissionController.getApplicationStatus);

router.use(jwtAuth);
router.use(roleAuth("admin"));

router.get("/students/count", async (req, res) => {
  const count = await User.countDocuments({ role: 'student' });
  res.json({ success: true, count });
});

router.get("/teachers/count", async (req, res) => {
  const count = await User.countDocuments({ role: 'teacher' });
  res.json({ success: true, count });
});

router.get("/applications", admissionController.getAllApplications);
router.get("/applications/count", admissionController.getApplicationCounts);
router.put("/applications/:id/approve", admissionController.approveApplication);
router.put("/applications/:id/reject", admissionController.rejectApplication);
router.get("/applications/:id", admissionController.getApplicationById);

module.exports = router;
