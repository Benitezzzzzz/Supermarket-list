import { type FormEvent, useRef, useState } from "react";
import { MAX_QUANTITY } from "../domain/items";
import { capitalize, parseQuantity } from "../domain/quantity";
import type { PricePoint } from "../domain/prices";
import type { Item } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { CategoryPicker } from "./CategoryPicker";
import { PriceHistory } from "./PriceHistory";

type ItemChanges = Partial<Pick<Item, "text" | "category" | "quantity">>;

const MAX_NAME = 80;

interface ItemNameProps {
  text: string;
  /** quantity só vem quando o nome novo traz a quantidade, como "Peixe 2". */
  onRename: (text: string, quantity?: number) => void;
}

/** O nome no topo do painel: tocar nele abre o campo para corrigir. */
function ItemName({ text, onRename }: ItemNameProps) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Depois de salvar ou desistir, o blur que vem em seguida não salva de novo. */
  const done = useRef(false);

  function open() {
    done.current = false;
    setDraft(text);
  }

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (draft === null || done.current) return;
    done.current = true;
    const typed = draft.trim().replace(/\s+/g, " ");
    const parsed = parseQuantity(typed);
    // "Peixe 2" vira o nome Peixe com 2 unidades, como no Novo item.
    if (parsed.text !== typed) onRename(parsed.text, parsed.quantity);
    else {
      const value = capitalize(typed);
      if (value && value !== text) onRename(value);
    }
    setDraft(null);
  }

  if (draft === null) {
    return (
      // O nome do painel continua sendo só o do item; a dica vai como descrição.
      <button type="button" className="item-name" title="Tocar para mudar o nome" onClick={open}>
        <span>{text}</span>
        <span className="item-name__icon" aria-hidden="true">
          <Icon name="edit" size={18} />
        </span>
      </button>
    );
  }

  return (
    <form className="item-name__form" onSubmit={save}>
      <input
        className="field item-name__field"
        aria-label="Nome do produto"
        maxLength={MAX_NAME}
        enterKeyHint="done"
        // O painel abre com o nome selecionado, pronto para trocar ou corrigir.
        autoFocus
        onFocus={(event) => event.target.select()}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save()}
        onKeyDown={(event) => {
          // Esc desiste da troca sem fechar o painel.
          if (event.key === "Escape") {
            event.preventDefault();
            event.nativeEvent.stopImmediatePropagation();
            done.current = true;
            setDraft(null);
          }
        }}
      />
    </form>
  );
}

interface EditItemSheetProps {
  item: Item;
  categories: string[];
  /** Preços já pagos por este produto, do mais recente ao mais antigo. */
  prices: PricePoint[];
  onUpdate: (changes: ItemChanges) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Cada mudança vale na hora; não existe botão de salvar. */
export function EditItemSheet({ item, categories, prices, onUpdate, onRemove, onClose }: EditItemSheetProps) {
  return (
    <BottomSheet title={<ItemName
          text={item.text}
          onRename={(text, quantity) => onUpdate(quantity === undefined ? { text } : { text, quantity })}
        />} onClose={onClose}>
      <span className="field-label">Quantidade</span>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Diminuir quantidade de ${item.text}`}
          disabled={item.quantity <= 1}
          onClick={() => onUpdate({ quantity: item.quantity - 1 })}
        >
          <Icon name="minus" size={26} strokeWidth={2.6} />
        </button>
        <output className="stepper__value" aria-label={`Quantidade de ${item.text}`}>
          {item.quantity}
        </output>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Aumentar quantidade de ${item.text}`}
          disabled={item.quantity >= MAX_QUANTITY}
          onClick={() => onUpdate({ quantity: item.quantity + 1 })}
        >
          <Icon name="plus" size={26} strokeWidth={2.6} />
        </button>
      </div>

      <span className="field-label">Categoria</span>
      <CategoryPicker
        label={`Categoria de ${item.text}`}
        categories={categories}
        value={item.category}
        onChange={(category) => onUpdate({ category })}
      />

      <span className="field-label">Preços anteriores</span>
      <PriceHistory points={prices} />

      <button type="button" className="btn btn--danger-soft btn--block" onClick={onRemove}>
        Tirar da lista
      </button>
    </BottomSheet>
  );
}
