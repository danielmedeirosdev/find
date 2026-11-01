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

// Derive movement from scroll position, with no autoplay or React renders per frame.
export function useScrollRails() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = root.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight - bounds.top) /
            (window.innerHeight + bounds.height),
        ),
      );
      const rows = root.querySelectorAll<HTMLElement>(".mkt-rail");
      rows.forEach((row, i) => {
        const travel = Math.max(0, row.scrollWidth - root.clientWidth);
        const shift = reduced.matches
          ? 0
          : -travel * (i === 0 ? progress : 1 - progress);
        row.style.setProperty("--rail-shift", `${shift.toFixed(2)}px`);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    root.querySelectorAll(".mkt-rail").forEach((row) => observer.observe(row));
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);
  return ref;
}
