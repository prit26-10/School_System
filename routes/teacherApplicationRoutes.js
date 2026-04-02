const express = require('express');
const router = express.Router();
const {
  submitTeacherApplication,
  getAllTeacherApplications,
  getTeacherApplicationCounts,
  getTeacherApplicationById,
  approveTeacherApplication,
  rejectTeacherApplication
} = require('../controllers/Admin/teacherApplicationController');

// Public route for submitting teacher applications
router.post('/submit', submitTeacherApplication);

// Admin routes for managing teacher applications
router.get('/applications', getAllTeacherApplications);
router.get('/applications/counts', getTeacherApplicationCounts);
router.get('/applications/:id', getTeacherApplicationById);
router.put('/applications/:id/approve', approveTeacherApplication);
router.put('/applications/:id/reject', rejectTeacherApplication);

module.exports = router;
