import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useMarketingMeta(
  title: string,
  description: string,
  path: string,
) {
  useEffect(() => {
    document.title = title;
    const values: [string, string][] = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[property="og:url"]', `https://www.onefind.com.br${path}`],
    ];
    values.forEach(([selector, value]) =>
      document.querySelector(selector)?.setAttribute("content", value),
    );
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `https://www.onefind.com.br${path}`);
  }, [title, description, path]);
}
export function useMarketingScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (hash)
        document
          .getElementById(decodeURIComponent(hash.slice(1)))
          ?.scrollIntoView({ behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, hash]);
}

// Continuous movement, independent of page scrolling, with a seamless repeated row.
export function useScrollRails() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".mkt-rail"));
    let frame = 0;
    let lastTime = 0;
    let distance = 0;
    const tick = (time: number) => {
      const dt = lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;
      if (!root.matches(":hover, :focus-within")) distance += dt * 0.024;
      rows.forEach((row, index) => {
        const gap = parseFloat(getComputedStyle(row).gap) || 0;
        const cycle = (row.scrollWidth + gap) / 2;
        const offset = cycle ? distance % cycle : 0;
        row.style.transform = `translate3d(${- (index === 0 ? offset : cycle - offset)}px, 0, 0)`;
      });
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (!reduced.matches) frame = requestAnimationFrame(tick);
      else rows.forEach(row => { row.style.transform = "none"; });
    };
    reduced.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", start);
    };
  }, []);
  return ref;
}
