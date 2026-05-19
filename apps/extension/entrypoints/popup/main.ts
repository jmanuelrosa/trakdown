import { type AiAvailability, aiAvailability } from "@/lib/ai-extract";
import type { CaptureMode, CaptureRequest, CaptureResponse } from "@/lib/messaging";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const aiButton = document.querySelector<HTMLButtonElement>('button[data-mode="page-ai"]');
const selectionButton = document.querySelector<HTMLButtonElement>('button[data-mode="selection"]');

let busyButton: HTMLButtonElement | null = null;

document.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (busyButton || btn.disabled) return;
    const mode = btn.dataset.mode as CaptureMode | undefined;
    if (!mode) return;
    setBusy(btn);
    void runCapture(mode).finally(setIdle);
  });
});

void initAi();
void populateShortcuts();
void initSelectionAvailability();

async function initAi(): Promise<void> {
  if (!aiButton) return;
  const state = await aiAvailability();
  applyAiState(aiButton, state);
}

function applyAiState(btn: HTMLButtonElement, state: AiAvailability): void {
  btn.dataset.aiState = state;

  const hintEl = btn.querySelector<HTMLElement>(".hint");
  const hints: Record<AiAvailability, string> = {
    available: "Chrome on-device AI ready",
    downloadable: "first use downloads Gemini Nano (~2GB)",
    downloading: "downloading on-device model…",
    unavailable: "on-device AI not available on this machine",
    unsupported: "requires Chrome 138+ with Prompt API enabled",
  };
  const isDisabled: Record<AiAvailability, boolean> = {
    available: false,
    downloadable: false,
    downloading: true,
    unavailable: true,
    unsupported: true,
  };

  if (hintEl) hintEl.textContent = hints[state];
  btn.disabled = isDisabled[state];
  btn.title = hints[state];
}

// Populate the <kbd> on each button with the user's current chrome.commands
// binding. If a command is unbound (user removed it), hide the badge.
async function populateShortcuts(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.commands?.getAll) return;
  try {
    const commands = await chrome.commands.getAll();
    const byName = new Map(commands.map((c) => [c.name ?? "", c.shortcut ?? ""]));
    document.querySelectorAll<HTMLButtonElement>("button[data-command]").forEach((btn) => {
      const cmdName = btn.dataset.command;
      const kbd = btn.querySelector<HTMLElement>("kbd");
      if (!kbd || !cmdName) return;
      const shortcut = byName.get(cmdName);
      if (shortcut) {
        kbd.textContent = shortcut;
        kbd.hidden = false;
      } else {
        kbd.hidden = true;
      }
    });
  } catch {
    // Silent — popup just won't show shortcut badges.
  }
}

// Selection mode requires text to be selected on the page when the popup
// opens. If nothing is selected, disable the button and explain via title.
async function initSelectionAvailability(): Promise<void> {
  if (!selectionButton) return;
  const hasSelection = await checkPageSelection();
  if (!hasSelection) {
    selectionButton.disabled = true;
    selectionButton.title = "Select text on the page first, then reopen this popup.";
    selectionButton.dataset.reason = "no-selection";
  }
}

async function checkPageSelection(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, {
      type: "trakdown:check-selection",
    })) as { hasSelection?: boolean } | undefined;
    return Boolean(res?.hasSelection);
  } catch {
    // Content script not loaded (chrome:// page, extension just installed,
    // etc.) — assume enabled and let the capture flow surface any real error.
    return true;
  }
}

function setBusy(btn: HTMLButtonElement): void {
  busyButton = btn;
  document.body.classList.add("is-busy");
  btn.classList.add("is-active");
}

function setIdle(): void {
  if (busyButton) {
    busyButton.classList.remove("is-active");
    busyButton = null;
  }
  document.body.classList.remove("is-busy");
}

async function runCapture(mode: CaptureMode): Promise<void> {
  setStatus("Capturing…");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.");
    return;
  }

  const req: CaptureRequest = { type: "trakdown:capture", mode };

  let res: CaptureResponse | undefined;
  try {
    res = await chrome.tabs.sendMessage<CaptureRequest, CaptureResponse>(tab.id, req);
  } catch (err) {
    setStatus(
      `Can't reach this page. Reload the tab and try again. (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
    return;
  }

  if (res?.pending) {
    if (mode === "element") {
      setStatus("Pick an element on the page. Click to capture, ↑↓ to resize, Esc to cancel.");
    } else if (mode === "page-ai") {
      setStatus("AI cleaning page — toast will appear when done.");
    } else {
      setStatus("Working…");
    }
    return;
  }

  if (!res?.ok || !res.markdown) {
    // Selection mode without text is expected, not a failure — show a hint
    // instead of the alarming "Failed: …" prefix.
    if (mode === "selection" && (/no text selected/i.test(res?.error ?? "") || !res?.error)) {
      setStatus("Select text on the page first, then try again.");
      return;
    }
    setStatus(`Failed: ${res?.error ?? "no response"}`);
    return;
  }

  try {
    await navigator.clipboard.writeText(res.markdown);
    const sourceTag = res.source ? ` (${res.source})` : "";
    setStatus(`Copied ${res.markdown.length.toLocaleString()} chars${sourceTag}.`);
  } catch (err) {
    setStatus(
      `Captured but couldn't write clipboard: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}
