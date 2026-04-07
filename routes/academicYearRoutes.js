const express = require("express");
const router = express.Router();
const academicYearController = require("../controllers/Admin/academicYearController");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const multer = require("multer");
const path = require("path");

// Multer configuration for CSV upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname) !== ".csv") {
            return cb(new Error("Only CSV files are allowed"));
        }
        cb(null, true);
    }
});

// Protected routes
router.get("/sample-csv", jwtAuth, roleAuth("admin"), academicYearController.downloadSampleCSV);
router.get("/holidays", jwtAuth, roleAuth("admin", "teacher", "student"), academicYearController.getHolidays);

router.post("/upload-holidays", jwtAuth, roleAuth("admin"), upload.single("holiday_csv"), academicYearController.uploadHolidays);
router.delete("/clear-all", jwtAuth, roleAuth("admin"), academicYearController.clearAllAcademicData);



module.exports = router;
