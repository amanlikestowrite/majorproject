const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authRateLimiter } = require("../middleware/rateLimit.middleware");
const { validateGoogleAuthRequest } = require("../middleware/validator.middleware");

const router = express.Router();
const config = require("../config/env");

router.get("/config", (req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      googleClientId: config.googleClientId || "",
    },
  });
});

router.post("/google", authRateLimiter, validateGoogleAuthRequest, AuthController.googleLogin);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.getCurrentUser);

module.exports = router;
