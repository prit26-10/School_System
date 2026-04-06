const express = require("express");
const router = express.Router();
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const upload = require("../middleware/uploadQuestionPaper");

// Controllers
const adminExamController = require("../controllers/Admin/examController");
const teacherExamController = require("../controllers/teacher/examController");
const studentExamController = require("../controllers/student/examController");
const csvStudentExamController = require("../controllers/student/studentExamController");
const csvUpload = require("../middleware/uploadQuestionsCSV");

// Authenticated routes
router.use(jwtAuth);

// --- Admin Exam Management ---
const adminAuth = roleAuth("admin");
router.post("/admin", adminAuth, adminExamController.createExam);
router.get("/admin", adminAuth, adminExamController.getAllExams);
router.get("/admin/all-timetables", adminAuth, adminExamController.getAllExamTimetables);
router.post("/admin/timetable", adminAuth, adminExamController.addTimetableEntry);
router.post("/admin/generate-timetable", adminAuth, adminExamController.generateTimetable);
router.get("/admin/:examId/timetable/:class", adminAuth, adminExamController.getTimetableByClass);
router.put("/admin/timetable/:id", adminAuth, adminExamController.updateTimetableEntry);
router.delete("/admin/timetable/:id", adminAuth, adminExamController.deleteTimetableEntry);
router.get("/admin/evaluated-exams", adminAuth, adminExamController.getEvaluatedExams);
router.post("/admin/publish-results/:timetableId", adminAuth, adminExamController.publishExamResults);
router.get("/admin/overall-results/:examId/:class", adminAuth, adminExamController.getOverallResults);

// --- Teacher Exam Dashboard ---
const teacherAuth = roleAuth("teacher");
router.get("/teacher/timetable", teacherAuth, teacherExamController.getTeacherTimetable);
router.post("/teacher/upload-paper/:timetableId", teacherAuth, upload.single("questionPaper"), teacherExamController.uploadQuestionPaper);
router.get("/teacher/submissions/:timetableId", teacherAuth, teacherExamController.getTimetableSubmissions);
router.get("/teacher/grading-sheet/:timetableId", teacherAuth, teacherExamController.getGradingSheet);
router.post("/teacher/save-marks/:timetableId", teacherAuth, teacherExamController.saveExamMarks);
router.post("/teacher/questions/:timetableId", teacherAuth, teacherExamController.addQuestions);
router.post("/teacher/evaluate-answers/:timetableId", teacherAuth, teacherExamController.evaluateExamAnswers);

// --- Teacher CSV Exam Management (New) ---
router.post("/teacher/upload-questions-csv/:timetableId", teacherAuth, csvUpload.single("questionsCsv"), teacherExamController.uploadCSVQuestions);
router.get("/teacher/csv-submissions/:timetableId", teacherAuth, teacherExamController.getCSVExamSubmissions);
router.get("/teacher/csv-submission-detail/:timetableId/:studentId", teacherAuth, teacherExamController.getStudentSubmissionDetail);
router.post("/teacher/csv-save-marks/:answerId", teacherAuth, teacherExamController.saveManualMarking);
router.post("/teacher/finalize-submission/:timetableId/:studentId", teacherAuth, teacherExamController.finalizeSubmission);
router.post("/teacher/csv-submit-to-admin/:timetableId", teacherAuth, teacherExamController.submitCSVExamsToAdmin);
router.get("/teacher/sample-csv", teacherAuth, teacherExamController.getCSVSampleFile);

// --- Student Exam View ---
router.get("/student/timetable", roleAuth("student"), studentExamController.getStudentTimetable);
router.get("/student/available-exams", roleAuth("student"), studentExamController.getAvailableExams);
router.get("/student/exam-questions/:timetableId", roleAuth("student"), studentExamController.getExamQuestions);
router.post("/student/submit-exam/:timetableId", roleAuth("student"), studentExamController.submitExam);

// --- Student CSV Exam (New) ---
router.get("/student/csv-exam-paper/:timetableId", roleAuth("student"), csvStudentExamController.getExamPaper);
router.post("/student/csv-submit-exam/:timetableId", roleAuth("student"), csvStudentExamController.submitExamAnswers);
router.get("/student/my-results", roleAuth("student"), studentExamController.getMyResults);

module.exports = router;
