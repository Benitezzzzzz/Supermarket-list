import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { preparePhoto, qrFromPhoto } from "../data/receiptImage";
import { readReceiptPhoto } from "../data/receiptsApi";
import { formatMoney } from "../domain/money";
import {
  buildReceipt,
  formatCnpj,
  formatQuantity,
  MAX_RECEIPT_PHOTOS,
  mergeReadings,
  type NfceQr,
  parseNfceQr,
  readingFromReceipt,
  relate,
} from "../domain/receipt";
import type { Purchase, PurchasedItem, Receipt, ReceiptReading } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { CodeScanner } from "./CodeScanner";

export interface ReceiptResult {
  receipt: Receipt;
  /** Usar o total do cupom como valor da compra. */
  amountCents: number | null;
  /** Itens que faltaram e devem voltar para a lista. */
  returnItems: PurchasedItem[];
}

interface ReceiptSheetProps {
  listId: string;
  purchase: Purchase;
  onSave: (result: ReceiptResult) => void;
  onRemove: () => void;
  onClose: () => void;
}

type Step =
  | { kind: "choose"; error?: string }
  | { kind: "reading"; message: string }
  | { kind: "scan" }
  | { kind: "review"; receipt: Receipt; qr: NfceQr | null; photos: number; error?: string };

/** O que já foi lido, quando a pessoa acrescenta mais uma parte do cupom. */
type ReviewState = Extract<Step, { kind: "review" }>;

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function formatDay(iso: string | null): string {
  return iso ? dayFormat.format(new Date(`${iso}T12:00:00Z`)) : "";
}

function failureMessage(failure: unknown): string {
  if (failure instanceof RejectedOpError) return failure.message;
  if (failure instanceof TypeError) return "Sem internet. A leitura do cupom precisa de conexão.";
  return "Não consegui ler agora. Tente de novo em instantes.";
}

/** Revisão: o que da lista veio no cupom, o que veio fora da lista e o que faltou. */
function Review({
  purchase,
  receipt,
  qr,
  photos,
  error,
  onChange,
  onSave,
  onAddPhoto,
  onAddFromGallery,
}: {
  purchase: Purchase;
  receipt: Receipt;
  qr: NfceQr | null;
  photos: number;
  error?: string;
  onChange: (receipt: Receipt) => void;
  onSave: (result: ReceiptResult) => void;
  onAddPhoto: () => void;
  onAddFromGallery: () => void;
}) {
  const canAddPhoto = photos < MAX_RECEIPT_PHOTOS;
  const relations = relate(purchase.items, receipt);
  const [useTotal, setUseTotal] = useState(true);
  const [returning, setReturning] = useState<Set<number>>(new Set());
  const differentTotal = receipt.totalCents !== null && receipt.totalCents !== purchase.amountCents;
  const sefazUrl = qr?.sefazUrl ?? (receipt.accessKey ? parseNfceQr(receipt.accessKey)?.sefazUrl : "");

  // Trocar a ligação muda a linha de grupo (e de lugar na tela); o foco vai junto.
  const selects = useRef(new Map<number, HTMLSelectElement>());
  const focusLine = useRef<number | null>(null);
  useEffect(() => {
    if (focusLine.current === null) return;
    selects.current.get(focusLine.current)?.focus();
    focusLine.current = null;
  });

  function link(line: number, value: string) {
    const listIndex = value === "" ? null : Number(value);
    focusLine.current = line;
    onChange({ ...receipt, items: receipt.items.map((item, index) => (index === line ? { ...item, listIndex } : item)) });
  }

  function toggleReturn(index: number) {
    setReturning((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function save() {
    onSave({
      receipt,
      amountCents: differentTotal && useTotal ? receipt.totalCents : null,
      returnItems: relations.missing.filter(({ index }) => returning.has(index)).map(({ item }) => item),
    });
  }

  const lineRow = (line: number) => {
    const item = receipt.items[line];
    return (
      <li key={line} className="receipt-line">
        <div className="receipt-line__top">
          <span className="receipt-line__name">{item.description}</span>
          <span className="receipt-line__price">{formatMoney(item.totalCents)}</span>
        </div>
        <span className="receipt-line__meta">
          {formatQuantity(item)} × {formatMoney(item.unitCents)}
          {item.code && ` · ${item.code}`}
        </span>
        {purchase.items.length > 0 && (
          <select
            ref={(element) => {
              if (element) selects.current.set(line, element);
              else selects.current.delete(line);
            }}
            className="field receipt-line__link"
            aria-label={`Item da lista para ${item.description}`}
            value={item.listIndex ?? ""}
            onChange={(event) => link(line, event.target.value)}
          >
            <option value="">Fora da lista</option>
            {purchase.items.map((listItem, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a lista da compra é fixa.
              <option key={index} value={index}>
                {`É: ${listItem.quantity}× ${listItem.text}`}
              </option>
            ))}
          </select>
        )}
      </li>
    );
  };

  const linkedLines = receipt.items
    .map((item, line) => ({ item, line }))
    .filter(({ item }) => item.listIndex !== null && item.listIndex < purchase.items.length)
    .sort((a, b) => (a.item.listIndex ?? 0) - (b.item.listIndex ?? 0) || a.line - b.line);
  const extraLines = receipt.items.map((item, line) => ({ item, line })).filter(({ item }) => !linkedLines.some((l) => l.item === item));

  return (
    <div className="form">
      <div className="summary">
        <span className="summary__method">{receipt.storeName || "Loja"}</span>
        {receipt.totalCents !== null && <span className="summary__amount">{formatMoney(receipt.totalCents)}</span>}
        <span className="hint">
          {[receipt.cnpj && `CNPJ ${formatCnpj(receipt.cnpj)}`, formatDay(receipt.issuedOn)].filter(Boolean).join(" · ")}
        </span>
      </div>

      {error && (
        <p className="banner banner--danger" role="alert">
          {error}
        </p>
      )}

      {receipt.items.length === 0 ? (
        <>
          <p className="banner banner--warning">
            O QR code traz a loja e a chave da nota, mas não os produtos. Para comparar com a lista, tire a foto do
            cupom.
          </p>
          <button type="button" className="btn btn--secondary btn--block" onClick={onAddPhoto}>
            <Icon name="camera" size={22} />
            Tirar foto do cupom
          </button>
        </>
      ) : (
        <>
          <section aria-label="Da lista">
            <h3 className="receipt-group">Da lista · {relations.matched.length}</h3>
            {linkedLines.length === 0 ? (
              <p className="hint">Nenhum produto do cupom foi ligado à lista. Use "É:" nos produtos abaixo.</p>
            ) : (
              <ul className="receipt-lines">{linkedLines.map(({ line }) => lineRow(line))}</ul>
            )}
          </section>
          {extraLines.length > 0 && (
            <section aria-label="Fora da lista">
              <h3 className="receipt-group">Fora da lista · {extraLines.length}</h3>
              <ul className="receipt-lines">{extraLines.map(({ line }) => lineRow(line))}</ul>
            </section>
          )}
        </>
      )}

      {receipt.items.length > 0 && (
        <section className="receipt-more" aria-label="Mais partes do cupom">
          <p className="hint">
            {photos > 1 ? `Lido de ${photos} fotos. ` : ""}
            {canAddPhoto
              ? "Cupom grande? Fotografe a continuação: os produtos repetidos entre as fotos entram uma vez só."
              : `Este cupom já tem ${MAX_RECEIPT_PHOTOS} fotos, o máximo.`}
          </p>
          {canAddPhoto && (
            <div className="sheet__actions">
              <button type="button" className="btn btn--secondary" onClick={onAddPhoto}>
                <Icon name="camera" size={20} />
                Foto da continuação
              </button>
              <button type="button" className="btn btn--secondary" onClick={onAddFromGallery}>
                <Icon name="image" size={20} />
                Da galeria
              </button>
            </div>
          )}
        </section>
      )}

      {receipt.items.length > 0 && relations.missing.length > 0 && (
        <section aria-label="Faltou comprar">
          <h3 className="receipt-group">Faltou comprar · {relations.missing.length}</h3>
          <p className="hint">Marque o que deve voltar para a lista.</p>
          <ul className="receipt-lines">
            {relations.missing.map(({ index, item }) => (
              <li key={index}>
                <label className="choice">
                  <input type="checkbox" checked={returning.has(index)} onChange={() => toggleReturn(index)} />
                  <span>
                    {`${item.quantity}× `}
                    {item.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {differentTotal && receipt.totalCents !== null && (
        <label className="choice">
          <input type="checkbox" checked={useTotal} onChange={(event) => setUseTotal(event.target.checked)} />
          <span>
            Usar o total do cupom ({formatMoney(receipt.totalCents)}) no lugar de {formatMoney(purchase.amountCents)}
          </span>
        </label>
      )}

      {sefazUrl && (
        <a className="btn btn--link" href={sefazUrl} target="_blank" rel="noreferrer">
          Conferir a nota no site da Sefaz
        </a>
      )}

      <button type="button" className="btn btn--primary btn--block btn--xl" onClick={save}>
        Salvar cupom
      </button>
    </div>
  );
}

/** Ler o cupom fiscal de uma compra (foto ou QR code) e ligar à lista. */
export function ReceiptSheet({ listId, purchase, onSave, onRemove, onClose }: ReceiptSheetProps) {
  const [step, setStep] = useState<Step>(() =>
    purchase.receipt
      ? { kind: "review", receipt: purchase.receipt, qr: null, photos: purchase.receipt.items.length > 0 ? 1 : 0 }
      : { kind: "choose" },
  );
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const qrPhotoRef = useRef<HTMLInputElement>(null);
  const moreCameraRef = useRef<HTMLInputElement>(null);
  const moreGalleryRef = useRef<HTMLInputElement>(null);

  /**
   * Lê uma ou mais fotos, uma de cada vez, e junta com o que já estava lido. Uma foto que
   * falha não perde as outras: o que deu certo vai para a revisão, com o aviso do erro.
   */
  async function readPhotos(event: ChangeEvent<HTMLInputElement>, base: ReviewState | null) {
    const room = MAX_RECEIPT_PHOTOS - (base?.photos ?? 0);
    const files = [...(event.target.files ?? [])].slice(0, room);
    event.target.value = "";
    if (files.length === 0) return;
    const readings: ReceiptReading[] = base ? [readingFromReceipt(base.receipt)] : [];
    let qrText: string | null = null;
    let read = 0;
    let error: string | undefined;
    for (const [index, file] of files.entries()) {
      const part = files.length > 1 ? `a foto ${index + 1} de ${files.length}` : base ? "a continuação" : "o cupom";
      setStep({ kind: "reading", message: `Lendo ${part}… leva uns 10 segundos.` });
      try {
        const photo = await preparePhoto(file);
        readings.push(await readReceiptPhoto(listId, photo.base64));
        qrText ??= photo.qrText;
        read += 1;
      } catch (failure) {
        error = failureMessage(failure);
        break;
      }
    }
    if (read === 0) {
      setStep(base ? { ...base, error } : { kind: "choose", error });
      return;
    }
    const qr = base?.qr ?? (qrText ? parseNfceQr(qrText) : null);
    const receipt = buildReceipt(purchase.items, mergeReadings(readings), qr);
    if (base) {
      // As linhas que já estavam lidas mantêm as ligações que a pessoa acertou.
      base.receipt.items.forEach((line, index) => {
        if (receipt.items[index]) receipt.items[index] = { ...receipt.items[index], listIndex: line.listIndex };
      });
      receipt.accessKey = base.receipt.accessKey ?? receipt.accessKey;
    }
    setStep({ kind: "review", receipt, qr, photos: (base?.photos ?? 0) + read, error });
  }

  function applyQr(text: string) {
    const qr = parseNfceQr(text);
    if (!qr) {
      setStep({ kind: "choose", error: "Esse QR code não é de um cupom fiscal (NFC-e)." });
      return;
    }
    setStep({ kind: "review", receipt: buildReceipt(purchase.items, null, qr), qr, photos: 0 });
  }

  async function readQrPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStep({ kind: "reading", message: "Procurando o QR code…" });
    const text = await qrFromPhoto(file).catch(() => null);
    if (text) applyQr(text);
    else setStep({ kind: "choose", error: "Não achei o QR code na foto. Chegue mais perto, com o QR bem nítido." });
  }

  /** Mais uma parte entra no cupom que está em revisão agora. */
  const reviewing = step.kind === "review" ? step : null;

  const hiddenInputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readPhotos(e, null)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => void readPhotos(e, null)} />
      <input ref={qrPhotoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readQrPhoto(e)} />
      <input
        ref={moreCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-parte="camera"
        onChange={(e) => void readPhotos(e, reviewing)}
      />
      <input
        ref={moreGalleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-parte="galeria"
        onChange={(e) => void readPhotos(e, reviewing)}
      />
    </>
  );

  if (step.kind === "reading") {
    return (
      <BottomSheet title="Cupom fiscal" onClose={onClose}>
        <div className="reading" role="status">
          <span className="reading__spinner" aria-hidden="true" />
          <p className="hint">{step.message}</p>
        </div>
      </BottomSheet>
    );
  }

  if (step.kind === "scan") {
    return (
      <BottomSheet title="Ler QR code" onClose={onClose}>
        <p className="hint">Aponte a câmera para o QR code no fim do cupom.</p>
        <CodeScanner
          kind="qr"
          onFound={applyQr}
          onFail={() =>
            setStep({
              kind: "choose",
              error: "Não consegui abrir a câmera. Use \"Foto do QR code\" ou libere a câmera para o app.",
            })
          }
        />
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setStep({ kind: "choose" })}>
          Cancelar
        </button>
      </BottomSheet>
    );
  }

  if (step.kind === "review") {
    return (
      <BottomSheet title="Cupom fiscal" onClose={onClose}>
        {hiddenInputs}
        <Review
          purchase={purchase}
          receipt={step.receipt}
          qr={step.qr}
          photos={step.photos}
          error={step.error}
          onChange={(receipt) => setStep({ ...step, receipt })}
          onSave={onSave}
          onAddPhoto={() => moreCameraRef.current?.click()}
          onAddFromGallery={() => moreGalleryRef.current?.click()}
        />
        {purchase.receipt && (
          <div className="sheet__actions">
            <button type="button" className="btn btn--secondary" onClick={() => setStep({ kind: "choose" })}>
              Ler de novo
            </button>
            <button type="button" className="btn btn--danger-soft" onClick={onRemove}>
              Remover cupom
            </button>
          </div>
        )}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Cupom fiscal" onClose={onClose}>
      {hiddenInputs}
      <p className="hint">
        Tire uma foto do cupom inteiro, reto e com boa luz. O app lê os produtos e os preços e compara com a lista
        desta compra. Cupom grande pode ir em várias fotos: depois da primeira, é só fotografar a continuação. As fotos
        não ficam guardadas.
      </p>
      {step.error && (
        <p className="banner banner--danger" role="alert">
          {step.error}
        </p>
      )}
      <button type="button" className="btn btn--primary btn--block btn--xl" onClick={() => cameraRef.current?.click()}>
        <Icon name="camera" size={24} />
        Tirar foto do cupom
      </button>
      <button type="button" className="btn btn--secondary btn--block" onClick={() => galleryRef.current?.click()}>
        <Icon name="image" size={22} />
        Escolher fotos da galeria
      </button>
      <h3 className="field-label">Ou só o QR code</h3>
      <p className="hint">Registra a loja e a chave da nota, sem os produtos.</p>
      <div className="sheet__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() =>
            setStep(
              typeof navigator.mediaDevices?.getUserMedia === "function"
                ? { kind: "scan" }
                : { kind: "choose", error: "Aqui a câmera ao vivo não abre. Use \"Foto do QR code\"." },
            )
          }
        >
          <Icon name="qr" size={22} />
          Ler QR code
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => qrPhotoRef.current?.click()}>
          Foto do QR code
        </button>
      </div>
    </BottomSheet>
  );
}
