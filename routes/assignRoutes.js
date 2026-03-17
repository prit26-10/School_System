const express = require('express');
const router = express.Router();
const {
    assignTeacherToClass,
    getClassesWithTeachers,
    removeTeacherFromClass,
    assignTeacherToSubject,
    removeTeacherFromSubject
} = require('../controllers/Admin/AssignController');

// Assign teacher to class
router.post('/classes/:classId/assign-teacher', assignTeacherToClass);

// Get all classes with their assigned teachers
router.get('/classes-with-teachers', getClassesWithTeachers);

// Remove teacher from class
router.delete('/classes/:classId/remove-teacher', removeTeacherFromClass);

// Subject-level assignment
router.post('/subjects/:classId/:subjectId/assign-teacher', assignTeacherToSubject);
router.delete('/subjects/:classId/:subjectId/remove-teacher', removeTeacherFromSubject);

module.exports = router;
