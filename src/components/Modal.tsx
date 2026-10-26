import { useEffect, useRef, type ReactNode } from "react";
interface Props {
  label: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}
export function Modal({
  label,
  onClose,
  busy = false,
  className = "",
  children,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);

  const pending = useRef(busy);

  useEffect(()=>{close.current=onClose;pending.current=busy},[onClose,busy]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nodes = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((n) => n.getClientRects().length > 0);
    (nodes()[0] || root.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending.current) {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const list = nodes(),
          first = list[0],
          last = list[list.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-busy={busy}
      className={className}
    >
      {children}
    </div>
  );
}
