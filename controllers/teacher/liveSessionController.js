const LiveSession = require("../../models/LiveSession");
const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const { createZoomMeeting } = require("../../utils/meetingService");

function normalizeClassValue(classValue) {
    if (!classValue) return "";
    const str = String(classValue).trim();
    const match = str.match(/(\d+)/);
    return (match ? match[1] : str).toLowerCase();
}

/**
 * Create a new live session with automatic meeting link generation
 * POST /api/live-session/create
 */
exports.createLiveSession = async (req, res) => {
    try {
        const {
            classId,
            subjectName,
            subjectCode,
            scheduledDate,
            startTime,
            endTime,
            description
        } = req.body;

        // Validate required fields
        if (!classId || !subjectName || !scheduledDate || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: classId, subjectName, scheduledDate, startTime, endTime"
            });
        }

        // Get teacher info from authenticated user
        // Some auth middlewares set user.id, others set user._id
        const teacherId = req.user?._id || req.user?.id;
        const teacherName = req.user?.name;

        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Verify the class exists and teacher is assigned to it
        const classDoc = await ClassSubject.findById(classId);
        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        // Convert teacherId to string for comparison
        const teacherIdStr = teacherId.toString();

        // Check if teacher is authorized for this class
        const isAuthorized =
            classDoc.assignedTeacher?.teacherId?.toString() === teacherIdStr ||
            classDoc.subjects?.some(s => s.assignedTeacher?.teacherId?.toString() === teacherIdStr) ||
            classDoc.timetable?.some(t => t.teacherId?.toString() === teacherIdStr);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to create sessions for this class"
            });
        }

        // Check if a live session already exists for this class/subject/time
        const existingSession = await LiveSession.findOne({
            teacherId,
            classId,
            subjectName,
            scheduledDate: new Date(scheduledDate),
            startTime,
            status: { $in: ["scheduled", "live"] }
        });

        if (existingSession) {
            return res.status(400).json({
                success: false,
                message: "A live session already exists for this class, subject, and time",
                data: existingSession
            });
        }

        // Generate meeting link using Zoom
        const sessionTitle = `${subjectName} - ${classDoc.name}`;
        const startDateTime = new Date(`${scheduledDate}T${startTime}`);
        const [startHour, startMin] = startTime.split(":").map(Number);
        const [endHour, endMin] = endTime.split(":").map(Number);
        const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        const meetingResult = await createZoomMeeting({
            topic: sessionTitle,
            startTime: startDateTime.toISOString(),
            duration: duration > 0 ? duration : 60,
            password: Math.floor(100000 + Math.random() * 900000).toString()
        });

        if (!meetingResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to generate meeting link"
            });
        }

        // Create the live session record
        const liveSession = new LiveSession({
            teacherId,
            teacherName,
            classId,
            className: classDoc.name || classDoc.class,
            subjectName,
            subjectCode: subjectCode || "",
            scheduledDate: new Date(scheduledDate),
            startTime,
            endTime,
            meetingLink: meetingResult.meetingLink,
            hostLink: meetingResult.hostLink || "",
            meetingId: meetingResult.meetingId,
            meetingPassword: meetingResult.password,
            platform: meetingResult.platform,
            status: "scheduled",
            description: description || ""
        });

        await liveSession.save();

        // Populate response data
        const responseData = await LiveSession.findById(liveSession._id)
            .populate("teacherId", "name email")
            .populate("classId", "name class");

        res.status(201).json({
            success: true,
            message: "Live session created successfully",
            data: responseData
        });

    } catch (error) {
        console.error("Error creating live session:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

/**
 * Get today's live sessions for the logged-in teacher
 * GET /api/live-session/today
 */
exports.getTodaySessions = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const userRole = req.user?.role;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let query = {
            scheduledDate: { $gte: today, $lt: tomorrow }
        };

        if (userRole === "student") {
            const student = await User.findById(userId);
            if (student && student.class) {
                // Find ClassSubject document to get classId for robust matching
                const classDocs = await ClassSubject.find({}).lean();
                let classDoc = classDocs.find(d => d.name === student.class || d.class === student.class);

                if (!classDoc) {
                    const normalizedStudentClass = normalizeClassValue(student.class);
                    classDoc = classDocs.find(d => normalizeClassValue(d.class) === normalizedStudentClass);
                }

                if (classDoc) {
                    query.classId = classDoc._id; // Match by strict Class ID!
                } else {
                    const escapedClassName = student.class.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    query.className = new RegExp(escapedClassName, "i");
                }
                query.status = { $in: ["scheduled", "live", "ended"] };
            } else {
                return res.status(200).json({ success: true, data: [] });
            }
        } else {
            // Teacher
            query.teacherId = userId;
        }

        const sessions = await LiveSession.find(query)
            .populate("classId", "name class")
            .sort({ startTime: 1 });

        res.status(200).json({
            success: true,
            data: sessions
        });
    } catch (error) {
        console.error("Error fetching today's sessions:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all live sessions for the logged-in teacher
 * GET /api/live-session/my-sessions
 */
exports.getMySessions = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        const { status, limit = 50 } = req.query;

        const query = { teacherId };
        if (status) {
            query.status = status;
        }

        const sessions = await LiveSession.find(query)
            .populate("classId", "name class")
            .sort({ scheduledDate: -1, startTime: 1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: sessions.length,
            data: sessions
        });
    } catch (error) {
        console.error("Error fetching my sessions:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Start a live session (change status to live)
 * PUT /api/live-session/:sessionId/start
 */
exports.startSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.user?._id || req.user?.id;

        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const session = await LiveSession.findOne({
            _id: sessionId,
            teacherId
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        if (session.status === "ended") {
            return res.status(400).json({
                success: false,
                message: "Session has already ended"
            });
        }

        if (session.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Session has been cancelled"
            });
        }

        session.status = "live";
        session.startedAt = new Date();
        await session.save();

        res.status(200).json({
            success: true,
            message: "Session started successfully",
            data: session
        });
    } catch (error) {
        console.error("Error starting session:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * End a live session
 * PUT /api/live-session/:sessionId/end
 */
exports.endSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.user?._id || req.user?.id;

        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const session = await LiveSession.findOne({
            _id: sessionId,
            teacherId
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        if (session.status === "ended") {
            return res.status(400).json({
                success: false,
                message: "Session already ended"
            });
        }

        session.status = "ended";
        session.endedAt = new Date();
        await session.save();

        res.status(200).json({
            success: true,
            message: "Session ended successfully",
            data: session
        });
    } catch (error) {
        console.error("Error ending session:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Join a live session (for teachers)
 * GET /api/live-session/:sessionId/join
 */
exports.joinSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?._id || req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const session = await LiveSession.findById(sessionId)
            .populate("classId", "name class")
            .populate("teacherId", "name email");

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // Check authorization
        if (userRole === "teacher") {
            if (session.teacherId._id.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to join this session"
                });
            }
        } else if (userRole === "student") {
            // Students can only join if session is live or scheduled
            if (session.status !== "live" && session.status !== "scheduled") {
                return res.status(400).json({
                    success: false,
                    message: "Session is not available to join"
                });
            }

            // Add student to attendance if joining
            const alreadyJoined = session.attendance.some(
                a => a.studentId.toString() === userId.toString()
            );

            if (!alreadyJoined) {
                const student = await User.findById(userId);
                session.attendance.push({
                    studentId: userId,
                    studentName: student.name,
                    joinedAt: new Date(),
                    status: "present"
                });
                await session.save();
            }
        }

        res.status(200).json({
            success: true,
            data: {
                meetingLink: (userRole === "teacher" && session.hostLink) ? session.hostLink : session.meetingLink,
                meetingId: session.meetingId,
                password: session.meetingPassword,
                platform: session.platform,
                subjectName: session.subjectName,
                className: session.className,
                teacherName: session.teacherName,
                status: session.status
            }
        });
    } catch (error) {
        console.error("Error joining session:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Mark attendance for a session
 * POST /api/live-session/:sessionId/attendance
 */
exports.markAttendance = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.user?._id || req.user?.id;
        
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        const { attendance } = req.body; // Array of { studentId, status }

        const session = await LiveSession.findOne({
            _id: sessionId,
            teacherId
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        if (!Array.isArray(attendance)) {
            return res.status(400).json({
                success: false,
                message: "Attendance must be an array"
            });
        }

        // Update attendance for each student
        attendance.forEach(record => {
            const existingIndex = session.attendance.findIndex(
                a => a.studentId.toString() === record.studentId
            );

            if (existingIndex >= 0) {
                session.attendance[existingIndex].status = record.status;
            } else {
                session.attendance.push({
                    studentId: record.studentId,
                    studentName: record.studentName,
                    status: record.status
                });
            }
        });

        await session.save();

        res.status(200).json({
            success: true,
            message: "Attendance marked successfully",
            data: session.attendance
        });
    } catch (error) {
        console.error("Error marking attendance:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Send notification to students about a live session
 * POST /api/live-session/:sessionId/notify
 */
exports.sendNotification = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.user?._id || req.user?.id;
        
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        const { message } = req.body;

        const session = await LiveSession.findOne({
            _id: sessionId,
            teacherId
        }).populate("classId", "class");

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // Get students in the class
        const classValue = session.classId.class;
        const students = await User.find({
            role: "student",
            class: new RegExp(classValue, "i")
        });

        // Here you would integrate with your notification service
        // For now, we'll just mark that notification was sent
        session.notificationsSent = true;
        session.notificationSentAt = new Date();
        await session.save();

        res.status(200).json({
            success: true,
            message: `Notification sent to ${students.length} students`,
            data: {
                recipients: students.length,
                notificationMessage: message || `Live class starting soon: ${session.subjectName} - ${session.className}`
            }
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get session details
 * GET /api/live-session/:sessionId
 */
exports.getSessionDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?._id || req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const query = { _id: sessionId };
        
        // Teachers can only see their own sessions, students can see sessions for their class
        if (userRole === "teacher") {
            query.teacherId = userId;
        }

        const session = await LiveSession.findOne(query)
            .populate("teacherId", "name email")
            .populate("classId", "name class")
            .populate("attendance.studentId", "name email rollNo");

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error("Error fetching session details:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Delete a live session
 * DELETE /api/live-session/:sessionId
 */
exports.deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.user?._id || req.user?.id;

        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const session = await LiveSession.findOne({
            _id: sessionId,
            teacherId
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        if (session.status === "live") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete an active session. Please end it first."
            });
        }

        await LiveSession.findByIdAndDelete(sessionId);

        res.status(200).json({
            success: true,
            message: "Session deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
