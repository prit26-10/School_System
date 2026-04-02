const { body, validationResult } = require("express-validator");
const { parseDDMMYYYYWithTime, ensureFutureDateTime } = require("../../utils/dateParser");

exports.createSessionValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Session title is required"),

  body("startTime")
    .notEmpty()
    .withMessage("startTime is required")
    .custom((value, { req }) => {
      const start = parseDDMMYYYYWithTime(value);
      ensureFutureDateTime(start, "startTime");
      req.parsedStartTime = start;
      return true;
    }),

  body("endTime")
    .notEmpty()
    .withMessage("endTime is required")
    .custom((value, { req }) => {
      const end = parseDDMMYYYYWithTime(value);
      req.parsedEndTime = end;
      return true;
    }),

  body().custom((_, { req }) => {
    if (req.parsedEndTime <= req.parsedStartTime) {
      throw new Error("endTime must be after startTime");
    }
    return true;
  }),

  body("studentId")
    .optional()
    .isMongoId()
    .withMessage("studentId must be a valid Mongo ID")
];

exports.validateSession = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map(e => e.msg)
    });
  }
  next();
};
