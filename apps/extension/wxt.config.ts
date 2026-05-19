import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "trakdown",
    description: "Capture web pages and DOM regions as markdown for AI consumption",
    permissions: ["activeTab", "clipboardWrite"],
    // Four user-configurable shortcuts — one per capture mode. Chrome lets
    // users rebind each at chrome://extensions/shortcuts if the suggested
    // default conflicts with another extension or OS shortcut.
    commands: {
      "capture-element": {
        suggested_key: {
          default: "Ctrl+Shift+K",
          mac: "Command+Shift+K",
        },
        description: "Pick a page element to capture as markdown",
      },
      "capture-selection": {
        suggested_key: {
          default: "Ctrl+Shift+J",
          mac: "Command+Shift+J",
        },
        description: "Capture the current text selection as markdown",
      },
      "capture-page": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y",
        },
        description: "Capture the full page as markdown",
      },
      "capture-page-ai": {
        suggested_key: {
          default: "Ctrl+Shift+U",
          mac: "Command+Shift+U",
        },
        description: "Capture the page with on-device AI cleanup (when available)",
      },
    },
  },
});
