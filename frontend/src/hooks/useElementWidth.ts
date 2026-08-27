// Live rendered container width via ResizeObserver, not a viewport media
// query (BPTimeline/PulseTrend mobile-overplotting fix, /impeccable
// critique P1, 2026-08-27) — what matters is the actual rendered chart
// width inside the `max-w-[1280px]` content column, not the window width,
// since the two diverge on any screen wider than the column cap.
import { useEffect, useRef, useState } from "react";

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width } as const;
}
