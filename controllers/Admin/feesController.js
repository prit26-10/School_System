const ClassFees = require("../../models/ClassFees");
const ClassSubject = require("../../models/ClassSubject");
const mongoose = require("mongoose");

// @desc    Save or update class fees
// @route   POST /api/fees/class-fees
// @access  Admin
exports.saveOrUpdateFees = async (req, res) => {
  try {
    const { classId, totalFee, description } = req.body;

    if (!classId) {
      return res.status(400).json({ success: false, message: "classId is required" });
    }

    const finalTotalFee = Number(totalFee) || 0;

    // Check if class exists
    let classExists = null;
    if (mongoose.Types.ObjectId.isValid(classId)) {
      classExists = await ClassSubject.findById(classId);
    } else {
      classExists = await ClassSubject.findOne({ class: Number(classId) });
    }

    if (!classExists) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }
    
    const actualClassId = classExists._id;

    // Upsert the fee record
    const feeRecord = await ClassFees.findOneAndUpdate(
      { classId: actualClassId },
      {
        totalFee: finalTotalFee,
        description: description || ""
      },
      { new: true, upsert: true, runValidators: true }
    ).populate("classId", "class");

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
    let fees = null;
    if (mongoose.Types.ObjectId.isValid(classId)) {
      fees = await ClassFees.findOne({ classId }).populate("classId", "class");
    } else {
      const classObj = await ClassSubject.findOne({ class: Number(classId) });
      if (classObj) {
        fees = await ClassFees.findOne({ classId: classObj._id }).populate("classId", "class");
      }
    }

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
      .populate("classId", "class")
      .sort({ "classId.class": 1 }); // Sort by class in ascending order

    // Manual fallback: If populate didn't work (e.g., invalid ObjectId format),
    // manually fetch class data for each fee record
    const ClassSubject = require("../../models/ClassSubject");
    
    fees = await Promise.all(
      fees.map(async (fee) => {
        // If classId is not populated (still an object with just the ID or string)
        if (!fee.classId || !fee.classId.class) {
          try {
            const classData = await ClassSubject.findById(fee.classId).select("class");
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
    fees = fees.filter(fee => fee.classId && fee.classId.class !== undefined);

    res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete fee configuration
// @route   DELETE /api/fees/class-fees/:classId
// @access  Admin
exports.deleteFees = async (req, res) => {
  try {
    const { classId } = req.params;
    let actualClassId = classId;
    
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        const classObj = await ClassSubject.findOne({ class: Number(classId) });
        if (classObj) actualClassId = classObj._id;
    }
    
    const result = await ClassFees.findOneAndDelete({ classId: actualClassId });
    if (!result) {
      return res.status(404).json({ success: false, message: "Fees configuration not found" });
    }
    res.status(200).json({ success: true, message: "Fees configuration deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get fees by class number public
// @route   GET /api/fees/public/:classNumber
// @access  Public
exports.getPublicFeesByClassNumber = async (req, res) => {
  try {
    const classNumber = Number(req.params.classNumber);
    if (isNaN(classNumber)) {
      return res.status(400).json({ success: false, message: "Invalid class number" });
    }
    const classObj = await ClassSubject.findOne({ class: classNumber });
    if (!classObj) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }
    const fees = await ClassFees.findOne({ classId: classObj._id });
    if (!fees) {
      return res.status(404).json({ success: false, message: "Fees not configured for this class" });
    }
    res.status(200).json({ success: true, data: fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all fees public
// @route   GET /api/fees/public
// @access  Public
exports.getPublicAllFees = async (req, res) => {
  try {
    const fees = await ClassFees.find({ classId: { $ne: null } })
      .populate("classId", "class")
      .sort({ "classId.class": 1 });
    
    res.status(200).json({ success: true, data: fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
