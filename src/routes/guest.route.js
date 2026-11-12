const express = require("express");
const GuestController = require("../controllers/guest.controller");
const { requireGuest } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/session", GuestController.createSession);
router.get("/session", requireGuest, GuestController.validateSession);

module.exports = router;
