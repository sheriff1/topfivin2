/**
 * ESLint Configuration for Backend (Node.js)
 * Enforces consistent code style and catches common errors
 */

const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
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

  // Backend-specific rules
  {
    files: ["**/*.js"],
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
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      eqeqeq: ["error", "always"],

      // Code quality
      "consistent-return": "warn",
      "no-implicit-coercion": "error",
      "no-param-reassign": "warn",
      "no-shadow": ["error", { builtinGlobals: false, hoist: "functions" }],

      // Comments
      "spaced-comment": ["warn", "always", { markers: ["/"] }],
    },
  },

  // Don't lint these directories
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".pnpm-store/**",
      "__tests__/**/*.test.js",
      "coverage/**",
      ".env*",
    ],
  },
];
