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

// Follow scroll with gentle, time-based inertia instead of snapping to each event.
export function useScrollRails() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".mkt-rail"));
    let frame = 0;
    let lastTime = 0;
    let progress = 0.5;
    let target = progress;
    let top = 0;
    let height = 1;
    let travel: number[] = [];
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      top = bounds.top + window.scrollY;
      height = bounds.height;
      travel = rows.map(row => Math.min(280, Math.max(0, row.scrollWidth - root.clientWidth)));
      schedule();
    };
    const paint = () => rows.forEach((row, i) => {
      const shift = reduced.matches ? 0 : -travel[i] * (i === 0 ? progress : 1 - progress);
      row.style.transform = `translate3d(${shift}px, 0, 0)`;
    });
    const tick = (time: number) => {
      frame = 0;
      const dt = lastTime ? Math.min(64, time - lastTime) : 16.67;
      lastTime = time;
      progress += (target - progress) * (1 - Math.exp(-dt / 180));
      if (Math.abs(target - progress) < 0.0001) progress = target;
      paint();
      if (progress !== target) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };
    function schedule() {
      target = Math.max(0, Math.min(1, (window.innerHeight + window.scrollY - top) / (window.innerHeight + height)));
      if (reduced.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        progress = target;
        paint();
      } else if (!frame) frame = requestAnimationFrame(tick);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    reduced.addEventListener("change", schedule);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    rows.forEach(row => observer.observe(row));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", schedule);
    };
  }, []);
  return ref;
}
