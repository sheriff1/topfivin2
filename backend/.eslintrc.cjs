/**
 * ESLint Configuration for Backend (Node.js)
 * Enforces consistent code style and catches common errors
 */

const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
  // Don't lint these directories
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".pnpm-store/**", "coverage/**", ".env*"],
  },

  // ESLint base configuration
  js.configs.recommended,

  // Prettier compatibility - disables formatting rules that conflict with Prettier
  prettier,

  // Prettier plugin configuration
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },

  // Backend-specific rules (all JavaScript files EXCEPT tests)
  {
    files: ["**/*.js"],
    ignores: ["**/__tests__/**/*.js", "**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      // Best practices
      "no-console": "off", // Console is fine in Node.js
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      eqeqeq: ["error", "always"],

      // Code quality
      "consistent-return": "off", // Too many false positives with Express handlers
      "no-implicit-coercion": "error",
      "no-param-reassign": "warn",
      "no-shadow": ["error", { builtinGlobals: false, hoist: "functions" }],

      // Comments
      "spaced-comment": ["warn", "always", { markers: ["/"] }],
    },
  },

  // Test file specific rules - more lenient (specify AFTER general rules to override)
  {
    files: ["**/__tests__/**/*.js", "**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": "off",
      "consistent-return": "off",
    },
  },
];
