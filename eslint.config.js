module.exports = [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        console: "readonly",
        globalThis: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
];
