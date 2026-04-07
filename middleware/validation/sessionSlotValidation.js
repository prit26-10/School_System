const { body, validationResult } = require("express-validator");
const moment = require("moment");

// Helper function to sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove potential JavaScript
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

exports.createSessionSlotsValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Session title is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Session title must be between 3 and 100 characters")
    .custom(value => {
      const sanitized = sanitizeInput(value);
      if (sanitized !== value) {
        throw new Error("Session title contains invalid characters");
      }
      return true;
    }),
    
  body("date")
    .notEmpty()
    .withMessage("Date is required")
    .custom(value => {
      const sanitized = sanitizeInput(value);
      const parsed = moment(sanitized, "DD-MM-YYYY", true);
      if (!parsed.isValid()) {
        throw new Error("Date must be in DD-MM-YYYY format");
      }
      if (parsed.isBefore(moment().startOf("day"))) {
        throw new Error("Date must be today or future");
      }
      // Check if date is too far in future (more than 1 year)
      if (parsed.isAfter(moment().add(1, 'year'))) {
        throw new Error("Date cannot be more than 1 year in advance");
      }
      return true;
    }),

  body("sessionDuration")
    .notEmpty()
    .withMessage("Session duration is required")
    .isInt({ min: 15, max: 240 })
    .withMessage("Session duration must be between 15 and 240 minutes")
    .custom(value => {
      const duration = parseInt(value);
      // Ensure it's a valid duration that divides evenly into hours
      if (duration % 15 !== 0) {
        throw new Error("Session duration must be in 15-minute intervals");
      }
      return true;
    }),

  body("breakDuration")
    .notEmpty()
    .withMessage("Break duration is required")
    .isInt({ min: 0, max: 60 })
    .withMessage("Break duration must be between 0 and 60 minutes")
    .custom(value => {
      const duration = parseInt(value);
      // Ensure break duration is also in 5-minute intervals
      if (duration % 5 !== 0) {
        throw new Error("Break duration must be in 5-minute intervals");
      }
      return true;
    }),

  body("studentSelectionType")
    .optional()
    .isIn(["all", "particular"])
    .withMessage("Student selection type must be 'all' or 'particular'"),

  body("student_id")
    .optional()
    .isMongoId()
    .withMessage("Student ID must be a valid MongoDB ID")
    .custom(async value => {
      if (!value) return true; // Optional field
      // Additional validation can be added here if needed
      return true;
    })
];


exports.confirmSessionSlotValidation = [
  body("sessionId")
    .notEmpty()
    .withMessage("Session ID is required")
    .isMongoId()
    .withMessage("Session ID must be a valid MongoDB ID"),

  body("startTimeUTC")
    .notEmpty()
    .withMessage("startTimeUTC is required"),

  body("endTimeUTC")
    .notEmpty()
    .withMessage("endTimeUTC is required")
];



exports.validateSessionSlot = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(e => ({
      field: e.param || e.path,
      message: e.msg,
      value: e.value
    }));
    
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errorMessages
    });
  }
  next();
};
