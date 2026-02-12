module.exports = {
  root: true,
  ignorePatterns: ["out/", "node_modules/", "library/", "**/*.d.ts"],
  env: {
    es2022: true,
    browser: true,
    node: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  settings: {
    react: { version: "detect" }
  },
  rules: {
    "no-unused-vars": "off",
    "prefer-const": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",
    "react/jsx-no-comment-textnodes": "off",
    "react-hooks/exhaustive-deps": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-var-requires": "off"
  }
};
