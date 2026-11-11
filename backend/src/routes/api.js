const express = require("express");
const rankingsRouter = require("./rankings");
const teamsRouter = require("./teams");
const auditRouter = require("./audit");
const seasonsRouter = require("./seasons");

const router = express.Router();

router.use(rankingsRouter);
router.use(teamsRouter);
router.use(auditRouter);
router.use(seasonsRouter);

module.exports = router;
