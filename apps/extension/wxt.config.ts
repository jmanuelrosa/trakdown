import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "trakdown",
    description: "Capture web pages and DOM regions as markdown for AI consumption",
    permissions: ["activeTab", "clipboardWrite"],
    commands: {
      "pick-element": {
        suggested_key: {
          default: "Ctrl+Shift+K",
          mac: "Command+Shift+K",
        },
        description: "Pick a page element to capture as markdown",
      },
    },
  },
});
