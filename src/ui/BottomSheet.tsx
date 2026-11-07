import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Altura do teclado virtual: no iPhone ele cobre a tela sem redimensioná-la. */
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Painel que sobe da parte de baixo no celular e vira janela central em telas largas.
 * Prende o foco, fecha com Esc ou tocando fora, e devolve o foco ao sair.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const keyboardOffset = useKeyboardOffset();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sheet = sheetRef.current;
    const preferred = sheet?.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? sheet)?.focus();
    document.documentElement.classList.add("has-sheet");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const focusable = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("has-sheet");
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="sheet-layer"
      style={{ "--keyboard-offset": `${keyboardOffset}px` } as CSSProperties}
    >
      {/* Toque fora fecha; para teclado e leitor de tela há o botão Fechar e a tecla Esc. */}
      <button
        type="button"
        className="sheet-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="sheet__handle" aria-hidden="true" />
        <div className="sheet__header">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button type="button" className="btn btn--secondary btn--small" onClick={onClose}>
            <Icon name="close" size={20} />
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
