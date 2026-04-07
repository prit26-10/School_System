const Material = require("../../models/Material");
const User = require("../../models/User");

function normalizeClassValue(classValue) {
    if (!classValue) return "";
    const str = String(classValue).trim();
    const match = str.match(/(\d+)/);
    return (match ? match[1] : str).toLowerCase();
}

/**
 * Get all study materials for the student's class
 */
exports.getMyMaterials = async (req, res) => {
    try {
        // Fetch full user data to get class information
        const user = await User.findById(req.user.id).lean();
        const studentClass = user?.class_id || user?.class || user?.studentData?.class;


        if (!studentClass) {
            return res.status(400).json({
                success: false,
                message: "Student class not found in profile. Please update your profile with class information."
            });
        }

        // Read both new and legacy class fields, then normalize to avoid formatting mismatches.
        const materials = await Material.find({
            $or: [
                { class_id: studentClass },
                { targetClass: studentClass },
                { class_id: { $regex: normalizeClassValue(studentClass), $options: "i" } },
                { targetClass: { $regex: normalizeClassValue(studentClass), $options: "i" } }
            ]
        })
            .populate('teacherId', 'name email')
            .sort({ uploadDate: -1 });

        const normalizedStudentClass = normalizeClassValue(studentClass);
        const filteredMaterials = materials.filter((material) => {
            const materialClass = material.class_id || material.targetClass;
            return normalizeClassValue(materialClass) === normalizedStudentClass;
        });

        res.status(200).json({
            success: true,
            materials: filteredMaterials,
            className: studentClass
        });

    } catch (error) {
        console.error("Error in getMyMaterials:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching materials"
        });
    }
};
