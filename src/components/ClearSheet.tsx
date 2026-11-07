import { BottomSheet } from "../ui/BottomSheet";

interface ClearSheetProps {
  doneCount: number;
  totalCount: number;
  onClearDone: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

/** Aberto pela lixeira do topo: limpa só os itens riscados ou a lista toda. */
export function ClearSheet({ doneCount, totalCount, onClearDone, onClearAll, onClose }: ClearSheetProps) {
  return (
    <BottomSheet title="Limpar a lista?" onClose={onClose}>
      <p className="hint">
        {doneCount > 0
          ? "Escolha o que sai da lista. Dá para desfazer logo depois."
          : `Todos os ${totalCount} itens saem da lista. Dá para desfazer logo depois.`}
      </p>
      <div className="form">
        {doneCount > 0 && (
          <button type="button" className="btn btn--secondary btn--block" onClick={onClearDone}>
            {doneCount === 1 ? "Limpar só o riscado (1)" : `Limpar só os riscados (${doneCount})`}
          </button>
        )}
        <button type="button" className="btn btn--danger btn--block" onClick={onClearAll}>
          Limpar a lista toda ({totalCount})
        </button>
        <button type="button" className="btn btn--link" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
