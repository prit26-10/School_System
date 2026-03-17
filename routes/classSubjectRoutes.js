const express = require('express');
const router = express.Router();
const {
    seedClasses,
    getClasses,
    updateClass,
    deleteClass,
    addSubject,
    updateSubject,
    deleteSubject,
    getSubjects
} = require('../controllers/Admin/classSubjectController');
const { generateTimetable, getTimetable } = require('../controllers/Admin/timetableController');
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

// All routes here should be protected
router.use(jwtAuth);
router.use(roleAuth("admin"));

// Timetable routes
router.post('/generate-timetable', generateTimetable);
router.get('/view-timetable/:classId', getTimetable);

// Class routes
router.post('/classes', seedClasses);
router.get('/classes', getClasses);
router.put('/classes/:id', updateClass);
router.delete('/classes/:id', deleteClass);

// Subject routes
router.get('/subjects', getSubjects);
router.post('/subjects/:classId', addSubject);
router.put('/subjects/:classId/:subjectId', updateSubject);
router.delete('/subjects/:classId/:subjectId', deleteSubject);

module.exports = router;
