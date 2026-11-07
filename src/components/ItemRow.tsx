import type { Item } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ItemRowProps {
  item: Item;
  onToggle: (item: Item) => void;
  /** Ausente nos itens do carrinho, que só podem ser desmarcados. */
  onEdit?: (item: Item) => void;
}

export function ItemRow({ item, onToggle, onEdit }: ItemRowProps) {
  const label = item.done
    ? `Tirar ${item.text} do carrinho`
    : `Marcar ${item.text} como comprado`;

  return (
    <li className="item">
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
        <span className="item__text">{item.text}</span>
        {item.quantity > 1 && <span className="qty">{item.quantity}×</span>}
      </button>
      {onEdit && (
        <button
          type="button"
          className="item__edit"
          aria-label={`Editar ${item.text}`}
          onClick={() => onEdit(item)}
        >
          <Icon name="edit" size={18} />
          Editar
        </button>
      )}
    </li>
  );
}
