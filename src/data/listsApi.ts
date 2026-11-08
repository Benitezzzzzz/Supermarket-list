import type { ListMember, ListSummary, MonthTotal } from "../domain/types";
import { api } from "./http";

const base = (listId: string) => `/lists/${encodeURIComponent(listId)}`;

export async function createList(name: string): Promise<ListSummary> {
  return (await api("/lists", "POST", { name })).json() as Promise<ListSummary>;
}

export async function renameList(listId: string, name: string): Promise<void> {
  await api(base(listId), "PATCH", { name });
}

export async function deleteList(listId: string): Promise<void> {
  await api(base(listId), "DELETE");
}

export async function leaveList(listId: string): Promise<void> {
  await api(`${base(listId)}/leave`, "POST");
}

export async function fetchMembers(listId: string): Promise<ListMember[]> {
  return (await api(`${base(listId)}/members`)).json() as Promise<ListMember[]>;
}

export async function addMember(listId: string, username: string): Promise<ListMember> {
  return (await api(`${base(listId)}/members`, "POST", { username })).json() as Promise<ListMember>;
}

export async function removeMember(listId: string, userId: string): Promise<void> {
  await api(`${base(listId)}/members/${encodeURIComponent(userId)}`, "DELETE");
}

/** Total por mês de todo o histórico da lista (o snapshot só traz as compras recentes). */
export async function fetchMonths(listId: string): Promise<MonthTotal[]> {
  return (await api(`${base(listId)}/months`)).json() as Promise<MonthTotal[]>;
}
