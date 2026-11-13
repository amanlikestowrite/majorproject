const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authRateLimiter } = require("../middleware/rateLimit.middleware");
const { validateGoogleAuthRequest } = require("../middleware/validator.middleware");

const router = express.Router();

router.post("/register", authRateLimiter, AuthController.register);
router.post("/login", authRateLimiter, AuthController.login);
router.post("/google", authRateLimiter, validateGoogleAuthRequest, AuthController.googleLogin);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.getCurrentUser);

module.exports = router;
