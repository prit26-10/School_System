const ClassSubject = require("../../models/ClassSubject");
const User = require("../../models/User");

function normalizeClassValue(classValue) {
    if (!classValue) return "";
    const str = String(classValue).trim();
    const match = str.match(/(\d+)/);
    return (match ? match[1] : str).toLowerCase();
}

exports.getStudentTimetable = async (req, res) => {
    try {
        // Fetch full user data from database to get class information
        const user = await User.findById(req.user.id).lean();
        const studentClass = user?.class_id || user?.class || user?.studentData?.class;

        if (!studentClass) {
            return res.status(400).json({
                success: false,
                message: "Student class not found in profile. Please update your profile with class information."
            });
        }

        // Find the ClassSubject document using normalized class matching.
        const classDocs = await ClassSubject.find({}).lean();
        const normalizedStudentClass = normalizeClassValue(studentClass);
        const classSubjectData = classDocs.find(
            (doc) => normalizeClassValue(doc.class) === normalizedStudentClass
        );

        if (!classSubjectData) {
            return res.status(404).json({
                success: false,
                message: "No class configuration found for your grade."
            });
        }

        const rawTimetable = classSubjectData.timetable || [];
        
        // Group the timetable by day to make it easier for the frontend to render
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timetableGrid = {};
        
        days.forEach(day => timetableGrid[day] = []);

        if (rawTimetable.length > 0) {
            rawTimetable.forEach(t => {
                if (t.day && timetableGrid[t.day]) {
                    timetableGrid[t.day].push({
                        id: t._id,
                        startTime: t.startTime,
                        endTime: t.endTime,
                        subjectName: t.subjectName,
                        subjectCode: t.subjectCode,
                        teacherName: t.teacherName,
                        teacherId: t.teacherId
                    });
                }
            });

            // Sort slots chronologically within each day
            days.forEach(day => {
                timetableGrid[day].sort((a, b) => {
                    const timeA = new Date(`1970/01/01 ${a.startTime}`).getTime();
                    const timeB = new Date(`1970/01/01 ${b.startTime}`).getTime();
                    return timeA - timeB;
                });
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                className: studentClass,
                timetable: timetableGrid,
                rawTimetable: rawTimetable, 
                totalSessions: rawTimetable.length
            }
        });

    } catch (error) {
        console.error("Error fetching student timetable:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch timetable data.",
            error: error.message
        });
    }
};
