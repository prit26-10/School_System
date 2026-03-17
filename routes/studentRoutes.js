const express = require("express");
const upload = require("../middleware/uploadImage");

const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const teacherAuth = require("../middleware/teacherAuth");

const { studentUpdate,submitQuizValidation, validate, studentCreate} = require("../middleware/validation/studentValidation");
const { getMyProfile, updateMyProfile, getMyMarks, getStudentStats, getMyNotices } = require("../controllers/studentController");
const { getMyMaterials } = require("../controllers/student/studentMaterialController");
const { getStudents, createStudent, updateStudent, deleteStudent } = require("../controllers/teacherController");
const { getQuizForStudent, submitQuiz } = require("../controllers/studentQuizController");
const { getStudentTimetable } = require("../controllers/student/studentAcademicController");
const { getMyAssignments, submitAssignment } = require("../controllers/student/studentAssignmentController");
const uploadMaterial = require("../middleware/uploadMaterial");

const router = express.Router();

// Teacher routes for student management
router.get("/", teacherAuth, getStudents);
router.post("/", upload.single("image"), studentCreate, validate, teacherAuth, createStudent);
router.put("/:userId", upload.single("image"), studentUpdate, validate, teacherAuth, updateStudent);
router.delete("/:userId", teacherAuth, deleteStudent);

// Student routes
router.use(jwtAuth, roleAuth("student"));
router.get("/me", getMyProfile);
router.put("/me", upload.single("image"), studentUpdate, validate, updateMyProfile);
router.get("/me/marks", getMyMarks);
router.get("/me/notices", getMyNotices);
router.get("/me/materials", getMyMaterials);
router.get("/stats", getStudentStats);
router.get("/quiz/:id", getQuizForStudent);
router.post("/quiz/:id/submit",submitQuizValidation,  validate, submitQuiz);
router.get("/me/timetable", getStudentTimetable);
router.get("/me/assignments", getMyAssignments);
router.post("/assignments/:id/submit", uploadMaterial.single("file"), submitAssignment);

module.exports = router;