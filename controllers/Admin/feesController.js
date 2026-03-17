const ClassFees = require("../../models/ClassFees");
const ClassSubject = require("../../models/ClassSubject");

// @desc    Save or update class fees
// @route   POST /api/fees/class-fees
// @access  Admin
exports.saveOrUpdateFees = async (req, res) => {
  try {
    const { classId, tuitionFee, examFee } = req.body;

    if (!classId) {
      return res.status(400).json({ success: false, message: "classId is required" });
    }

    if (isNaN(tuitionFee) || isNaN(examFee)) {
      return res.status(400).json({ success: false, message: "tuitionFee and examFee must be numbers" });
    }

    const annualFee = Number(tuitionFee);
    const examinationFee = Number(examFee);
    const totalFee = annualFee + examinationFee;

    // Check if class exists
    const classExists = await ClassSubject.findById(classId);
    if (!classExists) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    // Upsert the fee record
    const feeRecord = await ClassFees.findOneAndUpdate(
      { classId },
      {
        tuitionFee: annualFee,
        examFee: examinationFee,
        totalFee,
      },
      { new: true, upsert: true, runValidators: true }
    ).populate("classId", "name class");

    res.status(200).json({
      success: true,
      message: "Fees saved successfully",
      data: feeRecord,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Fetch fees for a specific class
// @route   GET /api/fees/class-fees/:classId
// @access  Admin
exports.getFeesByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const fees = await ClassFees.findOne({ classId }).populate("classId", "name class");

    if (!fees) {
      return res.status(404).json({ success: false, message: "Fees not defined for this class" });
    }

    res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Return a list of all classes with their fees
// @route   GET /api/fees/class-fees
// @access  Admin
exports.getAllClassFees = async (req, res) => {
  try {
    // Only fetch records with valid classId references
    let fees = await ClassFees.find({ classId: { $ne: null } })
      .populate("classId", "name class")
      .sort({ "classId.class": 1 }); // Sort by class in ascending order

    // Manual fallback: If populate didn't work (e.g., invalid ObjectId format),
    // manually fetch class data for each fee record
    const ClassSubject = require("../../models/ClassSubject");
    
    fees = await Promise.all(
      fees.map(async (fee) => {
        // If classId is not populated (still an object with just the ID or string)
        if (!fee.classId || !fee.classId.name) {
          try {
            const classData = await ClassSubject.findById(fee.classId).select("name class");
            if (classData) {
              fee.classId = classData;
            }
          } catch (e) {
            // Invalid classId format, skip this record
            console.warn(`Invalid classId for fee record: ${fee._id}`);
          }
        }
        return fee;
      })
    );

    // Filter out any records where classId couldn't be resolved
    fees = fees.filter(fee => fee.classId && fee.classId.name);

    res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
