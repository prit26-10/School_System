const express = require("express");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");
const {createSessionSlots,getMySessionSlots,confirmSessionSlot,getMyConfirmedSessions,getTeacherSessions,assignSlotByTeacher,deleteSessionByTeacher,cancelAssignedSlot } = require("../controllers/sessionSlotController");

const {createSessionValidation, validateSession} = require("../middleware/validation/sessionValidation");
const { createSessionSlotsValidation, confirmSessionSlotValidation, validateSessionSlot} = require("../middleware/validation/sessionSlotValidation");

const router = express.Router();

router.post("/slots", jwtAuth, roleAuth("teacher"), createSessionSlotsValidation, validateSessionSlot,createSessionSlots);
router.get("/teacher",jwtAuth,roleAuth("teacher"),getTeacherSessions);
router.post("/teacher/assign-slot",jwtAuth,roleAuth("teacher"),assignSlotByTeacher);
router.post("/teacher/cancel-assigned-slot",jwtAuth,roleAuth("teacher"),cancelAssignedSlot);
router.delete(
  "/teacher/:sessionId",
  jwtAuth,
  roleAuth("teacher"),
  deleteSessionByTeacher
);

router.get("/mysessions", jwtAuth, roleAuth("student"), getMySessionSlots);
router.post("/confirm", jwtAuth, roleAuth("student"), confirmSessionSlotValidation, validateSessionSlot,confirmSessionSlot);
router.get("/my-confirmed-sessions", jwtAuth, roleAuth("student"), getMyConfirmedSessions);
module.exports = router;