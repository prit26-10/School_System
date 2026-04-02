const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/teacher/assignmentController");
const authenticateToken = require("../middleware/jwtAuth");
const requireRole = require("../middleware/roleAuth");
const uploadMaterial = require("../middleware/uploadMaterial");

// All routes require authentication and teacher role
router.use(authenticateToken);
router.use(requireRole("teacher"));

// Assignment CRUD routes
router.get("/teacher", assignmentController.getTeacherAssignments);
router.post("/", uploadMaterial.single("file"), assignmentController.createAssignment);
router.put("/:id", uploadMaterial.single("file"), assignmentController.updateAssignment);
router.delete("/:id", assignmentController.deleteAssignment);

// Submission routes
router.get("/:id/submissions", assignmentController.getSubmissions);
router.get("/submissions/all", assignmentController.getAllTeacherSubmissions);
router.put("/submissions/:submissionId/evaluate", assignmentController.evaluateSubmission);
router.put("/submissions/publish", assignmentController.publishMarks);

// Teacher classes and subjects
router.get("/teacher/classes-subjects", assignmentController.getTeacherClassesAndSubjects);

module.exports = router;
