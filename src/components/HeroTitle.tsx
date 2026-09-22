import { useEffect, useState } from "react";
const phrases = [
  "Organize seu pet shop.",
  "Simplifique sua rotina.",
  "Comece em 1 minuto.",
];
export function HeroTitle() {
  const [text, setText] = useState(phrases[2]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let phrase = 0;
    let count = 0;
    function tick() {
      if (media.matches) {
        setText(phrases[2]);
        return;
      }
      count += 1;
      setText(phrases[phrase].slice(0, count));
      if (count < phrases[phrase].length) timer = setTimeout(tick, 24);
      else if (phrase < 2)
        timer = setTimeout(() => {
          phrase += 1;
          count = 0;
          tick();
        }, 400);
    }
    timer = setTimeout(tick, 100);
    const stop = () => {
      if (media.matches) {
        clearTimeout(timer);
        setText(phrases[2]);
      }
    };
    media.addEventListener("change", stop);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", stop);
    };
  }, []);
  return (
    <h1 className="premium-hero-title">
      <span className="sr-only">Comece em 1 minuto.</span>
      <span aria-hidden="true">
        {text === phrases[2] ? (
          <>
            Comece em
            <br />
            <em>1 minuto.</em>
          </>
        ) : (
          text
        )}
      </span>
    </h1>
  );
}
