import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { preparePhoto, qrFromPhoto, scanVideo } from "../data/receiptImage";
import { readReceiptPhoto } from "../data/receiptsApi";
import { formatMoney } from "../domain/money";
import { buildReceipt, formatCnpj, formatQuantity, type NfceQr, parseNfceQr, relate } from "../domain/receipt";
import type { Purchase, PurchasedItem, Receipt } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";

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
  | { kind: "review"; receipt: Receipt; qr: NfceQr | null };

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function formatDay(iso: string | null): string {
  return iso ? dayFormat.format(new Date(`${iso}T12:00:00Z`)) : "";
}

function failureMessage(failure: unknown): string {
  if (failure instanceof RejectedOpError) return failure.message;
  if (failure instanceof TypeError) return "Sem internet. A leitura do cupom precisa de conexão.";
  return "Não consegui ler agora. Tente de novo em instantes.";
}

/** Câmera ao vivo procurando o QR code do cupom. */
function QrScanner({ onFound, onFail }: { onFound: (text: string) => void; onFail: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopScan: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        stopScan = scanVideo(video, (text) => onFoundRef.current(text));
      } catch {
        if (!cancelled) onFailRef.current();
      }
    })();
    return () => {
      cancelled = true;
      stopScan?.();
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" muted playsInline aria-label="Câmera" />
      <span className="scanner__frame" aria-hidden="true" />
    </div>
  );
}

/** Revisão: o que da lista veio no cupom, o que veio fora da lista e o que faltou. */
function Review({
  purchase,
  receipt,
  qr,
  onChange,
  onSave,
  onTakePhoto,
}: {
  purchase: Purchase;
  receipt: Receipt;
  qr: NfceQr | null;
  onChange: (receipt: Receipt) => void;
  onSave: (result: ReceiptResult) => void;
  onTakePhoto: () => void;
}) {
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
                {`É: ${listItem.quantity > 1 ? `${listItem.quantity}× ` : ""}${listItem.text}`}
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

      {receipt.items.length === 0 ? (
        <>
          <p className="banner banner--warning">
            O QR code traz a loja e a chave da nota, mas não os produtos. Para comparar com a lista, tire a foto do
            cupom.
          </p>
          <button type="button" className="btn btn--secondary btn--block" onClick={onTakePhoto}>
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
                    {item.quantity > 1 && `${item.quantity}× `}
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
    purchase.receipt ? { kind: "review", receipt: purchase.receipt, qr: null } : { kind: "choose" },
  );
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const qrPhotoRef = useRef<HTMLInputElement>(null);

  async function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStep({ kind: "reading", message: "Preparando a foto…" });
    try {
      const photo = await preparePhoto(file);
      setStep({ kind: "reading", message: "Lendo o cupom… leva uns 10 segundos." });
      const reading = await readReceiptPhoto(listId, photo.base64);
      const qr = photo.qrText ? parseNfceQr(photo.qrText) : null;
      setStep({ kind: "review", receipt: buildReceipt(purchase.items, reading, qr), qr });
    } catch (failure) {
      setStep({ kind: "choose", error: failureMessage(failure) });
    }
  }

  function applyQr(text: string) {
    const qr = parseNfceQr(text);
    if (!qr) {
      setStep({ kind: "choose", error: "Esse QR code não é de um cupom fiscal (NFC-e)." });
      return;
    }
    setStep({ kind: "review", receipt: buildReceipt(purchase.items, null, qr), qr });
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

  const hiddenInputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readPhoto(e)} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => void readPhoto(e)} />
      <input ref={qrPhotoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void readQrPhoto(e)} />
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
        <QrScanner
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
          onChange={(receipt) => setStep({ ...step, receipt })}
          onSave={onSave}
          onTakePhoto={() => cameraRef.current?.click()}
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
        desta compra. A foto não fica guardada.
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
        Escolher foto da galeria
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
