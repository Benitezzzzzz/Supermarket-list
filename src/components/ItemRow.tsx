import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import { categoryStyle } from "../domain/categoryStyle";
import { MAX_QUANTITY } from "../domain/items";
import { formatMoney } from "../domain/money";
import { PRICE_ALERT_PERCENT, type PriceTrend } from "../domain/prices";
import type { Item } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ItemRowProps {
  item: Item;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  /** Muda a quantidade pelos botões − e + da própria linha. */
  onQuantity: (item: Item, quantity: number) => void;
  /** Última compra deste produto e a variação: só referência, não vira o preço desta compra. */
  price?: PriceTrend | null;
}

/** Quanto o dedo precisa arrastar para o lado para marcar ou desmarcar. */
const SWIPE_PX = 72;

/**
 * Arrastar a linha para o lado marca ou desmarca o item, como tocar nela.
 * O movimento só conta quando é mais de lado do que para cima, para não atrapalhar a rolagem.
 */
function useSwipe(onSwipe: () => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiping = useRef(false);
  /** Depois de arrastar, o toque que o navegador solta no fim não pode marcar de novo. */
  const swallowClick = useRef(false);
  const [offset, setOffset] = useState(0);

  function reset() {
    start.current = null;
    swiping.current = false;
    setOffset(0);
  }

  return {
    offset,
    consumeClick() {
      const swallow = swallowClick.current;
      swallowClick.current = false;
      return swallow;
    },
    handlers: {
      onPointerDown(event: PointerEvent<HTMLLIElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        swiping.current = false;
        swallowClick.current = false;
      },
      onPointerMove(event: PointerEvent<HTMLLIElement>) {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (!swiping.current) {
          if (Math.abs(dy) > 12) {
            start.current = null;
            return;
          }
          if (Math.abs(dx) < 12) return;
          swiping.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        setOffset(Math.max(-SWIPE_PX * 1.4, Math.min(SWIPE_PX * 1.4, dx)));
      },
      onPointerUp(event: PointerEvent<HTMLLIElement>) {
        const origin = start.current;
        if (swiping.current && origin) {
          swallowClick.current = true;
          if (Math.abs(event.clientX - origin.x) >= SWIPE_PX) onSwipe();
        }
        reset();
      },
      onPointerCancel: reset,
    },
  };
}

/** Marcado, o item continua no mesmo lugar, só riscado. */
export function ItemRow({ item, onToggle, onEdit, onQuantity, price }: ItemRowProps) {
  const swipe = useSwipe(() => onToggle(item));
  const ready = Math.abs(swipe.offset) >= SWIPE_PX;
  const lastPrice = price?.last;
  const percent = price?.percent ?? null;
  const alert = percent !== null && Math.abs(percent) >= PRICE_ALERT_PERCENT;
  const label = item.done ? `Desmarcar ${item.text}` : `Marcar ${item.text} como comprado`;
  const style = categoryStyle(item.category);

  return (
    <li
      className={`item${item.done ? " item--done" : ""}${swipe.offset !== 0 ? " item--swiping" : ""}${ready ? " item--swipe-ready" : ""}`}
      style={swipe.offset !== 0 ? ({ "--swipe": `${swipe.offset}px` } as CSSProperties) : undefined}
      {...swipe.handlers}
    >
      <button
        type="button"
        className="item__toggle"
        aria-pressed={item.done}
        aria-label={label}
        onClick={() => {
          if (!swipe.consumeClick()) onToggle(item);
        }}
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
              {lastPrice.storeName && ` no ${lastPrice.storeName}`}
              {lastPrice.brand && ` · ${lastPrice.brand}`}
              {alert && percent !== null && (
                <span className={percent > 0 ? "item__trend item__trend--up" : "item__trend item__trend--down"}>
                  {percent > 0 ? "▲" : "▼"} {Math.abs(percent)}%
                  <span className="visually-hidden">{percent > 0 ? " mais caro que a compra anterior" : " mais barato que a compra anterior"}</span>
                </span>
              )}
            </span>
          )}
          {price?.cheaper && (
            <span className="item__ref item__ref--cheaper">
              Mais barato no {price.cheaper.store}: {formatMoney(price.cheaper.unitCents)}
            </span>
          )}
        </span>
      </button>
      {item.done ? (
        <span className="qty">{item.quantity}×</span>
      ) : (
        <span className="item__qty">
          <button
            type="button"
            className="item__step"
            aria-label={`Menos ${item.text}`}
            disabled={item.quantity <= 1}
            onClick={() => onQuantity(item, item.quantity - 1)}
          >
            <Icon name="minus" size={16} strokeWidth={2.8} />
          </button>
          <span className="qty">{item.quantity}×</span>
          <button
            type="button"
            className="item__step"
            aria-label={`Mais ${item.text}`}
            disabled={item.quantity >= MAX_QUANTITY}
            onClick={() => onQuantity(item, item.quantity + 1)}
          >
            <Icon name="plus" size={16} strokeWidth={2.8} />
          </button>
        </span>
      )}
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
