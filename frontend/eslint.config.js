const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
  // ESLint base configuration
  js.configs.recommended,

  // React plugin configuration
  {
    files: ["**/*.jsx", "**/*.js"],
    ...react.configs.flat.recommended,
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: "readonly",
        JSX: "readonly",
      },
    },
  },

  // Import plugin configuration
  {
    files: ["**/*.js", "**/*.jsx"],
    ...importPlugin.flatConfigs.recommended,
    rules: {
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          alphabeticalOrder: true,
          caseInsensitive: true,
        },
      ],
    },
  },

  // JSX A11y plugin configuration
  {
    files: ["**/*.jsx"],
    ...jsxA11y.flatConfigs.recommended,
  },

  // Prettier compatibility
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

  // Frontend-specific rules
  {
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      // React
      "react/prop-types": "warn",
      "react/react-in-jsx-scope": "off", // React 17+ doesn't need this
      "react/jsx-uses-react": "off",
      "react/no-unescaped-entities": "warn",

      // General
      "no-console": "warn", // Allow console, but warn in frontend
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      eqeqeq: ["error", "always"],

      // Code quality
      "consistent-return": "warn",
      "no-implicit-coercion": "error",
      "no-param-reassign": "warn",

      // Comments
      "spaced-comment": ["warn", "always", { markers: ["/"] }],

      // Imports
      "import/no-unresolved": "error",
      "import/no-cycle": "warn",
    },
  },

  // Don't lint these directories
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".pnpm-store/**",
      "coverage/**",
      ".env*",
      "vite.config.js",
    ],
  },
];
