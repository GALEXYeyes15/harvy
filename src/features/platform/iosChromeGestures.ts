import { useEffect, useRef } from "react";

/** Swipes that start in the page margin, outside the text, open a sidebar. */
export const IOS_SIDEBAR_EDGE_PX = 72;
/** A downward swipe from this band shows the toolbar even when the page is scrolled. */
export const IOS_TOP_REVEAL_PX = 56;
export const IOS_CHROME_SWIPE_MIN_PX = 48;

export type IosChromeGesture =
  | "reveal-top-bar"
  | "open-left-sidebar"
  | "open-right-sidebar"
  | "close-left-sidebar"
  | "close-right-sidebar";

export type IosChromeSwipe = {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  width: number;
  chromeHidden: boolean;
  /** True when the writing scroller cannot move any further toward the start. */
  scrollerAtTop: boolean;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  onWritingSurface: boolean;
  onLeftSidebar: boolean;
  onRightSidebar: boolean;
};

function isHorizontalSwipe(dx: number, dy: number): boolean {
  const distance = Math.abs(dx);
  return distance >= IOS_CHROME_SWIPE_MIN_PX && distance > Math.abs(dy) * 1.25;
}

function isDownwardSwipe(dx: number, dy: number): boolean {
  return dy >= IOS_CHROME_SWIPE_MIN_PX && dy > Math.abs(dx) * 1.25;
}

/** Decide which chrome a completed finger swipe should open or close. */
export function classifyIosChromeSwipe(swipe: IosChromeSwipe): IosChromeGesture | null {
  const { dx, dy, startX, startY, width } = swipe;

  if (
    swipe.chromeHidden &&
    !swipe.onLeftSidebar &&
    !swipe.onRightSidebar &&
    isDownwardSwipe(dx, dy) &&
    (startY <= IOS_TOP_REVEAL_PX || swipe.scrollerAtTop)
  ) {
    return "reveal-top-bar";
  }

  if (!isHorizontalSwipe(dx, dy)) return null;

  if (swipe.leftSidebarOpen && dx < 0 && (swipe.onLeftSidebar || startX < width * 0.5)) {
    return "close-left-sidebar";
  }
  if (swipe.rightSidebarOpen && dx > 0 && (swipe.onRightSidebar || startX > width * 0.5)) {
    return "close-right-sidebar";
  }

  // Keep drags that start on the words themselves for selecting text.
  if (swipe.onWritingSurface) return null;

  if (dx > 0 && startX <= IOS_SIDEBAR_EDGE_PX && !swipe.leftSidebarOpen) {
    return "open-left-sidebar";
  }
  if (dx < 0 && startX >= width - IOS_SIDEBAR_EDGE_PX && !swipe.rightSidebarOpen) {
    return "open-right-sidebar";
  }
  return null;
}

/** True once a touch should stop scrolling or selecting so the chrome swipe can finish. */
export function shouldClaimIosChromeSwipe(swipe: IosChromeSwipe): boolean {
  const absX = Math.abs(swipe.dx);
  const absY = Math.abs(swipe.dy);
  if (
    swipe.chromeHidden &&
    !swipe.onLeftSidebar &&
    !swipe.onRightSidebar &&
    swipe.dy > 12 &&
    swipe.dy > absX &&
    (swipe.startY <= IOS_TOP_REVEAL_PX || swipe.scrollerAtTop)
  ) {
    return true;
  }
  if (absX <= 12 || absX <= absY) return false;
  if (swipe.onLeftSidebar || swipe.onRightSidebar) return true;
  if (swipe.onWritingSurface) return false;
  return swipe.startX <= IOS_SIDEBAR_EDGE_PX || swipe.startX >= swipe.width - IOS_SIDEBAR_EDGE_PX;
}

type GestureFlags = {
  ignore: boolean;
  onWritingSurface: boolean;
  onLeftSidebar: boolean;
  onRightSidebar: boolean;
};

function gestureFlags(target: EventTarget | null): GestureFlags {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return { ignore: true, onWritingSurface: false, onLeftSidebar: false, onRightSidebar: false };
  }
  if (element.closest('[role="dialog"], .harvy-context-menu, [data-floating-text-menu]')) {
    return { ignore: true, onWritingSurface: false, onLeftSidebar: false, onRightSidebar: false };
  }
  const onLeftSidebar = Boolean(element.closest('[data-harvy-sidebar="files"]'));
  const onRightSidebar = Boolean(element.closest('[data-harvy-sidebar="tools"]'));
  if (!onLeftSidebar && !onRightSidebar && element.closest('button, a, [role="tab"], select')) {
    return { ignore: true, onWritingSurface: false, onLeftSidebar: false, onRightSidebar: false };
  }
  return {
    ignore: false,
    onWritingSurface: Boolean(
      element.closest(".ProseMirror, .harvy-doc-title, .harvy-doc-subtitle"),
    ),
    onLeftSidebar,
    onRightSidebar,
  };
}

function writingScrollerAtTop(): boolean {
  const scroller = document.querySelector("[data-harvy-writing-scroller]");
  if (!(scroller instanceof HTMLElement)) return true;
  return scroller.scrollTop <= 8;
}

type IosChromeGestureOptions = {
  enabled: boolean;
  chromeHidden: boolean;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  onRevealTopBar: () => void;
  onOpenLeftSidebar: () => void;
  onOpenRightSidebar: () => void;
  onCloseLeftSidebar: () => void;
  onCloseRightSidebar: () => void;
};

/**
 * iPad stand-in for the Mac chrome shortcuts.
 * Swipe right from the left margin to open files, left from the right margin to open tools,
 * and down from the top (or pull down at the start of the page) to bring the toolbar back.
 */
export function useIosChromeGestures(options: IosChromeGestureOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.enabled || typeof window === "undefined") return;

    let sample: {
      id: number;
      startX: number;
      startY: number;
      flags: GestureFlags;
    } | null = null;

    const swipeFrom = (
      origin: { startX: number; startY: number },
      touch: Touch,
      flags: GestureFlags,
    ): IosChromeSwipe => {
      const current = optionsRef.current;
      return {
        startX: origin.startX,
        startY: origin.startY,
        dx: touch.clientX - origin.startX,
        dy: touch.clientY - origin.startY,
        width: window.innerWidth,
        chromeHidden: current.chromeHidden,
        scrollerAtTop: writingScrollerAtTop(),
        leftSidebarOpen: current.leftSidebarOpen,
        rightSidebarOpen: current.rightSidebarOpen,
        onWritingSurface: flags.onWritingSurface,
        onLeftSidebar: flags.onLeftSidebar,
        onRightSidebar: flags.onRightSidebar,
      };
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        sample = null;
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      const flags = gestureFlags(event.target);
      if (flags.ignore) {
        sample = null;
        return;
      }
      sample = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, flags };
    };

    const onMove = (event: TouchEvent) => {
      if (!sample) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === sample?.id);
      if (!touch) return;
      if (shouldClaimIosChromeSwipe(swipeFrom(sample, touch, sample.flags))) {
        event.preventDefault();
      }
    };

    const finish = (event: TouchEvent) => {
      if (!sample) return;
      const current = sample;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === current.id);
      sample = null;
      if (!touch) return;
      const action = classifyIosChromeSwipe(swipeFrom(current, touch, current.flags));
      if (!action) return;
      event.preventDefault();
      const handlers = optionsRef.current;
      if (action === "reveal-top-bar") handlers.onRevealTopBar();
      else if (action === "open-left-sidebar") handlers.onOpenLeftSidebar();
      else if (action === "open-right-sidebar") handlers.onOpenRightSidebar();
      else if (action === "close-left-sidebar") handlers.onCloseLeftSidebar();
      else handlers.onCloseRightSidebar();
    };

    const onCancel = () => {
      sample = null;
    };

    window.addEventListener("touchstart", onStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onMove, { capture: true, passive: false });
    window.addEventListener("touchend", finish, { capture: true, passive: false });
    window.addEventListener("touchcancel", onCancel, { capture: true });
    return () => {
      window.removeEventListener("touchstart", onStart, { capture: true });
      window.removeEventListener("touchmove", onMove, { capture: true });
      window.removeEventListener("touchend", finish, { capture: true });
      window.removeEventListener("touchcancel", onCancel, { capture: true });
    };
  }, [options.enabled]);
}
