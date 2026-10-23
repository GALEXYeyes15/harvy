import { useEffect, useState } from "react";
import { isTauriRuntime } from "../save/saveRuntime";
import { tauriClientPlatform } from "../workspace/pickDirectory";

/** WKWebView on iPad reports touch points; the Mac app does not. */
function likelyIosWebView(): boolean {
  if (typeof navigator === "undefined" || !isTauriRuntime()) return false;
  return navigator.maxTouchPoints > 1;
}

/** True in the iPad/iPhone app. Desktop and the browser stay false. */
export function useIosClient(): boolean {
  const [ios, setIos] = useState(likelyIosWebView);
  useEffect(() => {
    let cancelled = false;
    void tauriClientPlatform().then((platform) => {
      if (!cancelled) setIos(platform === "ios");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ios;
}
