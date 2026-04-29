module.exports = [
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
];
