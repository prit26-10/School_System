const Notice = require("../../models/Notice");
const ClassSubject = require("../../models/ClassSubject");

/**
 * Get notices relevant to the teacher (from Admin)
 */
const getAdminNotices = async (req, res) => {
    try {
        const notices = await Notice.find({
            recipientGroup: { $in: ["All", "Teachers"] }
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            notices
        });
    } catch (error) {
        console.error("Error fetching admin notices:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching notices"
        });
    }
};

/**
 * Post an announcement to a specific class assigned to the teacher
 */
const postClassAnnouncement = async (req, res) => {
    try {
        const { title, type, targetClass: targetClassId, content } = req.body;
        
        // Use _id.toString() for consistent string comparison
        const teacherId = req.user._id.toString(); 

        console.log(`[DEBUG-ANNOUNCE] Attempting to post. Teacher: ${teacherId}, Class ID: ${targetClassId}`);

        if (!title || !type || !targetClassId || !content) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // 1. Find the class by ID first to get its identifier (e.g. "10")
        const classObj = await ClassSubject.findById(targetClassId);
        
        if (!classObj) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        // 2. Verify if the teacher is assigned to this class (as Class Teacher, Subject Teacher, or in Timetable)
        const isAuthorized = 
            classObj.assignedTeacher?.teacherId === teacherId ||
            (classObj.subjects && classObj.subjects.some(s => s.assignedTeacher?.teacherId === teacherId)) ||
            (classObj.timetable && classObj.timetable.some(t => t.teacherId === teacherId));

        if (!isAuthorized) {
            console.log(`[DEBUG-ANNOUNCE] Authorization failed for Teacher ${teacherId} on Class ${classObj.name}`);
            return res.status(403).json({
                success: false,
                message: "You are not authorized to post announcements for this class. You must be an assigned teacher for this class."
            });
        }

        const newNotice = new Notice({
            title,
            type,
            recipientGroup: "Students",
            target: "specific_class",
            class_id: classObj.class,
            content,
            sender: req.user._id, // Store as ObjectId for ref
            createdByRole: "teacher", // Mark as teacher-created
            targetClass: classObj.class // Store the class identifier (e.g. "10") for student matching
        });

        await newNotice.save();
        console.log(`[DEBUG-ANNOUNCE] Success! Notice ID: ${newNotice._id} for Class ${classObj.class}`);

        res.status(201).json({
            success: true,
            message: "Announcement posted successfully",
            notice: newNotice
        });
    } catch (error) {
        console.error("Error posting class announcement:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while posting announcement"
        });
    }
};

/**
 * Get announcements posted by the teacher
 */
const getMyAnnouncements = async (req, res) => {
    try {
        const teacherId = req.user._id;
        console.log(`[DEBUG-ANNOUNCE] Fetching announcements for teacher: ${teacherId}`);
        
        const notices = await Notice.find({ sender: teacherId }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            notices
        });
    } catch (error) {
        console.error("Error fetching my announcements:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching announcements"
        });
    }
};

module.exports = {
    getAdminNotices,
    postClassAnnouncement,
    getMyAnnouncements
};
