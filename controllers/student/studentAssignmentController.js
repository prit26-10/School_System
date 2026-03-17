const Assignment = require("../../models/Assignment");
const User = require("../../models/User");

function normalizeClassValue(classValue) {
    if (!classValue) return "";
    const str = String(classValue).trim();
    const match = str.match(/(\d+)/);
    return (match ? match[1] : str).toLowerCase();
}

exports.getMyAssignments = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).lean();
        const studentClass = student?.class_id || student?.class;

        if (!studentClass) {
            return res.status(400).json({
                success: false,
                message: "Student class not found in profile. Please update your profile with class information."
            });
        }

        const status = String(req.query.status || "all").toLowerCase();
        const normalizedStudentClass = normalizeClassValue(studentClass);

        const assignments = await Assignment.find({ status: { $ne: "draft" } })
            .sort({ createdAt: -1 })
            .lean();

        const classAssignments = assignments
            .filter((assignment) => normalizeClassValue(assignment.class) === normalizedStudentClass)
            .map((assignment) => {
                const submissions = Array.isArray(assignment.submissions) ? assignment.submissions : [];
                const mySubmission = submissions.find(
                    (submission) => String(submission.studentId) === String(req.user.id)
                );

                return {
                    ...assignment,
                    isSubmitted: Boolean(mySubmission),
                    mySubmission: mySubmission || null
                };
            });

        const filteredAssignments = classAssignments.filter((assignment) => {
            if (status === "pending") return !assignment.isSubmitted;
            if (status === "submitted") return assignment.isSubmitted;
            return true;
        });

        return res.status(200).json({
            success: true,
            className: studentClass,
            assignments: filteredAssignments
        });
    } catch (error) {
        console.error("Error fetching student assignments:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assignments"
        });
    }
};

exports.submitAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comments } = req.body;
        const studentId = req.user.id;

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        const assignment = await Assignment.findById(id);
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Assignment not found" });
        }

        // Check already submitted
        const existingSubmission = assignment.submissions.find(
            s => String(s.studentId) === String(studentId)
        );
        if (existingSubmission) {
            return res.status(400).json({ success: false, message: "Assignment already submitted" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a file for submission." });
        }

        const fileUrl = `/uploads/material/${req.file.filename}`;
        const fileName = req.file.originalname;

        const isLate = new Date() > new Date(assignment.deadline);
        if (isLate && !assignment.allowLateSubmission) {
            return res.status(400).json({ success: false, message: "Deadline has passed. Late submissions are not allowed." });
        }

        const submission = {
            studentId,
            studentName: student.name,
            studentUserId: student.userId || student.id,
            fileUrl,
            fileName,
            feedback: comments || "",
            status: isLate ? "late" : "submitted",
            submissionDate: new Date()
        };

        assignment.submissions.push(submission);
        await assignment.save();

        return res.status(200).json({
            success: true,
            message: "Assignment submitted successfully"
        });

    } catch (error) {
        console.error("Error submitting assignment:", error);
        return res.status(500).json({ success: false, message: "Failed to submit assignment" });
    }
};
