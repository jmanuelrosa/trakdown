import { type AiAvailability, aiAvailability } from "@/lib/ai-extract";
import { type Destination, getDestination, setDestination } from "@/lib/destination";
import { getLastCapture, type LastCapture } from "@/lib/last-capture";
import type { CaptureMode, CaptureRequest, CaptureResponse } from "@/lib/messaging";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const aiButton = document.querySelector<HTMLButtonElement>('button[data-mode="page-ai"]');
const selectionButton = document.querySelector<HTMLButtonElement>('button[data-mode="selection"]');
const destToggle = document.querySelector<HTMLElement>(".dest");

// The popup is a pure dispatcher: read the user's destination preference, send
// the capture request, close. All clipboard writes / downloads / toasts happen
// in the content script — keeps popup and keyboard-shortcut paths identical.
let destination: Destination = "clipboard";
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

// Pressing Esc inside the popup forwards to the content script so any picker
// running on the active tab is dismissed. Without this, Esc only reaches the
// page when the popup has lost focus — the user's most common 'just cancel
// it' instinct otherwise leaves the overlay stuck on screen.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  void cancelPickerOnActiveTab().then((cancelled) => {
    if (cancelled) setStatus("Picker cancelled.");
  });
});

async function cancelPickerOnActiveTab(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, {
      type: "trakdown:cancel-picker",
    })) as { cancelled?: boolean } | undefined;
    return Boolean(res?.cancelled);
  } catch {
    return false;
  }
}

void initDestination();
void initAi();
void populateShortcuts();
void initSelectionAvailability();
void initLastCapture();

async function initDestination(): Promise<void> {
  destination = await getDestination();
  applyDestinationUi(destination);
  if (!destToggle) return;
  destToggle.querySelectorAll<HTMLButtonElement>("[data-dest]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.dest as Destination | undefined;
      if (!next || next === destination) return;
      destination = next;
      applyDestinationUi(destination);
      void setDestination(destination);
    });
  });
}

function applyDestinationUi(value: Destination): void {
  if (!destToggle) return;
  destToggle.querySelectorAll<HTMLButtonElement>("[data-dest]").forEach((btn) => {
    const isActive = btn.dataset.dest === value;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.");
    return;
  }

  const req: CaptureRequest = { type: "trakdown:capture", mode, destination };

  let res: CaptureResponse | undefined;
  try {
    res = await chrome.tabs.sendMessage<CaptureRequest, CaptureResponse>(tab.id, req);
  } catch (err) {
    // Page unreachable (chrome:// URL, extension just installed, etc.) — the
    // content script isn't there to render a toast, so keep the popup open
    // with the inline status as the only place the user can read the error.
    setStatus(
      `Can't reach this page. Reload the tab and try again. (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
    return;
  }

  if (res?.ok) {
    // Either pending (picker/AI) or synchronously delivered (page/selection).
    // Either way the content script has the toast covered — popup just closes.
    window.close();
    return;
  }

  // Errors that originated in the content script (e.g. selection with no text)
  // were already toasted on the page; the popup is redundant, just close.
  window.close();
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

// Hydrate the "last capture" preview from chrome.storage.local. Stays hidden
// when there is nothing stored yet (first run or storage cleared).
async function initLastCapture(): Promise<void> {
  const section = document.getElementById("last-capture") as HTMLElement | null;
  if (!section) return;
  const last: LastCapture | null = await getLastCapture();
  if (!last) return;

  const modeEl = section.querySelector<HTMLElement>('[data-field="mode"]');
  const timeEl = section.querySelector<HTMLElement>('[data-field="time"]');
  const sizeEl = section.querySelector<HTMLElement>('[data-field="size"]');
  const titleEl = section.querySelector<HTMLElement>('[data-field="title"]');
  const excerptEl = section.querySelector<HTMLElement>('[data-field="excerpt"]');

  if (modeEl) modeEl.textContent = modeLabel(last.mode);
  if (timeEl) {
    timeEl.textContent = formatRelativeTime(last.capturedAt);
    timeEl.title = new Date(last.capturedAt).toLocaleString();
  }
  if (sizeEl) sizeEl.textContent = `${formatCharCount(last.charCount)} chars`;
  if (titleEl) {
    titleEl.textContent = last.title;
    titleEl.title = `${last.title}\n${last.url}`;
  }
  if (excerptEl) {
    if (last.excerpt) {
      excerptEl.textContent = last.excerpt;
    } else {
      excerptEl.hidden = true;
    }
  }

  section.hidden = false;
}

// Reuse the labels rendered on the capture buttons so the preview never
// diverges from the actions if we ever rename a mode.
function modeLabel(mode: CaptureMode): string {
  const btn = document.querySelector<HTMLButtonElement>(`button[data-mode="${mode}"]`);
  const label = btn?.querySelector<HTMLElement>(".btn-label, .label");
  return label?.textContent?.trim() || mode;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function formatCharCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}
