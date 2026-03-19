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
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
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

  // Test file configuration (Jest)
  {
    files: ["**/__tests__/**/*.js", "**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: {
        // Jest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
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
