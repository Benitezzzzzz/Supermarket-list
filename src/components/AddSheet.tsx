import { type FormEvent, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { parseQuantity } from "../domain/items";
import type { PricePoint } from "../domain/prices";
import { CategoryPicker } from "./CategoryPicker";
import { describeLast } from "./PriceHistory";

interface AddSheetProps {
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
  onCreateCategory: (name: string) => void;
  /** Devolve o nome com que o item entrou, já sem a quantidade. */
  onAdd: (text: string) => string;
  onOpenImport: () => void;
  onClose: () => void;
  /** Última compra do produto que está sendo digitado, como referência. */
  lastPrice: (text: string) => PricePoint | undefined;
}

function TypedReference({ text, lastPrice }: { text: string; lastPrice: AddSheetProps["lastPrice"] }) {
  const name = parseQuantity(text.trim()).text;
  const last = name.length >= 3 ? lastPrice(name) : undefined;
  if (!last) return null;
  return <p className="hint price-ref">Última compra de {last.text}: {describeLast(last)}</p>;
}

/** Fica aberto depois de adicionar: quem monta a lista costuma colocar vários itens seguidos. */
export function AddSheet({
  categories,
  category,
  onCategoryChange,
  onCreateCategory,
  onAdd,
  onOpenImport,
  onClose,
  lastPrice,
}: AddSheetProps) {
  const [text, setText] = useState("");
  const [lastAdded, setLastAdded] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    setLastAdded(onAdd(value));
    setText("");
    inputRef.current?.focus();
  }

  function confirmCategory() {
    const value = newCategory.trim();
    if (value) onCreateCategory(value);
    setNewCategory("");
    setCreating(false);
  }

  return (
    <BottomSheet title="Novo item" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label htmlFor="novo-item" className="field-label">
          O que precisa comprar?
        </label>
        <input
          id="novo-item"
          ref={inputRef}
          className="field"
          type="text"
          placeholder="Ex.: 2 leite"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
          data-autofocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <TypedReference text={text} lastPrice={lastPrice} />
        <div aria-live="polite">
          {lastAdded && <p className="notice">{lastAdded} entrou na lista.</p>}
        </div>

        <span className="field-label">Categoria</span>
        <CategoryPicker
          label="Categoria do novo item"
          categories={categories}
          value={category}
          onChange={onCategoryChange}
        />
        <button
          type="button"
          className="tile tile--new"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          <Icon name="plus" size={20} />
          <span>Nova categoria</span>
        </button>

        {creating && (
          <div className="invite__row">
            <label htmlFor="nova-categoria" className="visually-hidden">
              Nome da nova categoria
            </label>
            <input
              id="nova-categoria"
              className="field"
              type="text"
              placeholder="Nome da categoria"
              maxLength={40}
              autoComplete="off"
              autoFocus
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmCategory();
                }
              }}
            />
            <button type="button" className="btn btn--secondary" onClick={confirmCategory}>
              Criar
            </button>
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--block btn--xl">
          Adicionar à lista
        </button>
        <button type="button" className="btn btn--link" onClick={onOpenImport}>
          Colar vários itens de uma vez
        </button>
      </form>
    </BottomSheet>
  );
}
