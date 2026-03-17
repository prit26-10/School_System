const express = require("express");
const router = express.Router();
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const liveSessionController = require("../controllers/teacher/liveSessionController");

// All routes require authentication
router.use(jwtAuth);

// Create a new live session with automatic meeting link
// POST /api/live-session/create
router.post("/create", roleAuth("teacher"), liveSessionController.createLiveSession);

// Get today's sessions for the logged-in teacher (or student)
// GET /api/live-session/today
router.get("/today", roleAuth("teacher", "student"), liveSessionController.getTodaySessions);

// Get all sessions for the logged-in teacher
// GET /api/live-session/my-sessions
router.get("/my-sessions", roleAuth("teacher", "student"), liveSessionController.getMySessions);

// Get session details
// GET /api/live-session/:sessionId
router.get("/:sessionId", roleAuth("teacher", "student"), liveSessionController.getSessionDetails);

// Start a session
// PUT /api/live-session/:sessionId/start
router.put("/:sessionId/start", roleAuth("teacher"), liveSessionController.startSession);

// End a session
// PUT /api/live-session/:sessionId/end
router.put("/:sessionId/end", roleAuth("teacher"), liveSessionController.endSession);

// Join a session (get meeting link)
// GET /api/live-session/:sessionId/join
router.get("/:sessionId/join", roleAuth("teacher", "student"), liveSessionController.joinSession);

// Mark attendance
// POST /api/live-session/:sessionId/attendance
router.post("/:sessionId/attendance", roleAuth("teacher"), liveSessionController.markAttendance);

// Send notification to students
// POST /api/live-session/:sessionId/notify
router.post("/:sessionId/notify", roleAuth("teacher"), liveSessionController.sendNotification);

// Delete a session
// DELETE /api/live-session/:sessionId
router.delete("/:sessionId", roleAuth("teacher"), liveSessionController.deleteSession);

module.exports = router;
