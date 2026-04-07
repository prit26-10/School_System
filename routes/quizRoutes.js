const express = require("express");
const jwtAuth = require("../middleware/jwtAuth");
const roleAuth = require("../middleware/roleAuth");

const {
  createQuiz,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  updateQuizQuestion,
  deleteQuiz,
  getAvailableQuizzes
} = require("../controllers/quizController");

const {
  createQuizValidation,
  updateQuizValidation,
  quizIdParam,
  quizQuestionParam,
  validate
} = require("../middleware/validation/quizValidation");

const router = express.Router();


router.get("/available", jwtAuth, roleAuth("student"), getAvailableQuizzes);


router.post("/", jwtAuth, roleAuth("teacher"), createQuizValidation, validate, createQuiz);
router.get("/", jwtAuth, roleAuth("teacher"), getMyQuizzes);
router.put("/:id", jwtAuth, roleAuth("teacher"), quizIdParam, updateQuizValidation, validate, updateQuiz);
router.put("/:quizId/questions/:questionId", jwtAuth, roleAuth("teacher"), quizQuestionParam, validate, updateQuizQuestion);


router.get("/:id", jwtAuth, roleAuth("teacher"), quizIdParam, validate, getQuizById);
router.delete("/:id", jwtAuth, roleAuth("teacher"), quizIdParam, validate, deleteQuiz);

module.exports = router;
