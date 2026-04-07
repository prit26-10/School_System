const Assignment = require("../../models/Assignment");
const User = require("../../models/User");
const ClassSubject = require("../../models/ClassSubject");
const mongoose = require("mongoose");

// Get all assignments for the logged-in teacher
exports.getTeacherAssignments = async (req, res) => {
    try {
        const teacherId = req.user.id;
        
        const assignments = await Assignment.find({ teacherId })
            .sort({ createdAt: -1 })
            .lean();

        // Add computed status based on deadline
        const assignmentsWithStatus = assignments.map(assignment => {
            const now = new Date();
            const deadline = new Date(assignment.deadline);
            let computedStatus = assignment.status;
            
            if (assignment.status === "published" && now > deadline) {
                computedStatus = "expired";
            }
            
            return {
                ...assignment,
                computedStatus,
                submissionCount: assignment.submissions ? assignment.submissions.length : 0
            };
        });

        res.status(200).json({
            success: true,
            data: assignmentsWithStatus
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Get teacher assignments error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch assignments",
            error: error.message
        });
    }
};

// Create a new assignment
exports.createAssignment = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { title, description, class: className, subject, deadline, totalMarks, allowLateSubmission } = req.body;

        // Validate required fields
        if (!title || !className || !subject || !deadline) {
            return res.status(400).json({
                success: false,
                message: "Title, class, subject, and deadline are required"
            });
        }

        // Get teacher details
        const teacher = await User.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found"
            });
        }

        // Handle file upload if present
        let fileUrl = "";
        let fileName = "";
        if (req.file) {
            fileUrl = `/uploads/materials/${req.file.filename}`;
            fileName = req.file.originalname;
        }

        const assignment = new Assignment({
            title,
            description: description || "",
            class: className,
            subject,
            teacherId,
            teacherName: teacher.name,
            deadline: new Date(deadline),
            fileUrl,
            fileName,
            totalMarks: totalMarks || 100,
            allowLateSubmission: allowLateSubmission || false,
            status: "published"
        });

        await assignment.save();

        res.status(201).json({
            success: true,
            message: "Assignment created successfully",
            data: assignment
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Create assignment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create assignment",
            error: error.message
        });
    }
};

// Update an existing assignment
exports.updateAssignment = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { id } = req.params;
        const { title, description, class: className, subject, deadline, totalMarks, allowLateSubmission, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid assignment ID"
            });
        }

        const assignment = await Assignment.findOne({ _id: id, teacherId });
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found or you don't have permission"
            });
        }

        // Update fields
        if (title) assignment.title = title;
        if (description !== undefined) assignment.description = description;
        if (className) assignment.class = className;
        if (subject) assignment.subject = subject;
        if (deadline) assignment.deadline = new Date(deadline);
        if (totalMarks) assignment.totalMarks = totalMarks;
        if (allowLateSubmission !== undefined) assignment.allowLateSubmission = allowLateSubmission;
        if (status) assignment.status = status;

        // Handle file upload if present
        if (req.file) {
            assignment.fileUrl = `/uploads/materials/${req.file.filename}`;
            assignment.fileName = req.file.originalname;
        }

        await assignment.save();

        res.status(200).json({
            success: true,
            message: "Assignment updated successfully",
            data: assignment
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Update assignment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update assignment",
            error: error.message
        });
    }
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid assignment ID"
            });
        }

        const assignment = await Assignment.findOneAndDelete({ _id: id, teacherId });
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found or you don't have permission"
            });
        }

        res.status(200).json({
            success: true,
            message: "Assignment deleted successfully"
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Delete assignment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete assignment",
            error: error.message
        });
    }
};

// Get submissions for a specific assignment
exports.getSubmissions = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid assignment ID"
            });
        }

        const assignment = await Assignment.findOne({ _id: id, teacherId })
            .populate("submissions.studentId", "name userId email");

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found or you don't have permission"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                assignment: {
                    _id: assignment._id,
                    title: assignment.title,
                    class: assignment.class,
                    subject: assignment.subject,
                    deadline: assignment.deadline,
                    totalMarks: assignment.totalMarks
                },
                submissions: assignment.submissions
            }
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Get submissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch submissions",
            error: error.message
        });
    }
};

// Get all submissions across all assignments for a teacher
exports.getAllTeacherSubmissions = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { assignmentId, status } = req.query;

        let query = { teacherId };
        if (assignmentId && mongoose.Types.ObjectId.isValid(assignmentId)) {
            query._id = assignmentId;
        }

        const assignments = await Assignment.find(query)
            .select("title class subject deadline totalMarks submissions")
            .lean();

        let allSubmissions = [];

        assignments.forEach(assignment => {
            if (assignment.submissions && assignment.submissions.length > 0) {
                assignment.submissions.forEach(sub => {
                    if (!status || sub.status === status) {
                        allSubmissions.push({
                            ...sub,
                            assignment: {
                                _id: assignment._id,
                                title: assignment.title,
                                class: assignment.class,
                                subject: assignment.subject,
                                deadline: assignment.deadline,
                                totalMarks: assignment.totalMarks
                            }
                        });
                    }
                });
            }
        });

        // Sort by submission date (newest first)
        allSubmissions.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

        res.status(200).json({
            success: true,
            data: allSubmissions
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Get all submissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch submissions",
            error: error.message
        });
    }
};

// Evaluate a submission (add marks and feedback)
exports.evaluateSubmission = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { submissionId } = req.params;
        const { marks, feedback } = req.body;

        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid submission ID"
            });
        }

        if (marks === undefined || marks === null) {
            return res.status(400).json({
                success: false,
                message: "Marks are required"
            });
        }

        const assignment = await Assignment.findOne({
            teacherId,
            "submissions._id": submissionId
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Submission not found or you don't have permission"
            });
        }

        const submission = assignment.submissions.id(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: "Submission not found"
            });
        }

        // Validate marks don't exceed total
        if (marks > assignment.totalMarks) {
            return res.status(400).json({
                success: false,
                message: `Marks cannot exceed total marks (${assignment.totalMarks})`
            });
        }

        submission.marks = marks;
        submission.feedback = feedback || "";
        submission.status = "evaluated";
        submission.evaluatedAt = new Date();
        submission.evaluatedBy = teacherId;

        await assignment.save();

        res.status(200).json({
            success: true,
            message: "Submission evaluated successfully",
            data: submission
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Evaluate submission error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to evaluate submission",
            error: error.message
        });
    }
};

// Publish marks for submissions
exports.publishMarks = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { submissionIds } = req.body;

        if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Submission IDs array is required"
            });
        }

        // Validate all IDs
        const validIds = submissionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        if (validIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid submission IDs provided"
            });
        }

        // Find all assignments with these submissions belonging to this teacher
        const assignments = await Assignment.find({
            teacherId,
            "submissions._id": { $in: validIds }
        });

        let publishedCount = 0;

        for (const assignment of assignments) {
            for (const submissionId of validIds) {
                const submission = assignment.submissions.id(submissionId);
                if (submission && submission.status === "evaluated") {
                    submission.status = "published";
                    submission.publishedAt = new Date();
                    publishedCount++;
                }
            }
            await assignment.save();
        }

        res.status(200).json({
            success: true,
            message: `Published marks for ${publishedCount} submission(s)`,
            publishedCount
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Publish marks error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to publish marks",
            error: error.message
        });
    }
};

// Get teacher's assigned classes and subjects
exports.getTeacherClassesAndSubjects = async (req, res) => {
    try {
        const teacherMongoId = req.user._id ? req.user._id.toString() : req.user.id;

        // Find all classes where this teacher is assigned (as class teacher, subject teacher, or in timetable)
        const classSubjects = await ClassSubject.find({
            $or: [
                { "assignedTeacher.teacherId": teacherMongoId },
                { "subjects.assignedTeacher.teacherId": teacherMongoId },
                { "timetable.teacherId": teacherMongoId }
            ]
        }).lean();

        const classesMap = new Map();

        classSubjects.forEach(cs => {
            // Include class even if no specific subjects are mapped by default
            if (!classesMap.has(cs.class)) {
                classesMap.set(cs.class, new Set());
            }

            // If teacher is assigned to the whole class, they might teach anything
            // Often we just rely on subjects they are explicitly mapped to
            
            // Check individual subject assignments
            if (cs.subjects && cs.subjects.length > 0) {
                cs.subjects.forEach(sub => {
                    if (sub.assignedTeacher && sub.assignedTeacher.teacherId === teacherMongoId) {
                        classesMap.get(cs.class).add(sub.name);
                    }
                });
            }

            // Check timetable assignments to gather subjects taught
            if (cs.timetable && cs.timetable.length > 0) {
                cs.timetable.forEach(t => {
                    if (t.teacherId === teacherMongoId && t.subjectName) {
                        classesMap.get(cs.class).add(t.subjectName);
                    }
                });
            }
        });

        const result = Array.from(classesMap.entries()).map(([className, subjects]) => ({
            class: className,
            subjects: Array.from(subjects)
        }));

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("[ASSIGNMENT] Get teacher classes error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch teacher classes",
            error: error.message
        });
    }
};
