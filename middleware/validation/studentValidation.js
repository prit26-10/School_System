const { body,param, validationResult } = require("express-validator");
const fs = require("fs");
const csv = require("csv-parser");

const studentCreate = [
  body('userId').trim().notEmpty().withMessage('userId is required'),
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('email must be valid'),
  body('password').isLength({ min: 6 }).withMessage('password min length is 6'),
  body('age').notEmpty().isInt({ min: 1 }).withMessage('age is required and must be positive integer'),
  body('class').optional().trim().notEmpty().withMessage('class cannot be empty'),
  body('timezone').trim().notEmpty().withMessage('timezone is required'),
  body('mobileNumber').trim().notEmpty().withMessage('mobileNumber is required'),
  body('city').trim().notEmpty().withMessage('city is required'),
  body('state').trim().notEmpty().withMessage('state is required'),
  body('country').trim().notEmpty().withMessage('country is required'),
];
 

const studentUpdate = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('email').optional().isEmail().withMessage('invalid email'),
  body('age').optional().isInt({ min: 1 }).withMessage('age must be an integer'),
  body('class').optional().notEmpty().withMessage('class cannot be empty'),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('country').optional().trim(),
  body('timezone').optional().trim()
];

const studentIdParam = [
  param('userId').trim().notEmpty().withMessage('userId param is required')
];

const markCreate = [
  body('subject').trim().notEmpty().withMessage('subject is required'),
  body('marks').isNumeric().withMessage('marks must be numeric')
];

const markUpdate = [
  body('subject').optional().trim().notEmpty().withMessage('subject cannot be empty'),
  body('marks').optional().isNumeric().withMessage('marks must be numeric')
];


const submitQuizValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid quiz id"),

  body("answers")
    .isArray({ min: 1 })
    .withMessage("answers must be a non-empty array"),

  body("answers.*")
    .isInt({ min: -1, max: 3 })
    .withMessage("Each answer must be -1 (unanswered) or 0-3")
];
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const csvStudentValidators = [
  body("userId").trim().notEmpty().withMessage("userId is required"),
  body("name").trim().notEmpty().withMessage("name is required").matches(/^[A-Za-z\s]+$/).withMessage("name must contain only letters and spaces"),
  body("email").isEmail().withMessage("email must be valid"),
  body("password").isLength({ min: 6 }).withMessage("password min length is 6"),
  body("age").notEmpty().isInt({ min: 1 }).withMessage("age is required and must be positive integer"),
  body("class").optional().trim(),
  body("timezone").trim().notEmpty().withMessage("timezone is required")
];


const csvUploadValidation = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required" });
  }

  const rows = [];
  const skippedDetails = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("error", (error) => {
      console.error("CSV parsing error:", error);
      return res.status(400).json({ message: "Error parsing CSV file: " + error.message });
    })
    .on("end", async () => {
      try {
        for (let i = 0; i < rows.length; i++) {
          const fakeReq = { body: rows[i] };

          for (const rule of csvStudentValidators) {
            await rule.run(fakeReq);
          }

          const errors = validationResult(fakeReq);

          if (!errors.isEmpty()) {
            skippedDetails.push({
              row: i + 2,
              userId: rows[i].userId || null,
              reasons: errors.array().map(e => e.msg)
            });
          }
        }
        req.csvRows = rows;
        req.csvSkippedDetails = skippedDetails;
        next();
      } catch (error) {
        console.error("CSV validation error:", error);
        return res.status(400).json({ message: "Error validating CSV: " + error.message });
      }
    });
};
module.exports = { studentCreate, studentUpdate, studentIdParam, markCreate, markUpdate, submitQuizValidation, validate, csvUploadValidation};
