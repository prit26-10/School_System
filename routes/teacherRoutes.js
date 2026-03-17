const express = require("express");
const upload = require("../middleware/uploadImage");
const teacherAuth = require("../middleware/teacherAuth");
const uploadCsv = require("../middleware/uploadCsv");

const { studentCreate, studentUpdate, studentIdParam, markCreate, markUpdate, validate, csvUploadValidation } = require("../middleware/validation/studentValidation");
const teacherController = require("../controllers/teacherController");
const classController = require("../controllers/teacher/classController");
const teacherNoticeController = require("../controllers/teacher/teacherNotice");
const materialController = require("../controllers/teacher/teacherMaterial");
const uploadMaterial = require("../middleware/uploadMaterial");
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentMarks,
  addMark,
  updateMark,
  deleteMark,
  updateMyProfile,
  uploadStudentsCSV,
  getTeacherStats,
  getQuizSampleCSV,
  parseQuizCSV,
  getQuizAttempts,
  getHolidays,
  getEvents
} = teacherController;
const { quizCsvValidation } = require("../middleware/validation/quizValidation");

const router = express.Router();

router.get("/test", (req, res) => res.json({ success: true, message: "Teacher API is working" }));

console.log("[DEBUG] Registering teacher routes...");
router.use(teacherAuth);

router.get("/holidays", getHolidays);
router.get("/events", getEvents);
router.get("/assigned-classes", classController.getAssignedClasses);
router.get("/assigned-classes/:classId", classController.getClassDetails);
router.get("/assigned-classes/:classId/students", classController.getAssignedClassStudents);

// Notice/Announcement routes
router.get("/notices/admin", teacherNoticeController.getAdminNotices);
router.get("/notices/my", teacherNoticeController.getMyAnnouncements);
router.post("/notices/class", teacherNoticeController.postClassAnnouncement);

// Study Material routes
router.post("/materials", uploadMaterial.single("file"), materialController.uploadMaterial);
router.get("/materials", materialController.getMyMaterials);
router.delete("/materials/:id", materialController.deleteMaterial);

router.get("/stats", getTeacherStats);
router.get("/me", teacherController.getMyProfile);
router.put("/me", upload.single("image"), updateMyProfile);
router.get("/me/profile", teacherController.getMyProfile);
router.put("/me/profile", upload.single("image"), updateMyProfile);
router.get("/students", getStudents);
router.get("/students/:userId", studentIdParam, validate, getStudentById);
router.post("/students", upload.single("profileImage"), studentCreate, validate, createStudent);
router.put("/students/:userId", studentIdParam, upload.single("profileImage"), studentUpdate, validate, updateStudent);
router.delete("/students/:userId", studentIdParam, validate, deleteStudent);

router.post("/students/upload-csv", uploadCsv.single("csv"), csvUploadValidation, uploadStudentsCSV);

// Quiz CSV Routes
router.get("/quizzes/sample-csv", getQuizSampleCSV);
router.post("/quizzes/parse-csv", uploadCsv.single("csv"), quizCsvValidation, parseQuizCSV);

// Quiz Attempts Route
router.get("/quizzes/:quizId/attempts", getQuizAttempts);

router.get("/students/:userId/marks", studentIdParam, validate, getStudentMarks);
router.post("/students/:userId/marks", markCreate, validate, addMark);
router.put("/marks/:id", markUpdate, validate, updateMark);
router.delete("/marks/:id", deleteMark);

module.exports = router;
