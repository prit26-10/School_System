const User = require("../../models/User");
const bcrypt = require("bcryptjs");

const getAllTeachers = async (req, res) => {
    try {
        const teachers = await User.find({ role: "teacher" }).select("-password").sort({ createdAt: -1 });

        res.json({
            success: true,
            count: teachers.length,
            teachers,
        });
    } catch (error) {
        console.error("Error fetching teachers:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching teachers",
        });
    }
};

const updateTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Hash password if provided
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        const teacher = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select("-password");

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found",
            });
        }

        res.json({
            success: true,
            message: "Teacher updated successfully",
            teacher,
        });
    } catch (error) {
        console.error("Error updating teacher:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while updating teacher",
        });
    }
};

const deleteTeacher = async (req, res) => {
    try {
        const { id } = req.params;

        const teacher = await User.findByIdAndDelete(id);

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found",
            });
        }

        res.json({
            success: true,
            message: "Teacher deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting teacher:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while deleting teacher",
        });
    }
};

// Student Management Functions
const getAllStudents = async (req, res) => {
    try {
        const students = await User.find({ role: "student" }).select("-password").sort({ createdAt: -1 });

        res.json({
            success: true,
            data: students,
        });
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching students",
        });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Hash password if provided
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        const student = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select("-password");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        res.json({
            success: true,
            message: "Student updated successfully",
            student,
        });
    } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while updating student",
        });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await User.findByIdAndDelete(id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        res.json({
            success: true,
            message: "Student deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while deleting student",
        });
    }
};

module.exports = {
    getAllTeachers,
    updateTeacher,
    deleteTeacher,
    getAllStudents,
    updateStudent,
    deleteStudent,
};
