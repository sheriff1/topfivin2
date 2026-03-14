const express = require("express");
const rankingsRouter = require("./rankings");
const teamsRouter = require("./teams");
const auditRouter = require("./audit");

const router = express.Router();

router.use(rankingsRouter);
router.use(teamsRouter);
router.use(auditRouter);

module.exports = router;
