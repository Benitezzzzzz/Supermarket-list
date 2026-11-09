import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { describePayment, formatMoney } from "../domain/money";
import { formatCnpj } from "../domain/receipt";
import type { Purchase } from "../domain/types";
import { PurchaseDetails } from "./PurchaseDetails";
import { purchaseStore } from "../domain/storeName";

interface PurchaseReportProps {
  purchase: Purchase;
  listName: string;
  /** Chamado quando a janela de impressão fecha. */
  onDone: () => void;
}

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

/** "2026-11-04" vira "04/11/2026". */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Nome do arquivo que o "Salvar como PDF" sugere: vem do título da página. */
export function reportFileName(purchase: Purchase, listName: string): string {
  const date = new Date(purchase.createdAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `Compra ${listName} ${day}`;
}

/**
 * Relatório de uma compra para imprimir ou salvar em PDF pelo próprio navegador.
 * Fica escondido na tela; na impressão, é a única coisa que aparece.
 */
export function PurchaseReport({ purchase, listName, onDone }: PurchaseReportProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const fileName = reportFileName(purchase, listName);

  // Abre a impressão uma vez por relatório; mudanças da compra durante a impressão não a reabrem.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = fileName;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      document.title = previousTitle;
      onDoneRef.current();
    };
    window.addEventListener("afterprint", done);
    // Espera o relatório ser desenhado antes de abrir a impressão.
    const frame = requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        done();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
      document.title = previousTitle;
    };
  }, [fileName]);

  const receipt = purchase.receipt;
  const rows: [string, string][] = [
    ["Valor", formatMoney(purchase.amountCents)],
    ["Pagamento", describePayment(purchase)],
    ["Finalizada em", longDate.format(new Date(purchase.createdAt))],
  ];
  if (purchase.memberName) rows.push(["Por", purchase.memberName]);
  if (purchaseStore(purchase)) rows.push(["Mercado", purchaseStore(purchase)]);
  if (receipt?.storeName && receipt.storeName !== purchaseStore(purchase)) rows.push(["Loja no cupom", receipt.storeName]);
  if (receipt?.cnpj) rows.push(["CNPJ", formatCnpj(receipt.cnpj)]);
  if (receipt?.issuedOn) rows.push(["Data do cupom", formatDay(receipt.issuedOn)]);
  if (receipt?.totalCents != null) rows.push(["Total do cupom", formatMoney(receipt.totalCents)]);
  if (receipt?.accessKey) rows.push(["Chave de acesso", receipt.accessKey.replace(/(\d{4})(?=\d)/g, "$1 ")]);

  return createPortal(
    <article className="print-report" aria-hidden="true">
      <header>
        <p className="print-report__app">Lista do Mercado · {listName}</p>
        <h1>Compra de {shortDate.format(new Date(purchase.createdAt))}</h1>
      </header>
      <dl className="print-report__facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h2>{purchase.itemCount === 1 ? "1 item" : `${purchase.itemCount} itens`}</h2>
        <PurchaseDetails purchase={purchase} />
      </section>
      <footer>Gerado em {longDate.format(new Date())}</footer>
    </article>,
    document.body,
  );
}
