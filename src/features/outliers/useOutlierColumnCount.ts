import { useEffect, useRef, useState } from "react";

const XL_MQ = "(min-width: 1280px)";
const LG_MQ = "(min-width: 1024px)";
const SM_MQ = "(min-width: 640px)";

/** Match AppShell sidebar `duration-500`. */
export const OUTLIER_SIDEBAR_TRANSITION_MS = 500;

/** Fade out before swapping columns / fade in after. */
export const OUTLIER_COLUMN_REFLOW_FADE_MS = 140;

export type OutlierSidebarOpenState = {
  workspaceSidebarOpen: boolean;
  toolsSidebarOpen: boolean;
};

/** Desktop target: both closed → 5, one open → 4, both open → 3. */
export function columnsFromSidebars(
  workspaceSidebarOpen: boolean,
  toolsSidebarOpen: boolean,
): number {
  return 5 - Number(workspaceSidebarOpen) - Number(toolsSidebarOpen);
}

/**
 * Wait for the sidebar width animation before reshuffling cards.
 * Drop columns early (avoid squeeze); add columns once space has opened.
 */
export function columnCountSettleDelayMs(from: number, to: number): number {
  if (to === from) return 0;
  if (to < from) return Math.round(OUTLIER_SIDEBAR_TRANSITION_MS * 0.1);
  return Math.round(OUTLIER_SIDEBAR_TRANSITION_MS * 0.58);
}

function readViewportMaxColumns(): number {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia(XL_MQ).matches) return 5;
  if (window.matchMedia(LG_MQ).matches) return 3;
  if (window.matchMedia(SM_MQ).matches) return 2;
  return 1;
}

export function resolveOutlierColumnCount(
  workspaceSidebarOpen: boolean,
  toolsSidebarOpen: boolean,
): number {
  const max = readViewportMaxColumns();
  if (max <= 2) return max;
  return Math.min(max, columnsFromSidebars(workspaceSidebarOpen, toolsSidebarOpen));
}

export type OutlierColumnCountState = {
  columnCount: number;
  isReflowing: boolean;
};

/**
 * Masonry column count from viewport floors plus open sidebars.
 * At xl+: 3 / 4 / 5 when both / one / neither sidebar is open.
 * Column changes ease with the sidebar width animation via a short crossfade.
 */
export function useOutlierColumnCount({
  workspaceSidebarOpen,
  toolsSidebarOpen,
}: OutlierSidebarOpenState): OutlierColumnCountState {
  const [targetCount, setTargetCount] = useState(() =>
    resolveOutlierColumnCount(workspaceSidebarOpen, toolsSidebarOpen),
  );
  const [columnCount, setColumnCount] = useState(targetCount);
  const [isReflowing, setIsReflowing] = useState(false);
  const columnCountRef = useRef(columnCount);
  columnCountRef.current = columnCount;

  useEffect(() => {
    const xl = window.matchMedia(XL_MQ);
    const lg = window.matchMedia(LG_MQ);
    const sm = window.matchMedia(SM_MQ);

    const update = () =>
      setTargetCount(resolveOutlierColumnCount(workspaceSidebarOpen, toolsSidebarOpen));
    update();

    xl.addEventListener("change", update);
    lg.addEventListener("change", update);
    sm.addEventListener("change", update);
    return () => {
      xl.removeEventListener("change", update);
      lg.removeEventListener("change", update);
      sm.removeEventListener("change", update);
    };
  }, [workspaceSidebarOpen, toolsSidebarOpen]);

  useEffect(() => {
    if (targetCount === columnCountRef.current) return;

    const from = columnCountRef.current;
    const settleDelay = columnCountSettleDelayMs(from, targetCount);
    const dropping = targetCount < from;
    let fadeTimer = 0;
    let settleInTimer = 0;

    const settleTimer = window.setTimeout(() => {
      setIsReflowing(true);
      // Drop columns immediately (avoid squeeze); add columns after a short fade-out.
      const swapDelay = dropping ? 0 : OUTLIER_COLUMN_REFLOW_FADE_MS;
      fadeTimer = window.setTimeout(() => {
        setColumnCount(targetCount);
        settleInTimer = window.setTimeout(() => {
          setIsReflowing(false);
        }, OUTLIER_COLUMN_REFLOW_FADE_MS);
      }, swapDelay);
    }, settleDelay);

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(settleInTimer);
      setIsReflowing(false);
    };
  }, [targetCount]);

  return { columnCount, isReflowing };
}
