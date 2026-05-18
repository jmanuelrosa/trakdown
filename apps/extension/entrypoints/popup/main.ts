import { aiAvailability, type AiAvailability } from "@/lib/ai-extract";
import type {
  CaptureMode,
  CaptureRequest,
  CaptureResponse,
} from "@/lib/messaging";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const aiButton = document.querySelector<HTMLButtonElement>(
  'button[data-mode="page-ai"]',
);

document.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const mode = btn.dataset.mode as CaptureMode | undefined;
    if (!mode) return;
    void runCapture(mode);
  });
});

void initAi();

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
    if (mode === "selection" && !res?.error) {
      setStatus("No text selected on the page.");
      return;
    }
    setStatus(`Failed: ${res?.error ?? "no response"}`);
    return;
  }

  try {
    await navigator.clipboard.writeText(res.markdown);
    const sourceTag = res.source ? ` (${res.source})` : "";
    setStatus(
      `Copied ${res.markdown.length.toLocaleString()} chars${sourceTag}.`,
    );
  } catch (err) {
    setStatus(
      `Captured but couldn't write clipboard: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}
