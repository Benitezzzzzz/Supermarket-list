import { BottomSheet } from "./BottomSheet";

interface ConfirmSheetProps {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmação no visual do app, no lugar da janela padrão do navegador. */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="hint">{message}</p>
      <div className="sheet__actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={tone === "danger" ? "btn btn--danger" : "btn btn--primary"}
          data-autofocus
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
