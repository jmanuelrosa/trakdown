const OVERLAY_ID = "trakdown-picker-overlay";
const BANNER_ID = "trakdown-picker-banner";
const STYLE_ID = "trakdown-picker-style";
const TOAST_ID = "trakdown-toast";
const Z_INDEX = 2147483647;

export interface PickerResult {
  element: HTMLElement;
  selector: string;
}

let active = false;
// Stashed so cancelPicker() can settle the in-flight promise and tear down the
// listeners from outside the picker's own event scope (e.g. when the popup
// presses Esc, or when a different capture mode supersedes the picker).
let cancelHandle: { resolve: (v: PickerResult | null) => void; stop: () => void } | null = null;

export function isPickerActive(): boolean {
  return active;
}

export function cancelPicker(): boolean {
  if (!cancelHandle) return false;
  const { resolve, stop } = cancelHandle;
  stop();
  resolve(null);
  return true;
}

export function activatePicker(): Promise<PickerResult | null> {
  if (active) return Promise.resolve(null);
  active = true;

  return new Promise((resolve) => {
    injectStyle();
    const overlay = createOverlay();
    const banner = createBanner();
    document.documentElement.append(overlay, banner);

    let current: HTMLElement | null = null;

    const stop = () => {
      active = false;
      cancelHandle = null;
      overlay.remove();
      banner.remove();
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll, true);
    };

    cancelHandle = { resolve, stop };

    const paint = (el: HTMLElement | null) => {
      current = el;
      if (!el) {
        overlay.style.display = "none";
        return;
      }
      const rect = el.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };

    const onMouseMove = (e: MouseEvent) => {
      const el = pickElementAt(e.clientX, e.clientY, overlay, banner);
      if (el && el !== current) paint(el);
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Prefer `current` (set by mousemove, adjusted by arrow keys) since
      // that's what the overlay was painting. Fall back to elementsFromPoint
      // at the click coordinates when mousemove hasn't fired yet — e.g. the
      // user clicks immediately after activation without moving the cursor.
      const chosen = current ?? pickElementAt(e.clientX, e.clientY, overlay, banner);
      if (!chosen) return;
      stop();
      resolve({ element: chosen, selector: cssSelectorPath(chosen) });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stop();
        resolve(null);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const parent = current?.parentElement;
        if (parent && parent !== document.documentElement) paint(parent);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const child = current?.firstElementChild as HTMLElement | null;
        if (child) paint(child);
        return;
      }
    };

    const onScroll = () => {
      if (current) paint(current);
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
  });
}

export function showToast(
  message: string,
  opts: { variant?: "success" | "error"; persist?: boolean } = {},
): void {
  injectStyle();
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.dataset.variant = opts.variant ?? "success";
  if (opts.persist) toast.dataset.busy = "true";
  toast.textContent = message;
  document.documentElement.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  // Persistent toasts stay up until the next showToast() call replaces them.
  // Used by AI capture so the user has continuous feedback during the 2–5 s
  // model run.
  if (opts.persist) return;
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}

function pickElementAt(x: number, y: number, ...exclude: Element[]): HTMLElement | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (exclude.includes(el)) continue;
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

// Build a "reasonable" CSS selector path for a picked element. Walks up to <body>,
// stops early at any element with an id (since ids are unique), keeps up to two
// class names per step. Output is for human reference / reproducibility, not
// guaranteed to be unique on dynamic SPAs.
function cssSelectorPath(target: Element): string {
  const parts: string[] = [];
  let current: Element | null = target;
  while (current && current !== document.body && current.tagName !== "HTML") {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`${part}#${current.id}`);
      return parts.join(" > ");
    }
    const classes = classListString(current);
    if (classes) part += `.${classes}`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function classListString(el: Element): string {
  const raw = typeof el.className === "string" ? el.className : "";
  return raw
    .trim()
    .split(/\s+/)
    .filter((c) => c && !c.includes(":") && !c.includes("[") && c.length < 40)
    .slice(0, 2)
    .join(".");
}

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  return overlay;
}

function createBanner(): HTMLDivElement {
  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.textContent = "trakdown — click to capture, ↑↓ to resize, Esc to cancel";
  return banner;
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.trakdown-picking, html.trakdown-picking * { cursor: crosshair !important; }

    #${OVERLAY_ID} {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: ${Z_INDEX};
      background: rgba(15, 139, 126, 0.18);
      outline: 2px solid rgb(15, 139, 126);
      outline-offset: -2px;
      transition: transform 60ms linear, width 60ms linear, height 60ms linear;
      will-change: transform, width, height;
    }

    #${BANNER_ID} {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: ${Z_INDEX};
      pointer-events: none;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgb(42, 39, 34);
      color: rgb(251, 247, 238);
      font: 12px/1.4 "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: -0.005em;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
    }

    #${BANNER_ID}::before {
      content: "▍ ";
      color: rgb(15, 139, 126);
      font-weight: 700;
    }

    #${TOAST_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: ${Z_INDEX};
      pointer-events: none;
      padding: 14px 20px 14px 22px;
      border-radius: 10px;
      border-left: 4px solid rgb(15, 139, 126);
      background: rgb(42, 39, 34);
      color: rgb(251, 247, 238);
      font: 14px/1.45 "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: -0.005em;
      box-shadow:
        0 14px 40px rgba(0, 0, 0, 0.32),
        0 2px 6px rgba(0, 0, 0, 0.18);
      max-width: min(420px, calc(100vw - 48px));
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      transition:
        opacity 220ms ease,
        transform 280ms cubic-bezier(0.34, 1.45, 0.64, 1);
    }

    #${TOAST_ID}.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    #${TOAST_ID}[data-variant="error"] {
      background: rgb(127, 26, 26);
      border-left-color: rgb(248, 113, 113);
    }

    /* Pulsing left border while a long-running capture (e.g. AI) is in flight. */
    #${TOAST_ID}[data-busy="true"] {
      animation: trakdown-toast-pulse 1.4s ease-in-out infinite;
    }

    @keyframes trakdown-toast-pulse {
      0%, 100% { border-left-color: rgb(15, 139, 126); }
      50% { border-left-color: rgb(125, 220, 207); }
    }

    @media (prefers-reduced-motion: reduce) {
      #${TOAST_ID}[data-busy="true"] {
        animation: none;
      }
    }
  `;
  document.documentElement.appendChild(style);
}
