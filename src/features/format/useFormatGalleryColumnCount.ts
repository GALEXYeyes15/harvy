import { useEffect, useState } from "react";

const XL_MQ = "(min-width: 1280px)";
const LG_MQ = "(min-width: 1024px)";
const SM_MQ = "(min-width: 640px)";

function readColumnCount(): number {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia(XL_MQ).matches) return 4;
  if (window.matchMedia(LG_MQ).matches) return 3;
  if (window.matchMedia(SM_MQ).matches) return 2;
  return 1;
}

/** Match Tailwind `sm` / `lg` / `xl` breakpoints used by the format gallery. */
export function useFormatGalleryColumnCount(): number {
  const [columnCount, setColumnCount] = useState(readColumnCount);

  useEffect(() => {
    const xl = window.matchMedia(XL_MQ);
    const lg = window.matchMedia(LG_MQ);
    const sm = window.matchMedia(SM_MQ);

    const update = () => setColumnCount(readColumnCount());
    update();

    xl.addEventListener("change", update);
    lg.addEventListener("change", update);
    sm.addEventListener("change", update);
    return () => {
      xl.removeEventListener("change", update);
      lg.removeEventListener("change", update);
      sm.removeEventListener("change", update);
    };
  }, []);

  return columnCount;
}
