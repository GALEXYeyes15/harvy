import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickRandomPhrase,
  randomEncouragementDelayMs,
  type EncouragementPhrase,
  type EncouragementPrefs,
} from "./encouragementSettings";

/**
 * Schedules random encouragement toasts while prefs.enabled and phrases exist.
 */
export function useEncouragementScheduler(prefs: EncouragementPrefs): {
  activePhrase: EncouragementPhrase | null;
  dismiss: () => void;
  showTest: () => void;
} {
  const [activePhrase, setActivePhrase] = useState<EncouragementPhrase | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const dismiss = useCallback(() => {
    setActivePhrase(null);
  }, []);

  const showTest = useCallback(() => {
    const phrase = pickRandomPhrase(prefsRef.current.phrases);
    if (phrase) setActivePhrase(phrase);
  }, []);

  useEffect(() => {
    if (!prefs.enabled || prefs.phrases.length === 0) return;

    let cancelled = false;
    let timeoutId = 0;

    const tick = () => {
      const { minMinutes, maxMinutes } = prefsRef.current;
      const delay = randomEncouragementDelayMs(minMinutes, maxMinutes);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const latest = prefsRef.current;
        if (!latest.enabled || latest.phrases.length === 0) return;
        const phrase = pickRandomPhrase(latest.phrases);
        if (phrase) setActivePhrase(phrase);
        tick();
      }, delay);
    };

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [prefs.enabled, prefs.minMinutes, prefs.maxMinutes, prefs.phrases]);

  return { activePhrase, dismiss, showTest };
}
