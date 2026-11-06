import { type MouseEvent, useState } from "react";
import { MAX_QUANTITY } from "../domain/items";
import type { Item } from "../domain/types";
import { CategoryOptions } from "./CategoryOptions";

type ItemChanges = Partial<Pick<Item, "done" | "category" | "quantity">>;

interface ItemRowProps {
  item: Item;
  categories: string[];
  onUpdate: (id: string, changes: ItemChanges) => void;
  onDelete: (id: string) => void;
}

export function ItemRow({ item, categories, onUpdate, onDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false);

  // A linha inteira marca o item; estes controles não podem acionar esse clique.
  const stop = (action?: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    action?.();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: o botão .check é o acesso por teclado; a linha só amplia a área de toque.
    <li
      className={item.done ? "row done" : "row"}
      onClick={() => onUpdate(item.id, { done: !item.done })}
    >
      <button
        type="button"
        className="check"
        aria-pressed={item.done}
        aria-label={`Marcar ${item.text}`}
      >
        <svg
          className="tick"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
      {item.quantity > 1 && <span className="qty">{item.quantity}×</span>}
      <span className="text">{item.text}</span>
      <button
        type="button"
        className="cat-edit"
        aria-label={`Editar ${item.text}`}
        aria-expanded={editing}
        onClick={stop(() => setEditing(!editing))}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        className="del"
        aria-label={`Remover ${item.text}`}
        onClick={stop(() => onDelete(item.id))}
      >
        &times;
      </button>
      {editing && (
        // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: só impede que o clique chegue à linha.
        <div className="cat-editor" onClick={stop()}>
          <div className="stepper">
            <button
              type="button"
              aria-label={`Diminuir quantidade de ${item.text}`}
              disabled={item.quantity <= 1}
              onClick={() => onUpdate(item.id, { quantity: item.quantity - 1 })}
            >
              −
            </button>
            <output aria-label={`Quantidade de ${item.text}`}>{item.quantity}</output>
            <button
              type="button"
              aria-label={`Aumentar quantidade de ${item.text}`}
              disabled={item.quantity >= MAX_QUANTITY}
              onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 })}
            >
              +
            </button>
          </div>
          <select
            aria-label={`Categoria de ${item.text}`}
            value={item.category}
            onChange={(event) => {
              setEditing(false);
              onUpdate(item.id, { category: event.target.value });
            }}
          >
            <CategoryOptions categories={categories} />
          </select>
        </div>
      )}
    </li>
  );
}
