// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openTestDatabase } from "./sqliteAdapter.ts";

/** Roda de novo uma migração sobre dados já existentes, como acontece no D1. */
async function rerun(db: ReturnType<typeof openTestDatabase>, file: string) {
  const sql = readFileSync(join(import.meta.dirname, "migrations", file), "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n");
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(statement).run();
  }
}

describe("0013: quantidade no fim do nome", () => {
  it("tira o número do nome e passa para a quantidade", async () => {
    const db = openTestDatabase();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO families (id, name, invite_hash, created_at) VALUES ('f', 'F', 'h', ?)").bind(now),
      db.prepare("INSERT INTO lists (id, family_id, name, created_at) VALUES ('l', 'f', 'Casa', ?)").bind(now),
    ]);
    const rows: [string, number][] = [
      ["Peixe 1", 1],
      ["Café 2", 1],
      ["Ovos - 12", 1],
      ["Água 100", 1],
      ["Leite 3", 4],
      ["Molho 3 queijos", 1],
      ["Coca-Cola 2L", 1],
      ["Peixe 0", 1],
      ["Kit 3x1", 1],
      ["7 8", 1],
      ["Arroz", 2],
    ];
    for (const [index, [text, quantity]] of rows.entries()) {
      await db
        .prepare("INSERT INTO items (list_id, id, text, quantity, category, created_at) VALUES ('l', ?, ?, ?, 'Outros', ?)")
        .bind(`i${index}`, text, quantity, now)
        .run();
    }

    await rerun(db, "0013_quantidade_no_fim_do_nome.sql");

    const { results } = await db
      .prepare("SELECT text, quantity FROM items ORDER BY CAST(substr(id, 2) AS INTEGER)")
      .all<{ text: string; quantity: number }>();
    expect(results.map((row) => [row.text, row.quantity])).toEqual([
      ["Peixe", 1],
      ["Café", 2],
      ["Ovos", 12],
      ["Água", 100],
      ["Leite", 4],
      ["Molho 3 queijos", 1],
      ["Coca-Cola 2L", 1],
      ["Peixe 0", 1],
      ["Kit 3x1", 1],
      ["7 8", 1],
      ["Arroz", 2],
    ]);
  });
});
