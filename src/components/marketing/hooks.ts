import { useEffect } from "react";
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
