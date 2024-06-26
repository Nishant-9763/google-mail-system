const express = require("express");
const router = express.Router();
const gmailRoutes = require("./gmail");

router.use("/gmail", gmailRoutes);

module.exports = router;
