const express = require("express");
const router = express.Router();
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const upload = require("../middleware/uploadQuestionPaper");

// Controllers
const adminExamController = require("../controllers/Admin/examController");
const teacherExamController = require("../controllers/teacher/examController");
const studentExamController = require("../controllers/student/examController");

// Authenticated routes
router.use(jwtAuth);

// --- Admin Exam Management ---
const adminAuth = roleAuth("admin");
router.post("/admin", adminAuth, adminExamController.createExam);
router.get("/admin", adminAuth, adminExamController.getAllExams);
router.post("/admin/timetable", adminAuth, adminExamController.addTimetableEntry);
router.post("/admin/generate-timetable", adminAuth, adminExamController.generateTimetable);
router.get("/admin/:examId/timetable/:class", adminAuth, adminExamController.getTimetableByClass);
router.delete("/admin/timetable/:id", adminAuth, adminExamController.deleteTimetableEntry);
router.get("/admin/evaluated-exams", adminAuth, adminExamController.getEvaluatedExams);
router.post("/admin/publish-results/:timetableId", adminAuth, adminExamController.publishExamResults);

// --- Teacher Exam Dashboard ---
const teacherAuth = roleAuth("teacher");
router.get("/teacher/timetable", teacherAuth, teacherExamController.getTeacherTimetable);
router.post("/teacher/upload-paper/:timetableId", teacherAuth, upload.single("questionPaper"), teacherExamController.uploadQuestionPaper);
router.get("/teacher/submissions/:timetableId", teacherAuth, teacherExamController.getTimetableSubmissions);
router.get("/teacher/grading-sheet/:timetableId", teacherAuth, teacherExamController.getGradingSheet);
router.post("/teacher/save-marks/:timetableId", teacherAuth, teacherExamController.saveExamMarks);
router.post("/teacher/questions/:timetableId", teacherAuth, teacherExamController.addQuestions);
router.post("/teacher/evaluate-answers/:timetableId", teacherAuth, teacherExamController.evaluateExamAnswers);

// --- Student Exam View ---
router.get("/student/timetable", roleAuth("student"), studentExamController.getStudentTimetable);
router.get("/student/available-exams", roleAuth("student"), studentExamController.getAvailableExams);
router.get("/student/exam-questions/:timetableId", roleAuth("student"), studentExamController.getExamQuestions);
router.post("/student/submit-exam/:timetableId", roleAuth("student"), studentExamController.submitExam);

module.exports = router;
