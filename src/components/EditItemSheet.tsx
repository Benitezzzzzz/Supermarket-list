import { MAX_QUANTITY } from "../domain/items";
import type { PricePoint } from "../domain/prices";
import type { Item } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { CategoryPicker } from "./CategoryPicker";
import { PriceHistory } from "./PriceHistory";

type ItemChanges = Partial<Pick<Item, "category" | "quantity">>;

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
    <BottomSheet title={item.text} onClose={onClose}>
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
