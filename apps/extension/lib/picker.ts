const OVERLAY_ID = 'trakdown-picker-overlay';
const BANNER_ID = 'trakdown-picker-banner';
const STYLE_ID = 'trakdown-picker-style';
const TOAST_ID = 'trakdown-toast';
const Z_INDEX = 2147483647;

export interface PickerResult {
  element: HTMLElement;
}

let active = false;

export function isPickerActive(): boolean {
  return active;
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
      overlay.remove();
      banner.remove();
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll, true);
    };

    const paint = (el: HTMLElement | null) => {
      current = el;
      if (!el) {
        overlay.style.display = 'none';
        return;
      }
      const rect = el.getBoundingClientRect();
      overlay.style.display = 'block';
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
      if (!current) return;
      const chosen = current;
      stop();
      resolve({ element: chosen });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stop();
        resolve(null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const parent = current?.parentElement;
        if (parent && parent !== document.documentElement) paint(parent);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const child = current?.firstElementChild as HTMLElement | null;
        if (child) paint(child);
        return;
      }
    };

    const onScroll = () => {
      if (current) paint(current);
    };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll, true);
  });
}

export function showToast(message: string, opts: { variant?: 'success' | 'error' } = {}): void {
  injectStyle();
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.dataset.variant = opts.variant ?? 'success';
  toast.textContent = message;
  document.documentElement.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2400);
}

function pickElementAt(
  x: number,
  y: number,
  ...exclude: Element[]
): HTMLElement | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (exclude.includes(el)) continue;
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  return overlay;
}

function createBanner(): HTMLDivElement {
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.textContent = 'trakdown — click to capture, ↑↓ to resize, Esc to cancel';
  return banner;
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
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
      bottom: 20px;
      right: 20px;
      z-index: ${Z_INDEX};
      pointer-events: none;
      padding: 10px 16px;
      border-radius: 8px;
      background: rgb(42, 39, 34);
      color: rgb(251, 247, 238);
      font: 13px/1.4 "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: -0.005em;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 200ms ease, transform 200ms ease;
    }

    #${TOAST_ID}::before {
      content: "▍ ";
      color: rgb(15, 139, 126);
      font-weight: 700;
    }

    #${TOAST_ID}.show {
      opacity: 1;
      transform: translateY(0);
    }

    #${TOAST_ID}[data-variant="error"] {
      background: rgb(153, 27, 27);
    }

    #${TOAST_ID}[data-variant="error"]::before {
      color: rgb(245, 245, 242);
      content: "✕ ";
    }
  `;
  document.documentElement.appendChild(style);
}
