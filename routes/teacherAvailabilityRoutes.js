const express = require("express");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

const {setWeeklyAvailability,addHoliday,getTeacherAvailability,getTeacherAvailabilityForStudent,getTeacherHolidays,deleteHoliday} = require("../controllers/teacherAvailabilityController");
const {validateWeeklyAvailability,validateHoliday} = require("../middleware/validation/teacherAvailabilityValidation");
const router = express.Router();

router.get("/", jwtAuth, roleAuth("teacher"), getTeacherAvailabilityForStudent);
router.get("/my-availability", jwtAuth, roleAuth("teacher"), getTeacherAvailability);
router.post("/availability",jwtAuth,roleAuth("teacher"),validateWeeklyAvailability,setWeeklyAvailability);
router.post("/holidays",jwtAuth,roleAuth("teacher"),validateHoliday,addHoliday);
router.get("/holidays", jwtAuth, roleAuth("teacher"), getTeacherHolidays);
router.delete("/holidays/:id", jwtAuth, roleAuth("teacher"), deleteHoliday);
router.get("/:teacherId",jwtAuth,roleAuth("student"),getTeacherAvailabilityForStudent);

module.exports = router;