import type { Change } from "../domain/history";
import { formatMoney } from "../domain/money";
import { Icon } from "../ui/Icon";

/** "R$ 12,00 a mais (+8%)", com seta e palavra: a cor nunca é a única pista. */
export function ChangeText({ change, against }: { change: Change; against: string }) {
  if (change.diffCents === 0) {
    return (
      <span className="change change--same">
        <Icon name="minus" size={16} /> Igual {against}
      </span>
    );
  }
  const up = change.diffCents > 0;
  const percent = change.percent === null ? "" : ` (${up ? "+" : "−"}${Math.abs(change.percent)}%)`;
  return (
    <span className={up ? "change change--up" : "change change--down"}>
      <Icon name={up ? "arrow-up" : "arrow-down"} size={16} />
      {formatMoney(Math.abs(change.diffCents))} {up ? "a mais" : "a menos"} {against}
      {percent}
    </span>
  );
}
