export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`brand-logo${inverse ? " brand-logo-inverse" : ""}`}
      aria-label="onefind"
    >
      <img src="/favicon.svg" width="32" height="32" alt="" />
      <span>
        one<span className="brand-gold">find</span>
      </span>
    </span>
  );
}
