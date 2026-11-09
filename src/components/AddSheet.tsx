import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { barcodeFromPhoto } from "../data/receiptImage";
import { type KnownProduct, normalizeCode } from "../domain/barcodes";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { describeItem, parseQuantity } from "../domain/items";
import type { PricePoint } from "../domain/prices";
import { CategoryPicker } from "./CategoryPicker";
import { CodeScanner } from "./CodeScanner";
import { describeLast } from "./PriceHistory";

interface AddSheetProps {
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
  onCreateCategory: (name: string) => void;
  /**
   * Devolve como o item entrou, com a quantidade ("2× Peixe"). Com `code`, a lista aprende
   * o produto daquele código de barras; `category` troca a categoria escolhida no painel.
   */
  onAdd: (text: string, extra?: { code?: string; category?: string }) => string;
  /** O produto de um código de barras, se a lista já o conhece. */
  findProduct: (code: string) => KnownProduct | null;
  onOpenImport: () => void;
  onClose: () => void;
  /** Última compra do produto que está sendo digitado, como referência. */
  lastPrice: (text: string) => PricePoint | undefined;
}

/** Mostra como o texto vai entrar, para a pessoa ver que "peixe 2x" virou 2 peixes. */
function QuantityPreview({ text }: { text: string }) {
  if (text.trim().length < 2) return null;
  const parsed = parseQuantity(text);
  return (
    <p className="hint quantity-preview">
      Vai entrar como <strong>{describeItem(parsed)}</strong>
    </p>
  );
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
  findProduct,
}: AddSheetProps) {
  const [text, setText] = useState("");
  const [lastAdded, setLastAdded] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [scanning, setScanning] = useState(false);
  /** Código lido que a lista ainda não conhece: o nome digitado a seguir fica ligado a ele. */
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    setLastAdded(onAdd(value, pendingCode ? { code: pendingCode } : undefined));
    setPendingCode(null);
    setText("");
    inputRef.current?.focus();
  }

  function applyCode(raw: string) {
    setScanning(false);
    const code = normalizeCode(raw);
    if (!code) {
      setScanError("Esse código não parece de um produto. Tente o código de barras da embalagem.");
      return;
    }
    setScanError("");
    const product = findProduct(code);
    if (product) {
      setPendingCode(null);
      setLastAdded(onAdd(product.text, { code, category: product.category }));
      return;
    }
    setPendingCode(code);
    setLastAdded("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function readCodePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const code = await barcodeFromPhoto(file).catch(() => null);
    if (code) applyCode(code);
    else setScanError("Não achei o código de barras na foto. Chegue mais perto, com as barras nítidas e retas.");
  }

  function startScan() {
    setScanError("");
    if (typeof navigator.mediaDevices?.getUserMedia === "function") setScanning(true);
    else photoRef.current?.click();
  }

  function confirmCategory() {
    const value = newCategory.trim();
    if (value) onCreateCategory(value);
    setNewCategory("");
    setCreating(false);
  }

  if (scanning) {
    return (
      <BottomSheet title="Código de barras" onClose={onClose}>
        <p className="hint">Aponte a câmera para o código de barras da embalagem.</p>
        <CodeScanner
          kind="product"
          onFound={applyCode}
          onFail={() => {
            setScanning(false);
            setScanError("Não consegui abrir a câmera. Use \"Foto do código\" ou libere a câmera para o app.");
          }}
        />
        <div className="sheet__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setScanning(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => photoRef.current?.click()}>
            Foto do código
          </button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readCodePhoto(e)} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Novo item" onClose={onClose}>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readCodePhoto(e)} />
      <form className="form" onSubmit={submit}>
        <label htmlFor="novo-item" className="field-label">
          O que precisa comprar?
        </label>
        <input
          id="novo-item"
          ref={inputRef}
          className="field"
          type="text"
          placeholder="Ex.: peixe 2x ou 2 leite"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
          data-autofocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <QuantityPreview text={text} />
        {pendingCode && (
          <p className="banner banner--warning">
            Ainda não conheço o código {pendingCode}. Digite o nome do produto e toque em Adicionar: da próxima vez
            ele entra sozinho.{" "}
            <button type="button" className="btn btn--link btn--inline" onClick={() => setPendingCode(null)}>
              Esquecer o código
            </button>
          </p>
        )}
        {scanError && (
          <p className="banner banner--danger" role="alert">
            {scanError}
          </p>
        )}
        <button type="button" className="btn btn--secondary btn--block" onClick={startScan}>
          <Icon name="barcode" size={22} />
          Ler código de barras
        </button>
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
