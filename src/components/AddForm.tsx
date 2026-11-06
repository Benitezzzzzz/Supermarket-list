import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CategoryOptions } from "./CategoryOptions";

interface AddFormProps {
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
  onCreateCategory: (name: string) => void;
  onAdd: (text: string) => void;
}

export function AddForm({
  categories,
  category,
  onCategoryChange,
  onCreateCategory,
  onAdd,
}: AddFormProps) {
  const [text, setText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText("");
    inputRef.current?.focus();
  }

  function confirmCategory() {
    const value = newCategory.trim();
    setNewCategory("");
    setCreatingCategory(false);
    if (value) onCreateCategory(value);
    inputRef.current?.focus();
  }

  function onNewCategoryKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmCategory();
    }
  }

  return (
    <form id="addForm" onSubmit={submit}>
      <div className="add-row1">
        <div className="cat-picker">
          <select
            className="cat-select"
            aria-label="Categoria do item"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <CategoryOptions categories={categories} />
          </select>
          <button
            type="button"
            className="cat-plus"
            aria-label="Criar nova categoria"
            onClick={() => setCreatingCategory(!creatingCategory)}
          >
            +
          </button>
        </div>
        <input
          id="newItem"
          ref={inputRef}
          type="text"
          placeholder="O que precisa comprar?"
          aria-label="O que precisa comprar?"
          autoComplete="off"
          maxLength={80}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit">Adicionar</button>
      </div>
      {creatingCategory && (
        <div className="new-cat-row">
          <input
            type="text"
            placeholder="Nome da nova categoria"
            aria-label="Nome da nova categoria"
            maxLength={40}
            autoComplete="off"
            autoFocus
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={onNewCategoryKeyDown}
          />
          <button type="button" onClick={confirmCategory}>
            Criar
          </button>
        </div>
      )}
    </form>
  );
}
