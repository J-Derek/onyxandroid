import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  // Base config for all TypeScript files
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // ========================================
  // PARTY MODE SAFETY GUARDRAILS
  // ========================================
  // These rules BLOCK imports that would break Party Mode anonymity.
  // DO NOT DISABLE THESE RULES without security review.
  {
    files: [
      "src/pages/PartyMode.tsx",
      "src/components/party/**/*.{ts,tsx}",
      "src/contexts/PartyPlaybackContext.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/contexts/AuthContext",
              message: "⛔ PARTY MODE VIOLATION: Auth imports break anonymity guarantee. Party Mode must remain isolated.",
            },
            {
              name: "@/contexts/ProfileContext",
              message: "⛔ PARTY MODE VIOLATION: Profile imports break anonymity guarantee. Party Mode must remain isolated.",
            },
            {
              name: "@/contexts/FavoritesContext",
              message: "⛔ PARTY MODE VIOLATION: Favorites imports break anonymity guarantee. Party Mode must remain isolated.",
            },
            {
              name: "@/contexts/HistoryContext",
              message: "⛔ PARTY MODE VIOLATION: History imports break anonymity guarantee. Party Mode must remain isolated.",
            },
            {
              name: "@/lib/history",
              message: "⛔ PARTY MODE VIOLATION: History imports break anonymity guarantee. Party Mode must remain isolated.",
            },
          ],
          patterns: [
            {
              group: ["**/AuthContext*", "**/ProfileContext*", "**/FavoritesContext*", "**/HistoryContext*"],
              message: "⛔ PARTY MODE VIOLATION: This import breaks anonymity. Party Mode must remain isolated from user data.",
            },
          ],
        },
      ],
    },
  },
);
