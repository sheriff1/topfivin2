const express = require("express");
const rankingsRouter = require("./rankings");
const teamsRouter = require("./teams");
const auditRouter = require("./audit");
const seasonsRouter = require("./seasons");
const dataStatusRouter = require("./dataStatus");

const router = express.Router();

router.use(rankingsRouter);
router.use(teamsRouter);
router.use(auditRouter);
router.use(seasonsRouter);
router.use(dataStatusRouter);

module.exports = router;
