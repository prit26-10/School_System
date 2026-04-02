const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");
const mongoose = require("mongoose");

// Assign teacher to a class
exports.assignTeacherToClass = async (req, res) => {
    try {
        // Debug Log as requested
        console.log("[ASSIGN] Request Params:", req.params);
        console.log("[ASSIGN] Request Body:", req.body);

        // Flexible destructuring to handle different naming conventions
        const { classId: paramClassId } = req.params;
        const { class: bodyClassId, teacherId, teacher: bodyTeacherId } = req.body;

        const classId = paramClassId || bodyClassId;
        const finalTeacherId = teacherId || bodyTeacherId;

        if (!classId) {
            return res.status(400).json({ success: false, message: "Class is required" });
        }
        if (!finalTeacherId) {
            return res.status(400).json({ success: false, message: "Teacher ID is required" });
        }

        if (isNaN(parseInt(classId))) {
            return res.status(400).json({ success: false, message: "Invalid Class format" });
        }
        if (!mongoose.Types.ObjectId.isValid(finalTeacherId)) {
            return res.status(400).json({ success: false, message: "Invalid Teacher ID format" });
        }

        // Find the teacher
        const teacher = await User.findById(finalTeacherId);
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(404).json({
                success: false,
                message: "Teacher not found or user is not a teacher"
            });
        }

        // Atomic update using findOneAndUpdate by numeric class
        const updatedClass = await ClassSubject.findOneAndUpdate(
            { class: parseInt(classId) },
            {
                $set: {
                    assignedTeacher: {
                        teacherId: finalTeacherId.toString(),
                        teacherName: teacher.name,
                        teacherEmail: teacher.email,
                        assignedAt: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        console.log(`[ASSIGN] Successfully assigned teacher ${teacher.name} to class ${updatedClass.name}`);

        res.status(200).json({
            success: true,
            message: "Teacher assigned to class successfully",
            data: updatedClass
        });
    } catch (err) {
        console.error("Error in assignTeacherToClass:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

// Get all classes with their assigned teachers
exports.getClassesWithTeachers = async (req, res) => {
    try {
        const classes = await ClassSubject.find().select('name class assignedTeacher');

        res.status(200).json({
            success: true,
            data: classes
        });
    } catch (err) {
        console.error("Error in getClassesWithTeachers:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

// Remove teacher from class
exports.removeTeacherFromClass = async (req, res) => {
    try {
        const { classId } = req.params;
        console.log(`[ASSIGN] Removing teacher from class ${classId}`);

        if (isNaN(parseInt(classId))) {
            return res.status(400).json({ success: false, message: "Invalid Class format" });
        }

        const updatedClass = await ClassSubject.findOneAndUpdate(
            { class: parseInt(classId) },
            {
                $unset: { assignedTeacher: "" }
            },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Teacher removed from class successfully",
            data: updatedClass
        });
    } catch (err) {
        console.error("Error in removeTeacherFromClass:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

// Assign teacher to a specific subject in a class
exports.assignTeacherToSubject = async (req, res) => {
    try {
        const { classId, subjectId } = req.params;
        const { teacherId, teacher: bodyTeacherId } = req.body;
        const finalTeacherId = teacherId || bodyTeacherId;

        if (isNaN(parseInt(classId)) || !mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({ success: false, message: "Invalid Class or Subject ID" });
        }
        if (!finalTeacherId || !mongoose.Types.ObjectId.isValid(finalTeacherId)) {
            return res.status(400).json({ success: false, message: "Invalid or missing Teacher ID" });
        }

        const teacher = await User.findById(finalTeacherId);
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(404).json({
                success: false,
                message: "Teacher not found"
            });
        }

        const updatedClass = await ClassSubject.findOneAndUpdate(
            { class: parseInt(classId), "subjects._id": subjectId },
            {
                $set: {
                    "subjects.$.assignedTeacher": {
                        teacherId: finalTeacherId.toString(),
                        teacherName: teacher.name,
                        teacherEmail: teacher.email,
                        assignedAt: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                message: "Class or Subject not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Teacher assigned to subject successfully",
            data: updatedClass
        });
    } catch (err) {
        console.error("Error in assignTeacherToSubject:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

// Remove teacher from a specific subject in a class
exports.removeTeacherFromSubject = async (req, res) => {
    try {
        const { classId, subjectId } = req.params;

        if (isNaN(parseInt(classId)) || !mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({ success: false, message: "Invalid Class or Subject ID" });
        }

        const updatedClass = await ClassSubject.findOneAndUpdate(
            { class: parseInt(classId), "subjects._id": subjectId },
            {
                $unset: { "subjects.$.assignedTeacher": "" }
            },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                message: "Class or Subject not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Teacher removed from subject successfully",
            data: updatedClass
        });
    } catch (err) {
        console.error("Error in removeTeacherFromSubject:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};
