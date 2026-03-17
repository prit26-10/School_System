const express = require("express");
const router = express.Router();
console.log("Loading Admin Manage Routes...");
const manageController = require("../controllers/Admin/manageController");
const noticeController = require("../controllers/Admin/noticeController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes here require authentication and admin role
router.use(jwtAuth);
router.use(roleAuth("admin"));

router.get("/teachers", manageController.getAllTeachers);
router.put("/teachers/:id", manageController.updateTeacher);
router.delete("/teachers/:id", manageController.deleteTeacher);

// Student management routes for admin
router.get("/students", manageController.getAllStudents);
router.put("/students/:id", manageController.updateStudent);
router.delete("/students/:id", manageController.deleteStudent);

// Notice Management routes
router.post("/notices", noticeController.postNotice);
router.get("/notices", noticeController.getAllNotices);
router.delete("/notices/:id", noticeController.deleteNotice);

module.exports = router;
