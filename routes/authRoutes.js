const express = require("express");
const { loginValidation, validate } = require("../middleware/validation/authValidation");
const jwtAuth = require("../middleware/jwtAuth");

const { login, logout, changePassword } = require("../controllers/authController");

const router = express.Router();

router.post("/login", loginValidation, validate, login);
router.post("/logout", logout);
router.put("/change-password", jwtAuth, changePassword);

module.exports = router;
