import type { InvitePreview, ListInvite, ListMember, ListSummary, MonthTotal } from "../domain/types";
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

/** Código do link de convite da lista. */
export async function fetchInviteCode(listId: string): Promise<string> {
  return ((await (await api(`${base(listId)}/invite`)).json()) as ListInvite).code;
}

/** Gera um link novo; o antigo deixa de funcionar. Só quem administra. */
export async function resetInviteCode(listId: string): Promise<string> {
  return ((await (await api(`${base(listId)}/invite`, "POST")).json()) as ListInvite).code;
}

/** Nome da lista do convite, antes de entrar (não exige conta). */
export async function previewInvite(code: string): Promise<InvitePreview> {
  return (await api(`/invites/${encodeURIComponent(code)}`)).json() as Promise<InvitePreview>;
}

/** Entra na lista do convite; quem já participa só recebe a lista de volta. */
export async function joinInvite(code: string): Promise<ListSummary> {
  return (await api(`/invites/${encodeURIComponent(code)}/join`, "POST")).json() as Promise<ListSummary>;
}

export async function removeMember(listId: string, userId: string): Promise<void> {
  await api(`${base(listId)}/members/${encodeURIComponent(userId)}`, "DELETE");
}

/** Total por mês de todo o histórico da lista (o snapshot só traz as compras recentes). */
export async function fetchMonths(listId: string): Promise<MonthTotal[]> {
  return (await api(`${base(listId)}/months`)).json() as Promise<MonthTotal[]>;
}
