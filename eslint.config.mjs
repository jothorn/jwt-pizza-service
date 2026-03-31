import globals from "globals";
import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  // k6 load tests use ESM (import/export), not Node CommonJS
  {
    files: ["loadTests/**/*.js"],
    languageOptions: { sourceType: "module" },
  },
  { languageOptions: { globals: globals.node } },
  { languageOptions: { globals: globals.jest } },
  pluginJs.configs.recommended,
  eslintConfigPrettier,
];
