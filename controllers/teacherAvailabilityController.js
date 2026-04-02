const TeacherAvailability = require("../models/TeacherAvailability");
const { parseTimeToMinutes , parseDDMMYYYY } = require("../utils/dateParser");

exports.setWeeklyAvailability = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { weeklyAvailability } = req.body;

    // ✅ Directly store only days with times - no processing needed
    const availability = await TeacherAvailability.findOneAndUpdate(
      { teacherId },
      { $set: { weeklyAvailability } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Weekly availability updated successfully",
      data: availability
    });
  } catch (err) {
    console.error('Error setting weekly availability:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { startDate, endDate, reason, note } = req.body;

    // Convert ISO date strings to Date objects
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    // Validate dates
    if (!parsedStartDate || !parsedEndDate || isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format"
      });
    }

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    // Check for overlapping holidays
    const teacherAvailability = await TeacherAvailability.findOne({ teacherId });
    
    if (teacherAvailability && teacherAvailability.holidays) {
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);
        
        const hasOverlap = teacherAvailability.holidays.some(existingHoliday => {
            const existingStart = new Date(existingHoliday.startDate);
            const existingEnd = new Date(existingHoliday.endDate);
            
            // Check for actual overlap: holidays overlap if they share any time
            return newStart < existingEnd && newEnd > existingStart;
        });

        if (hasOverlap) {
            return res.status(400).json({
                success: false,
                errors: ["Holiday dates overlap with an existing holiday"]
            });
        }
    }

    const availability = await TeacherAvailability.findOneAndUpdate(
      { teacherId },
      {
        $push: {
          holidays: {
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            reason,
            note: note || ""
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Holiday added successfully",
      data: availability.holidays
    });
  } catch (err) {
    console.error('Error adding holiday:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

exports.getTeacherAvailability = async (req, res) => {
    try {
        const teacherId = req.user.id;
        
        // Find teacher's availability
        const availability = await TeacherAvailability.findOne({ teacherId })
            .select("-_id -__v");

        if (!availability) {
            // Return empty availability for first-time users
            return res.json({
                success: true,
                weeklyAvailability: []
            });
        }

        // ✅ Return only days with times (as stored)
        res.json({
            success: true,
            weeklyAvailability: availability.weeklyAvailability || []
        });
    } catch (err) {
        console.error('Error getting teacher availability:', err);
        res.status(500).json({ 
            success: false,
            message: "Server error" 
        });
    }
};

exports.getTeacherAvailabilityForStudent = async (req, res) => {
    try {
        let availability;
        
        if (req.user.role === 'teacher') {
            // Teacher requesting their own availability
            availability = await TeacherAvailability.findOne({ teacherId: req.user.id })
              .select("-_id -__v");
        } else {
            // Student requesting teacher's availability
            const { teacherId } = req.params;
            availability = await TeacherAvailability.findOne({ teacherId })
              .select("-_id -__v");
        }

        if (!availability) {
            return res.status(404).json({ 
                success: false,
                message: "Teacher availability not set yet" 
            });
        }

        res.json({
            success: true,
            data: availability
        });
    } catch (err) {
        console.error('Error getting teacher availability:', err);
        res.status(500).json({ 
            success: false,
            message: "Server error" 
        });
    }
};

exports.deleteHoliday = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const holidayId = req.params.id;

        if (!holidayId) {
            return res.status(400).json({
                success: false,
                message: "Holiday ID is required"
            });
        }

        // Find the teacher's availability
        const teacherAvailability = await TeacherAvailability.findOne({ teacherId });
        
        if (!teacherAvailability || !teacherAvailability.holidays) {
            return res.status(404).json({
                success: false,
                message: "Holiday not found"
            });
        }

        // Find the specific holiday to delete
        const holidayIndex = teacherAvailability.holidays.findIndex(holiday => 
            holiday._id && holiday._id.toString() === holidayId.toString()
        );

        if (holidayIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Holiday not found"
            });
        }

        // Remove the holiday from the array
        teacherAvailability.holidays.splice(holidayIndex, 1);

        // Update the database
        await TeacherAvailability.findOneAndUpdate(
            { teacherId },
            { $set: { holidays: teacherAvailability.holidays } }
        );

        res.json({
            success: true,
            message: "Holiday deleted successfully"
        });
    } catch (err) {
        console.error('Error deleting holiday:', err);
        res.status(500).json({ 
            success: false,
            message: "Server error" 
        });
    }
};

exports.getTeacherHolidays = async (req, res) => {
    try {
        const teacherId = req.user.id;
        
        const availability = await TeacherAvailability.findOne({ teacherId })
            .select("-_id -__v");
            
        if (!availability || !availability.holidays || availability.holidays.length === 0) {
            return res.json({
                success: true,
                holidays: []
            });
        }
        
        res.json({
            success: true,
            holidays: availability.holidays || []
        });
    } catch (err) {
        console.error('Error getting teacher holidays:', err);
        res.status(500).json({ 
            success: false,
            message: "Server error" 
        });
    }
};
