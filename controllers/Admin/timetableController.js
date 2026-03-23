const ClassSubject = require("../../models/ClassSubject");
const moment = require("moment-timezone");

exports.generateTimetable = async (req, res) => {
    try {
        const { classId, startTime, endTime, duration } = req.body;

        if (!classId || !startTime || !endTime || !duration) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: classId, startTime, endTime, duration"
            });
        }

        const classDoc = await ClassSubject.findOne({ class: parseInt(classId) });
        if (!classDoc) {
            return res.status(404).json({ success: false, message: "Class not found" });
        }

        // Check if timetable already exists
        if (classDoc.timetable && classDoc.timetable.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Timetable already exists for this class."
            });
        }

        const subjects = classDoc.subjects;
        if (!subjects || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No subjects found for this class. Please add subjects first."
            });
        }

        // Validation 1: All subjects must have a teacher assigned (Subject Teacher or Class Teacher fallback)
        const classTeacher = classDoc.assignedTeacher && classDoc.assignedTeacher.teacherId ? classDoc.assignedTeacher : null;

        const missingTeachers = subjects.filter(s => 
            (!s.assignedTeacher || !s.assignedTeacher.teacherId) && !classTeacher
        );

        if (missingTeachers.length > 0) {
            let msg = "";
            if (missingTeachers.length === subjects.length) {
                msg = "Teacher assignment pending for all subjects. Please assign teachers before generating the timetable.";
            } else if (missingTeachers.length === 1) {
                msg = `Teacher assignment pending for ${missingTeachers[0].name}. Please assign a teacher before generating the timetable.`;
            } else {
                msg = "Teacher assignment pending for multiple subjects. Please assign teachers before generating the timetable.";
            }
            return res.status(400).json({ success: false, message: msg });
        }

        // Parse times using moment
        const start = moment(startTime, "HH:mm");
        const end = moment(endTime, "HH:mm");
        const periodDuration = parseInt(duration);

        if (!start.isValid() || !end.isValid()) {
            return res.status(400).json({ success: false, message: "Invalid time format. Use HH:mm (e.g., 08:00)" });
        }

        if (start.isSameOrAfter(end)) {
            return res.status(400).json({ success: false, message: "Start time must be before end time" });
        }

        // Calculate slots per day
        let slotsPerDay = [];
        let current = start.clone();

        while (current.clone().add(periodDuration, 'minutes').isSameOrBefore(end)) {
            slotsPerDay.push({
                start: current.format("HH:mm"),
                end: current.clone().add(periodDuration, 'minutes').format("HH:mm")
            });
            current.add(periodDuration, 'minutes');
        }

        if (slotsPerDay.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Duration is too long for the given time range"
            });
        }

        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        // Conflict Detection: Build a map of busy teachers across other classes
        const otherClasses = await ClassSubject.find({ class: { $ne: parseInt(classId) } });
        const busyMap = {}; // day -> slotStart -> Set(teacherIds)

        otherClasses.forEach(c => {
            if (c.timetable && c.timetable.length > 0) {
                c.timetable.forEach(entry => {
                    if (!busyMap[entry.day]) busyMap[entry.day] = {};
                    if (!busyMap[entry.day][entry.startTime]) busyMap[entry.day][entry.startTime] = new Set();
                    if (entry.teacherId) busyMap[entry.day][entry.startTime].add(entry.teacherId);
                });
            }
        });

        let timetable = [];

        // Distribution logic: Track subject usage to keep it balanced
        const subjectStats = subjects.map(s => ({
            ...s.toObject(),
            count: 0
        }));

        days.forEach(day => {
            slotsPerDay.forEach(slot => {
                // Find a subject whose teacher is not busy in this slot
                // Sort by least used subjects first to stay balanced
                subjectStats.sort((a, b) => a.count - b.count);

                let assigned = false;
                for (let i = 0; i < subjectStats.length; i++) {
                    const s = subjectStats[i];
                    const tId = (s.assignedTeacher && s.assignedTeacher.teacherId) ? s.assignedTeacher.teacherId : classTeacher.teacherId;
                    const tName = (s.assignedTeacher && s.assignedTeacher.teacherId) ? s.assignedTeacher.teacherName : classTeacher.teacherName;

                    const isBusy = busyMap[day] && busyMap[day][slot.start] && busyMap[day][slot.start].has(tId);

                    if (!isBusy) {
                        timetable.push({
                            day,
                            startTime: slot.start,
                            endTime: slot.end,
                            subjectName: s.name,
                            subjectCode: s.code,
                            teacherName: tName,
                            teacherId: tId
                        });
                        s.count++;
                        assigned = true;
                        break;
                    }
                }

                // Absolute fallback (rarely reachable if teacher pool is sufficient)
                if (!assigned) {
                    const s = subjectStats[0];
                    const tId = (s.assignedTeacher && s.assignedTeacher.teacherId) ? s.assignedTeacher.teacherId : classTeacher.teacherId;
                    const tName = (s.assignedTeacher && s.assignedTeacher.teacherId) ? s.assignedTeacher.teacherName : classTeacher.teacherName;

                    timetable.push({
                        day,
                        startTime: slot.start,
                        endTime: slot.end,
                        subjectName: s.name,
                        subjectCode: s.code,
                        teacherName: tName,
                        teacherId: tId
                    });
                    s.count++;
                }
            });
        });

        // Save generated timetable to the class document
        classDoc.timetable = timetable;
        await classDoc.save();

        res.status(200).json({
            success: true,
            message: `Successfully generated timetable with ${slotsPerDay.length} periods per day.`,
            data: timetable
        });

    } catch (error) {
        console.error("Error generating timetable:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTimetable = async (req, res) => {
    try {
        const { classId } = req.params;
        const classDoc = await ClassSubject.findOne({ class: parseInt(classId) });

        if (!classDoc) {
            return res.status(404).json({ success: false, message: "Class not found" });
        }

        res.status(200).json({
            success: true,
            data: classDoc.timetable || []
        });
    } catch (error) {
        console.error("Error fetching timetable:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
