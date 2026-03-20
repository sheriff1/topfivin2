const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
  // Global ignores
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".pnpm-store/**", "coverage/**"],
  },

  // ESLint base configuration
  js.configs.recommended,

  // React plugin configuration
  {
    files: ["**/*.jsx", "**/*.js"],
    ...react.configs.flat.recommended,
    settings: {
      react: {
        version: "19",
      },
    },
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
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        console: "readonly",
      },
    },
  },

  // Import plugin configuration (with disabled module resolution)
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Disable module resolution since Vite handles it
      "import/no-unresolved": "off",
      "import/no-extraneous-dependencies": "warn",

      // Import ordering
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
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

      // Accessibility - too strict for MVP, disable for now
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/anchor-is-valid": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
    },
  },

  // Import plugin must-disable (after other rules to override)
  {
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      // Override the error with off since Vite handles module resolution
      "import/no-unresolved": "off",
    },
  },

  // Test file configuration
  {
    files: ["**/src/**/*.test.jsx", "**/src/**/*.test.js", "**/src/__tests__/**/*.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
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

  // Playwright config + E2E test files (Node.js + browser globals)
  {
    files: ["**/playwright.config.js", "**/e2e/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
