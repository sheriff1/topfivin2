const { validationResult } = require("express-validator");

/**
 * Middleware to check for validation errors and return a formatted response
 * Usage: app.post('/path', [validations], validationMiddleware, handler)
 */
const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        details: errors.array().map((err) => ({
          field: err.path || err.param,
          value: err.value,
          message: err.msg,
        })),
      },
    });
  }
  next();
};

module.exports = {
  validationMiddleware,
};
