import { type FormEvent, useId, useState } from "react";
import { RejectedOpError } from "../data/backend";
import type { ListSummary } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

interface ListsSheetProps {
  lists: ListSummary[];
  currentId: string;
  onPick: (listId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

/** Trocar de lista ou criar uma nova, como "Pousada". */
export function ListsSheet({ lists, currentId, onPick, onCreate, onClose }: ListsSheetProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const group = useId();

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome para a lista.");
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim());
    } catch (failure) {
      setError(failure instanceof RejectedOpError ? failure.message : "Não consegui criar. Confira a internet.");
      setBusy(false);
    }
  }

  return (
    <BottomSheet title="Suas listas" onClose={onClose}>
      <fieldset className="tiles tiles--stack">
        <legend className="visually-hidden">Escolha a lista</legend>
        {lists.map((list) => (
          <label key={list.id} className="tile tone-outros">
            <input
              type="radio"
              className="visually-hidden"
              name={group}
              checked={list.id === currentId}
              onChange={() => onPick(list.id)}
            />
            <Icon name="list" size={22} />
            <span className="tile__main">{list.name}</span>
            {list.role === "admin" && <span className="tile__note">você administra</span>}
          </label>
        ))}
      </fieldset>

      <form className="form" onSubmit={(event) => void create(event)}>
        <label htmlFor="nova-lista" className="field-label">
          Nova lista
        </label>
        <div className="invite__row">
          <input
            id="nova-lista"
            className="field"
            type="text"
            placeholder="Ex.: Pousada"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Criar
          </button>
        </div>
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}
