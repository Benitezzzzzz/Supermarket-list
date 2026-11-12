import { type FormEvent, useId, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { MAX_LIST_NAME } from "../../shared/contract.ts";
import type { ListSummary } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

interface ListsSheetProps {
  lists: ListSummary[];
  currentId: string;
  onPick: (listId: string) => void;
  onCreate: (name: string) => Promise<void>;
  /** Só quem administra a lista pode mudar o nome; o servidor confere. */
  onRename: (listId: string, name: string) => Promise<void>;
  /** Só quem administra pode excluir; apaga a lista para todos. */
  onDelete: (listId: string) => Promise<void>;
  onClose: () => void;
}

/** Trocar de lista, mudar o nome ou excluir uma lista, ou criar uma nova, como "Pousada". */
export function ListsSheet({ lists, currentId, onPick, onCreate, onRename, onDelete, onClose }: ListsSheetProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renamed, setRenamed] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const group = useId();

  function startEditing(list: ListSummary) {
    setEditingId(list.id);
    setEditName(list.name);
    setRenameError("");
    setRenamed("");
    setConfirmingDelete(false);
  }

  async function remove(list: ListSummary) {
    setRenaming(true);
    try {
      await onDelete(list.id);
      setEditingId(null);
      setConfirmingDelete(false);
      setRenameError("");
      setRenamed(`A lista ${list.name} foi excluída.`);
    } catch (failure) {
      setConfirmingDelete(false);
      setRenameError(failure instanceof RejectedOpError ? failure.message : "Não consegui excluir. Confira a internet.");
    } finally {
      setRenaming(false);
    }
  }

  async function rename(event: FormEvent, list: ListSummary) {
    event.preventDefault();
    const value = editName.trim();
    if (!value) {
      setRenameError("Dê um nome para a lista.");
      return;
    }
    if (value === list.name) {
      setEditingId(null);
      return;
    }
    setRenaming(true);
    try {
      await onRename(list.id, value);
      setEditingId(null);
      setRenameError("");
      setRenamed(`A lista agora se chama ${value}.`);
    } catch (failure) {
      setRenameError(failure instanceof RejectedOpError ? failure.message : "Não consegui mudar o nome. Confira a internet.");
    } finally {
      setRenaming(false);
    }
  }

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
        {lists.map((list) =>
          editingId === list.id ? (
            <form key={list.id} className="list-rename" onSubmit={(event) => void rename(event, list)}>
              <label htmlFor="nome-lista" className="field-label">
                Nome da lista
              </label>
              <input
                id="nome-lista"
                className="field"
                type="text"
                maxLength={MAX_LIST_NAME}
                autoComplete="off"
                enterKeyHint="done"
                autoFocus
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setEditingId(null);
                  }
                }}
              />
              {renameError && (
                <p className="banner banner--danger" role="alert">
                  {renameError}
                </p>
              )}
              {confirmingDelete ? (
                <div className="list-rename__confirm">
                  <p className="hint">
                    Excluir a lista {list.name}? Itens, gastos e participantes desta lista são apagados para todos. Não
                    dá para desfazer.
                  </p>
                  <div className="sheet__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => setConfirmingDelete(false)}>
                      Não excluir
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={renaming}
                      autoFocus
                      onClick={() => void remove(list)}
                    >
                      Excluir lista
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sheet__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={renaming}>
                      Salvar nome
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger-soft btn--block"
                    onClick={() => {
                      setRenameError("");
                      setConfirmingDelete(true);
                    }}
                  >
                    Excluir a lista {list.name}
                  </button>
                </>
              )}
            </form>
          ) : (
            <div key={list.id} className="list-row">
              <label className="tile tone-outros">
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
              {list.role === "admin" && (
                <button
                  type="button"
                  className="icon-btn icon-btn--neutral"
                  aria-label={`Mudar o nome da lista ${list.name}`}
                  title="Mudar o nome"
                  onClick={() => startEditing(list)}
                >
                  <Icon name="edit" size={20} />
                </button>
              )}
            </div>
          ),
        )}
      </fieldset>
      <div aria-live="polite">{renamed && <p className="notice">{renamed}</p>}</div>

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
