const Material = require("../../models/Material");
const ClassSubject = require("../../models/ClassSubject");
const path = require("path");
const fs = require("fs");

/**
 * Upload a study material (PDF, Video, or Document)
 */
exports.uploadMaterial = async (req, res) => {
    try {
        const { title, description, type, targetClass } = req.body;
        const teacherId = req.user._id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a file" });
        }

        if (!title || !type || !targetClass) {
            return res.status(400).json({ success: false, message: "Title, type, and target class are required" });
        }

        // Verify if teacher is assigned to this class
        const classObj = await ClassSubject.findOne({
            class: targetClass,
            $or: [
                { "assignedTeacher.teacherId": teacherId.toString() },
                { "subjects.assignedTeacher.teacherId": teacherId.toString() },
                { "timetable.teacherId": teacherId.toString() }
            ]
        });

        if (!classObj) {
            return res.status(403).json({ 
                success: false, 
                message: "You are not authorized to upload materials for this class." 
            });
        }

        const material = new Material({
            title,
            description,
            type,
            fileUrl: `/uploads/materials/${req.file.filename}`,
            targetClass,
            class_id: targetClass,
            teacherId
        });

        await material.save();

        res.status(201).json({
            success: true,
            message: "Material uploaded successfully",
            material
        });

    } catch (error) {
        console.error("Error in uploadMaterial:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * Get all materials uploaded by the logged-in teacher
 */
exports.getMyMaterials = async (req, res) => {
    try {
        const materials = await Material.find({ teacherId: req.user._id }).sort({ uploadDate: -1 });
        res.status(200).json({ success: true, materials });
    } catch (error) {
        console.error("Error in getMyMaterials:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * Delete a material
 */
exports.deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findOne({ _id: req.params.id, teacherId: req.user._id });

        if (!material) {
            return res.status(404).json({ success: false, message: "Material not found" });
        }

        // Delete file from filesystem
        const filePath = path.join(__dirname, "../../", material.fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await material.deleteOne();

        res.status(200).json({ success: true, message: "Material deleted successfully" });
    } catch (error) {
        console.error("Error in deleteMaterial:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
