import type { ViewId } from "./types";

const VIEWS: ViewId[] = ["closet", "looks", "builder", "calendar"];

export function readView(): ViewId {
  const value = location.hash.replace("#", "");
  return VIEWS.includes(value as ViewId) ? (value as ViewId) : "closet";
}

export function go(view: ViewId) {
  const next = `#${view}`;
  if (location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  location.hash = next;
}
