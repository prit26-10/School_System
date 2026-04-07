const Notice = require("../../models/Notice");

const postNotice = async (req, res) => {
    try {
        const { title, type, recipientGroup, content } = req.body;
        
        if (!title || !type || !recipientGroup || !content) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        let target = "all_users";
        if (recipientGroup === "Students") {
            target = "all_students";
        } else if (recipientGroup === "Teachers") {
            target = "teachers";
        } else if (recipientGroup === "All") {
            target = "all_users";
        }

        const newNotice = new Notice({
            title,
            type,
            recipientGroup,
            target,
            content,
            sender: req.user._id,
            createdByRole: "admin" // Mark as admin-created
        });

        await newNotice.save();

        res.status(201).json({
            success: true,
            message: "Notice posted successfully",
            notice: newNotice
        });
    } catch (error) {
        console.error("Error posting notice:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while posting notice"
        });
    }
};

const getAllNotices = async (req, res) => {
    try {
        // Only fetch notices created by admin
        const notices = await Notice.find({ createdByRole: "admin" }).sort({ createdAt: -1 });
        res.json({
            success: true,
            notices
        });
    } catch (error) {
        console.error("Error fetching notices:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while fetching notices"
        });
    }
};

const deleteNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const notice = await Notice.findByIdAndDelete(id);

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: "Notice not found"
            });
        }

        res.json({
            success: true,
            message: "Notice deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting notice:", error);
        res.status(500).json({
            success: false,
            message: "Server Error while deleting notice"
        });
    }
};

module.exports = {
    postNotice,
    getAllNotices,
    deleteNotice
};
