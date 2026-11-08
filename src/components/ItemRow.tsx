import { categoryStyle } from "../domain/categoryStyle";
import { formatMoney } from "../domain/money";
import { PRICE_ALERT_PERCENT, type PriceTrend } from "../domain/prices";
import type { Item } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ItemRowProps {
  item: Item;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  /** Última compra deste produto e a variação: só referência, não vira o preço desta compra. */
  price?: PriceTrend | null;
}

/** Marcado, o item continua no mesmo lugar, só riscado. */
export function ItemRow({ item, onToggle, onEdit, price }: ItemRowProps) {
  const lastPrice = price?.last;
  const percent = price?.percent ?? null;
  const alert = percent !== null && Math.abs(percent) >= PRICE_ALERT_PERCENT;
  const label = item.done ? `Desmarcar ${item.text}` : `Marcar ${item.text} como comprado`;
  const style = categoryStyle(item.category);

  return (
    <li className={item.done ? "item item--done" : "item"}>
      <button
        type="button"
        className="item__toggle"
        aria-pressed={item.done}
        aria-label={label}
        onClick={() => onToggle(item)}
      >
        {/* O ícone da categoria vira o visto quando o item vai para o carrinho. */}
        <span className={`item__tile ${style.tone}`} aria-hidden="true">
          {item.done ? <Icon name="check" size={22} strokeWidth={3} /> : <Icon name={style.icon} size={22} />}
        </span>
        <span className="item__body">
          <span className="item__text">{item.text}</span>
          {lastPrice && (
            <span className="item__ref">
              Última: {formatMoney(lastPrice.unitCents)}
              {lastPrice.brand && ` · ${lastPrice.brand}`}
              {alert && percent !== null && (
                <span className={percent > 0 ? "item__trend item__trend--up" : "item__trend item__trend--down"}>
                  {percent > 0 ? "▲" : "▼"} {Math.abs(percent)}%
                  <span className="visually-hidden">{percent > 0 ? " mais caro que a compra anterior" : " mais barato que a compra anterior"}</span>
                </span>
              )}
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
      </button>
    </li>
  );
}
