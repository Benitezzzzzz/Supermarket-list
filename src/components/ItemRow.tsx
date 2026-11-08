import { formatMoney } from "../domain/money";
import type { PricePoint } from "../domain/prices";
import type { Item } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ItemRowProps {
  item: Item;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  /** Última compra deste produto: só referência, não vira o preço desta compra. */
  lastPrice?: PricePoint;
}

/** Marcado, o item continua no mesmo lugar, só riscado. */
export function ItemRow({ item, onToggle, onEdit, lastPrice }: ItemRowProps) {
  const label = item.done ? `Desmarcar ${item.text}` : `Marcar ${item.text} como comprado`;

  return (
    <li className={item.done ? "item item--done" : "item"}>
      <button
        type="button"
        className="item__toggle"
        aria-pressed={item.done}
        aria-label={label}
        onClick={() => onToggle(item)}
      >
        <span className={item.done ? "check check--done" : "check"}>
          {item.done && <Icon name="check" size={18} strokeWidth={3.2} />}
        </span>
        <span className="item__body">
          <span className="item__text">{item.text}</span>
          {lastPrice && (
            <span className="item__ref">
              Última: {formatMoney(lastPrice.unitCents)}
              {lastPrice.brand && ` · ${lastPrice.brand}`}
            </span>
          )}
        </span>
        {item.quantity > 1 && <span className="qty">{item.quantity}×</span>}
      </button>
      <button
        type="button"
        className="item__edit"
        aria-label={`Editar ${item.text}`}
        onClick={() => onEdit(item)}
      >
        <Icon name="edit" size={18} />
        Editar
      </button>
    </li>
  );
}
