// Drag to reorder cards, with Pointer Events so mouse, pen and touch share one path. A mouse picks a
// card up once it moves a few pixels (a press without movement stays a click); a finger or pen holds
// still briefly first, so a swipe still scrolls. The other cards slide to open a gap where the card
// will land; dropping commits. Escape, leaving the window, or releasing well clear of the sidebar
// (or dock) cancels.

import { moveIndex } from '../yourChords';

const MOUSE_SLOP = 5;
const TOUCH_SLOP = 8;
const HOLD_MS = 300;
/** Auto-scroll when the pointer is this close to a scroller's edge. */
const EDGE = 36;
/** Releasing this far outside the bounds cancels; closer still drops. */
const CANCEL_MARGIN = 60;
/** A click this soon after a drop is part of it (never a double-click to duplicate). */
const AFTER_DROP_MS = 600;

interface Options {
  /** The draggable items, in order (the add card isn't one). */
  items: () => HTMLElement[];
  /** Ignore presses that start on these (e.g. the remove button). */
  ignore: string;
  /** Elements that may scroll while dragging (the strip, the sidebar). */
  scrollers: () => HTMLElement[];
  /** Releasing within CANCEL_MARGIN of this drops; further away cancels. */
  bounds: () => HTMLElement;
  onMove: (from: number, to: number) => void;
  /** A card lifted by a hold and let go without moving: treat it as a click. */
  onTap: (index: number) => void;
}

let dragging = false;

/** Whether a card is lifted right now (shortcuts and Clear wait until it's down). */
export const isDragging = () => dragging;

export function enableReorder(container: HTMLElement, opts: Options): { cancel: () => void } {
  let pending: { el: HTMLElement; index: number; id: number; x0: number; y0: number; touch: boolean; timer: number } | null = null;
  let drag: {
    rects: DOMRect[]; items: HTMLElement[]; scroll0: { el: HTMLElement; left: number; top: number }[];
    target: number; x: number; y: number; frame: number; moved: boolean; lockY: boolean;
  } | null = null;
  let suppressClick = false;
  let droppedAt = 0;

  const scrollShift = () => {
    let dx = 0;
    let dy = 0;
    for (const s of drag!.scroll0) {
      dx += s.el.scrollLeft - s.left;
      dy += s.el.scrollTop - s.top;
    }
    return { dx, dy };
  };

  const start = () => {
    if (!pending) return;
    const { el, id } = pending;
    clearTimeout(pending.timer);
    const items = opts.items();
    drag = {
      items, rects: items.map((it) => it.getBoundingClientRect()),
      scroll0: opts.scrollers().map((s) => ({ el: s, left: s.scrollLeft, top: s.scrollTop })),
      target: pending.index, x: pending.x0, y: pending.y0, frame: 0, moved: false,
      // In a one-row strip the card only slides sideways, so it's never clipped by the strip.
      lockY: getComputedStyle(container).display === 'flex',
    };
    dragging = true;
    try {
      el.setPointerCapture(id);
    } catch {
      // The pointer may already be gone.
    }
    container.classList.add('reordering');
    el.classList.add('dragging');
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const layout = () => {
    if (!pending || !drag) return;
    const { dx, dy } = scrollShift();
    const { el, index, x0, y0 } = pending;
    el.style.transform = `translate(${drag.x - x0 + dx}px, ${drag.lockY ? 0 : drag.y - y0 + dy}px)`;
    // The slot nearest the pointer (in the layout as it was when the drag began).
    const px = drag.x + dx;
    const py = drag.y + dy;
    let best = index;
    let bestDist = Infinity;
    drag.rects.forEach((r, i) => {
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    // Below every card (the empty sidebar space): last.
    if (py > Math.max(...drag.rects.map((r) => r.bottom))) best = drag.rects.length - 1;
    drag.target = best;
    drag.items.forEach((it, i) => {
      if (i === index) return;
      const to = drag!.rects[moveIndex(i, index, best)];
      const from = drag!.rects[i];
      it.style.transform = to === from ? '' : `translate(${to.left - from.left}px, ${to.top - from.top}px)`;
    });
  };

  function autoScroll() {
    if (!drag) return;
    let moved = false;
    for (const s of opts.scrollers()) {
      const r = s.getBoundingClientRect();
      const speed = (near: number) => (near < EDGE ? Math.ceil((EDGE - near) / 4) : 0);
      if (s.scrollWidth > s.clientWidth) {
        const step = speed(drag.x - r.left) ? -speed(drag.x - r.left) : speed(r.right - drag.x);
        if (step) {
          const before = s.scrollLeft;
          s.scrollLeft += step;
          moved ||= s.scrollLeft !== before;
        }
      }
      if (s.scrollHeight > s.clientHeight) {
        const step = speed(drag.y - r.top) ? -speed(drag.y - r.top) : speed(r.bottom - drag.y);
        if (step) {
          const before = s.scrollTop;
          s.scrollTop += step;
          moved ||= s.scrollTop !== before;
        }
      }
    }
    if (moved) layout();
    drag.frame = requestAnimationFrame(autoScroll);
  }

  const finish = (commit: boolean) => {
    const p = pending;
    const d = drag;
    pending = null;
    drag = null;
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', onCancel);
    document.removeEventListener('visibilitychange', onCancel);
    p?.el.removeEventListener('lostpointercapture', onCancel);
    if (!p) return;
    clearTimeout(p.timer);
    if (!d) return;
    cancelAnimationFrame(d.frame);
    // A drag never counts as a click (or a double-click) on the card.
    suppressClick = true;
    droppedAt = performance.now();
    container.classList.remove('reordering');
    p.el.classList.remove('dragging');
    d.items.forEach((it) => (it.style.transform = ''));
    if (commit && !d.moved) opts.onTap(p.index);
    else if (commit && d.target !== p.index) opts.onMove(p.index, d.target);
  };

  const onMove = (e: PointerEvent) => {
    if (!pending || e.pointerId !== pending.id) return;
    if (!drag) {
      const dist = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0);
      if (pending.touch) {
        if (dist > TOUCH_SLOP) finish(false); // a swipe: let it scroll
        return;
      }
      if (dist <= MOUSE_SLOP) return;
      start();
    }
    if (Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0) > (pending.touch ? TOUCH_SLOP : MOUSE_SLOP)) drag!.moved = true;
    drag!.x = e.clientX;
    drag!.y = e.clientY;
    layout();
  };

  const onUp = (e: PointerEvent) => {
    if (!pending || e.pointerId !== pending.id) return;
    const r = opts.bounds().getBoundingClientRect();
    const m = CANCEL_MARGIN;
    const near = e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
    finish(near);
  };
  const onCancel = () => finish(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drag) {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  };

  container.addEventListener('pointerdown', (e) => {
    if (pending || !e.isPrimary || e.button !== 0) return;
    suppressClick = false;
    const target = e.target as Element;
    if (target.closest(opts.ignore)) return;
    const items = opts.items();
    const el = items.find((it) => it.contains(target));
    if (!el) return;
    // Chosen by the kind of pointer, not the layout: a finger or pen on the desktop layout still scrolls.
    const touch = e.pointerType !== 'mouse';
    pending = { el, index: items.indexOf(el), id: e.pointerId, x0: e.clientX, y0: e.clientY, touch, timer: 0 };
    if (touch) pending.timer = window.setTimeout(start, HOLD_MS);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onCancel);
    document.addEventListener('visibilitychange', onCancel);
    el.addEventListener('lostpointercapture', onCancel);
  });
  // While a card is held, a finger moving it mustn't scroll the strip; and no long-press menu.
  container.addEventListener('touchmove', (e) => drag && e.preventDefault(), { passive: false });
  container.addEventListener('contextmenu', (e) => {
    if (opts.items().some((it) => it.contains(e.target as Node))) e.preventDefault();
  });
  container.addEventListener('click', (e) => {
    if (suppressClick || (e.detail >= 2 && performance.now() - droppedAt < AFTER_DROP_MS)) {
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  return { cancel: () => finish(false) };
}
