import { type FormEvent, useState } from "react";
import { MAX_LIST_NAME, MAX_TEMPLATES } from "../../shared/contract.ts";
import { DEFAULT_CATEGORY } from "../domain/categories";
import { MAX_QUANTITY, parseQuantity } from "../domain/items";
import { productKey } from "../domain/prices";
import { createTemplate, uniqueItems } from "../domain/templates";
import type { Item, Template, TemplateItem } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

interface TemplatesSheetProps {
  templates: Template[];
  /** Itens da lista agora, para salvar como modelo. */
  items: Item[];
  /** Categoria que um produto já teve, para itens novos do modelo. */
  categoryFor: (text: string) => string;
  onUse: (template: Template) => void;
  onSave: (template: Template) => void;
  onDelete: (template: Template) => void;
  onClose: () => void;
}

type Mode = { kind: "list" } | { kind: "edit"; template: Template; isNew: boolean };

/** Lista dos modelos: usar, editar, definir o padrão, criar a partir da lista atual. */
export function TemplatesSheet({ templates, items, categoryFor, onUse, onSave, onDelete, onClose }: TemplatesSheetProps) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const full = templates.length >= MAX_TEMPLATES;

  if (mode.kind === "edit") {
    return (
      <TemplateEditor
        template={mode.template}
        isNew={mode.isNew}
        categoryFor={categoryFor}
        onSave={(template) => {
          onSave(template);
          setMode({ kind: "list" });
        }}
        onDelete={() => {
          onDelete(mode.template);
          setMode({ kind: "list" });
        }}
        onBack={() => setMode({ kind: "list" })}
        onClose={onClose}
      />
    );
  }

  return (
    <BottomSheet title="Modelos de lista" onClose={onClose}>
      <p className="hint">
        Um modelo guarda os itens de uma compra que se repete. Ao usar, os itens entram na lista sem preço, e dá para
        mudar o que quiser antes de comprar.
      </p>

      {templates.length === 0 ? (
        <p className="hint">Nenhum modelo ainda.</p>
      ) : (
        <ul className="templates">
          {templates.map((template) => (
            <li key={template.id} className="template">
              <span className="template__main">
                <span className="template__name">
                  {template.name}
                  {template.isDefault && (
                    <span className="purchase__badge">
                      <Icon name="star" size={14} />
                      Padrão
                    </span>
                  )}
                </span>
                <span className="template__count">
                  {template.items.length === 1 ? "1 item" : `${template.items.length} itens`}
                </span>
              </span>
              <span className="template__actions">
                <button
                  type="button"
                  className="item__edit"
                  aria-label={`Editar o modelo ${template.name}`}
                  onClick={() => setMode({ kind: "edit", template, isNew: false })}
                >
                  <Icon name="edit" size={18} />
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  aria-label={`Usar o modelo ${template.name}`}
                  disabled={template.items.length === 0}
                  onClick={() => onUse(template)}
                >
                  Usar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {full && <p className="hint">Esta lista já tem {MAX_TEMPLATES} modelos. Exclua algum para criar outro.</p>}
      {items.length > 0 && (
        <button
          type="button"
          className="btn btn--secondary btn--block"
          disabled={full}
          onClick={() =>
            setMode({
              kind: "edit",
              template: createTemplate("", items, templates.length === 0),
              isNew: true,
            })
          }
        >
          <Icon name="sheet" size={20} />
          Salvar a lista atual como modelo
        </button>
      )}
      <button
        type="button"
        className="btn btn--link"
        disabled={full}
        onClick={() => setMode({ kind: "edit", template: createTemplate("", [], templates.length === 0), isNew: true })}
      >
        Criar modelo vazio
      </button>
    </BottomSheet>
  );
}

interface TemplateEditorProps {
  template: Template;
  isNew: boolean;
  categoryFor: (text: string) => string;
  onSave: (template: Template) => void;
  onDelete: () => void;
  onBack: () => void;
  onClose: () => void;
}

function TemplateEditor({ template, isNew, categoryFor, onSave, onDelete, onBack, onClose }: TemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [isDefault, setIsDefault] = useState(template.isDefault);
  const [items, setItems] = useState<TemplateItem[]>(template.items);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function addItem(event?: FormEvent) {
    event?.preventDefault();
    const value = newItem.trim();
    if (!value) return;
    const parsed = parseQuantity(value);
    const exists = items.some((item) => productKey(item.text) === productKey(parsed.text));
    if (exists) {
      setError(`${parsed.text} já está no modelo.`);
      return;
    }
    setItems([...items, { text: parsed.text, quantity: parsed.quantity, category: categoryFor(parsed.text) || DEFAULT_CATEGORY }]);
    setNewItem("");
    setError("");
  }

  function setQuantity(index: number, quantity: number) {
    setItems(items.map((item, position) => (position === index ? { ...item, quantity } : item)));
  }

  function save() {
    if (!name.trim()) {
      setError("Dê um nome para o modelo, por exemplo Compra do mês.");
      document.getElementById("nome-modelo")?.focus();
      return;
    }
    onSave({
      ...template,
      name: name.trim(),
      isDefault,
      items: uniqueItems(items),
      updatedAt: new Date().toISOString(),
    });
  }

  if (confirmingDelete) {
    return (
      <BottomSheet title="Excluir este modelo?" onClose={onClose}>
        <p className="hint">O modelo “{template.name}” some para todos da lista. A lista atual não muda.</p>
        <div className="sheet__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setConfirmingDelete(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={isNew ? "Novo modelo" : "Editar modelo"} onClose={onClose}>
      <div className="form">
        <label htmlFor="nome-modelo" className="field-label">
          Nome do modelo
        </label>
        <input
          id="nome-modelo"
          className="field"
          type="text"
          placeholder="Ex.: Compra do mês"
          maxLength={MAX_LIST_NAME}
          autoComplete="off"
          data-autofocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="choice">
          <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          <span>Usar como modelo padrão (aparece primeiro quando a lista está vazia)</span>
        </label>

        <span className="field-label">
          Itens · {items.length}
        </span>
        {items.length > 0 && (
          <ul className="template-items">
            {items.map((item, index) => (
              <li key={productKey(item.text)} className="template-item">
                <span className="template-item__text">{item.text}</span>
                <span className="template-item__qty">
                  <button
                    type="button"
                    className="stepper__btn stepper__btn--small"
                    aria-label={`Diminuir quantidade de ${item.text}`}
                    disabled={item.quantity <= 1}
                    onClick={() => setQuantity(index, item.quantity - 1)}
                  >
                    <Icon name="minus" size={18} strokeWidth={2.6} />
                  </button>
                  <output aria-label={`Quantidade de ${item.text}`}>{item.quantity}</output>
                  <button
                    type="button"
                    className="stepper__btn stepper__btn--small"
                    aria-label={`Aumentar quantidade de ${item.text}`}
                    disabled={item.quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity(index, item.quantity + 1)}
                  >
                    <Icon name="plus" size={18} strokeWidth={2.6} />
                  </button>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Tirar ${item.text} do modelo`}
                  onClick={() => setItems(items.filter((_item, position) => position !== index))}
                >
                  <Icon name="close" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="invite__row" onSubmit={addItem}>
          <label htmlFor="item-modelo" className="visually-hidden">
            Novo item do modelo
          </label>
          <input
            id="item-modelo"
            className="field"
            type="text"
            placeholder="Ex.: 2 leite"
            maxLength={80}
            autoComplete="off"
            enterKeyHint="done"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
          />
          <button type="submit" className="btn btn--secondary">
            Pôr
          </button>
        </form>

        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="btn btn--primary btn--block btn--xl" onClick={save}>
          Salvar modelo
        </button>
        <button type="button" className="btn btn--link" onClick={onBack}>
          Voltar aos modelos
        </button>
        {!isNew && (
          <button type="button" className="btn btn--danger-soft btn--block" onClick={() => setConfirmingDelete(true)}>
            <Icon name="trash" size={22} />
            Excluir modelo
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
