export type CollectSubView = "outliers" | "collect" | "headlines" | "avatar";

export type CollectSubViewFlags = {
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
};

export const COLLECT_SUB_VIEWS: CollectSubView[] = [
  "outliers",
  "collect",
  "headlines",
  "avatar",
];

export const COLLECT_SUB_VIEW_LABELS: Record<CollectSubView, string> = {
  outliers: "Outliers",
  collect: "Ideas",
  headlines: "Headlines",
  avatar: "Avatar",
};

const VIEW_SET = new Set<CollectSubView>(COLLECT_SUB_VIEWS);

export function isCollectSubView(value: unknown): value is CollectSubView {
  return typeof value === "string" && VIEW_SET.has(value as CollectSubView);
}

/** Fill missing views and drop unknowns, keeping the given relative order. */
export function normalizeCollectViewOrder(order: readonly unknown[] | null | undefined): CollectSubView[] {
  const next: CollectSubView[] = [];
  const seen = new Set<CollectSubView>();

  if (Array.isArray(order)) {
    for (const item of order) {
      if (!isCollectSubView(item) || seen.has(item)) continue;
      next.push(item);
      seen.add(item);
    }
  }

  for (const view of COLLECT_SUB_VIEWS) {
    if (seen.has(view)) continue;
    next.push(view);
  }

  return next;
}

export function moveCollectView(
  order: readonly CollectSubView[],
  fromIndex: number,
  toIndex: number,
): CollectSubView[] {
  const next = normalizeCollectViewOrder(order);
  if (
    fromIndex < 0 ||
    fromIndex >= next.length ||
    toIndex < 0 ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return next;
  next.splice(toIndex, 0, moved);
  return next;
}

export function isCollectViewEnabled(view: CollectSubView, views: CollectSubViewFlags): boolean {
  if (view === "outliers") return views.showOutliersView;
  if (view === "collect") return views.showCollectView;
  if (view === "headlines") return views.showHeadlinesView;
  return views.showAvatarView;
}

export function firstEnabledCollectView(
  views: CollectSubViewFlags,
  order?: readonly CollectSubView[],
): CollectSubView {
  for (const view of normalizeCollectViewOrder(order)) {
    if (isCollectViewEnabled(view, views)) return view;
  }
  return "outliers";
}

export function enabledCollectViews(
  views: CollectSubViewFlags,
  order?: readonly CollectSubView[],
): CollectSubView[] {
  return normalizeCollectViewOrder(order).filter((view) => isCollectViewEnabled(view, views));
}
