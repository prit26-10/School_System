const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");

/**
 * Helper function to normalize class value
 * Extracts numeric class value from various formats ("11", "Class 11", "class 11")
 * @param {string} classValue - The class value to normalize
 * @returns {string|null} - The normalized numeric class value or null
 */
function normalizeClassValue(classValue) {
    if (!classValue) return null;
    const str = String(classValue).trim();
    // Extract numeric part from strings like "Class 11", "class 11", "11"
    const match = str.match(/(\d+)/);
    return match ? match[1] : str;
}

/**
 * Helper function to check if a student's class matches the target class
 * @param {string} studentClass - The student's class value
 * @param {string} targetClassValue - The target class value (numeric, e.g., "11")
 * @returns {boolean} - True if classes match
 */
function isClassMatch(studentClass, targetClassValue) {
    if (!studentClass || !targetClassValue) return false;
    const normalizedStudentClass = normalizeClassValue(studentClass);
    const normalizedTargetClass = normalizeClassValue(targetClassValue);
    return normalizedStudentClass === normalizedTargetClass;
}

/**
 * Get all classes assigned to the logged-in teacher
 * Including student list and timetable for each class
 */
exports.getAssignedClasses = async (req, res) => {
    try {
        console.log("getAssignedClasses: req.user exists?", !!req.user);
        if (!req.user) {
            console.log("getAssignedClasses: req.user is UNDEFINED");
            return res.status(401).json({ success: false, message: "Unauthorized: User info missing" });
        }

        const teacherMongoId = req.user._id.toString();
        console.log("getAssignedClasses: Fetching classes for teacher MongoDB ID:", teacherMongoId);

        // Find classes where the teacher is assigned to the class or any subject in it
        // Or if the teacher is assigned as the class teacher
        const classes = await ClassSubject.find({
            $or: [
                { "assignedTeacher.teacherId": teacherMongoId },
                { "subjects.assignedTeacher.teacherId": teacherMongoId },
                { "timetable.teacherId": teacherMongoId }
            ]
        }).lean();

        if (!classes || classes.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No classes assigned yet.",
                data: []
            });
        }

        // Get all unique class values assigned to this teacher
        const assignedClassValues = classes.map(cls => normalizeClassValue(cls.class)).filter(Boolean);
        console.log("Assigned class values:", assignedClassValues);

        // Fetch all students and filter by class in JS to avoid Mongoose casting issues
        const allStudents = await User.find({ role: "student" })
            .select("class name email userId profileImage mobileNumber age studentData")
            .lean();

        // For each class, filter students that belong to it
        const classesWithDetails = classes.map((cls) => {
            const classValue = cls.class; // e.g. "11", "Class 11"
            const name = cls.name;   // e.g. "Class 11"

            // Filter students belonging to this class
            const validStudents = allStudents.filter(s => {
                const studentClass = s.class || s.studentData?.class;
                return isClassMatch(studentClass, classValue);
            });

            // Sort logic
            validStudents.sort((a, b) => {
                const rollA = a.studentData?.rollNo || 0;
                const rollB = b.studentData?.rollNo || 0;
                return rollA - rollB;
            });

            console.log(`Class: ${name} (Class: ${classValue}), Valid Student Count: ${validStudents.length}`);

            return {
                ...cls,
                timetable: cls.timetable || [],
                students: validStudents,
                studentCount: validStudents.length,
                isClassTeacher: cls.assignedTeacher?.teacherId === teacherMongoId
            };
        });

        res.status(200).json({
            success: true,
            data: classesWithDetails
        });

    } catch (err) {
        console.error("Error fetching assigned classes:", err);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching assigned classes"
        });
    }
};

/**
 * Get students and timetable for a specific class
 */
exports.getClassDetails = async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherMongoId = req.user._id.toString();

        const cls = await ClassSubject.findById(classId).lean();
        if (!cls) {
            return res.status(404).json({ success: false, message: "Class not found" });
        }

        // Check authorization
        const isAuthorized =
            cls.assignedTeacher?.teacherId === teacherMongoId ||
            (cls.subjects && cls.subjects.some(s => s.assignedTeacher?.teacherId === teacherMongoId)) ||
            (cls.timetable && cls.timetable.some(t => t.teacherId === teacherMongoId));

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Forbidden: Not assigned to this class" });
        }

        const classValue = cls.class; // e.g. "11", "Class 11"
        const name = cls.name;   // e.g. "Class 11"
        const normalizedClassValue = normalizeClassValue(classValue);

        // Fetch all students and filter by class in JS to avoid Mongoose casting issues
        const allStudents = await User.find({ role: "student" })
            .select("class name email userId profileImage mobileNumber age studentData")
            .lean();

        // Filter students belonging to this class
        const validStudents = allStudents.filter(s => {
            const studentClass = s.class || s.studentData?.class;
            return isClassMatch(studentClass, classValue);
        });

        // Sort students
        validStudents.sort((a, b) => {
            const rollA = a.studentData?.rollNo || 0;
            const rollB = b.studentData?.rollNo || 0;
            return rollA - rollB;
        });

        console.log(`[getClassDetails] Class: ${name} (Class: ${classValue}), Valid Student Count: ${validStudents.length}`);

        // Format Timetable for grid
        const timetableGrid = {};
        const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        days.forEach(day => timetableGrid[day] = []);

        if (cls.timetable && cls.timetable.length > 0) {
            cls.timetable.forEach(t => {
                const day = t.day.toLowerCase();
                if (days.includes(day)) {
                    timetableGrid[day].push({
                        startTime: t.startTime,
                        endTime: t.endTime,
                        subjectName: t.subjectName,
                        subjectCode: t.subjectCode,
                        teacherName: t.teacherName
                    });
                }
            });
            // Sort each day by startTime
            days.forEach(day => {
                timetableGrid[day].sort((a, b) => {
                    return a.startTime.localeCompare(b.startTime);
                });
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...cls,
                isClassTeacher: cls.assignedTeacher?.teacherId === teacherMongoId,
                students: validStudents,
                timetableGrid
            }
        });

    } catch (err) {
        console.error("Error in getClassDetails:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * Get only students for a specific assigned class
 */
exports.getAssignedClassStudents = async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherMongoId = req.user._id.toString();

        const cls = await ClassSubject.findById(classId).lean();
        if (!cls) {
            return res.status(404).json({ success: false, message: "Class not found" });
        }

        // Check authorization
        const isAuthorized =
            cls.assignedTeacher?.teacherId === teacherMongoId ||
            (cls.subjects && cls.subjects.some(s => s.assignedTeacher?.teacherId === teacherMongoId)) ||
            (cls.timetable && cls.timetable.some(t => t.teacherId === teacherMongoId));

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Forbidden: Not assigned to this class" });
        }

        const classValue = cls.class;
        const name = cls.name;
        const normalizedClassValue = normalizeClassValue(classValue);

        // Fetch all students and filter by class in JS to avoid Mongoose casting issues
        const allStudents = await User.find({ role: "student" })
            .select("class name email userId profileImage mobileNumber age studentData createdAt")
            .lean();

        // Filter students belonging to this class and build address
        const validStudents = allStudents.filter(s => {
            const studentClass = s.class || s.studentData?.class;
            return isClassMatch(studentClass, classValue);
        }).map(s => {
            const studentData = s.studentData || {};
            const addressParts = [studentData.streetAddress, studentData.city, studentData.state, studentData.zipCode, studentData.country].filter(Boolean);
            return {
                ...s,
                address: addressParts.join(', ') || null,
                admissionDate: s.createdAt
            };
        });

        res.status(200).json({
            success: true,
            count: validStudents.length,
            data: validStudents
        });

    } catch (err) {
        console.error("Error in getAssignedClassStudents:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
