import type { FamilySettings, Member } from "../../shared/contract.ts";
import { api } from "./http";

export async function fetchMembers(): Promise<Member[]> {
  return (await api("/family/members")).json() as Promise<Member[]>;
}

export async function removeMember(id: string): Promise<void> {
  await api(`/family/members/${id}`, "DELETE");
}

export async function fetchSettings(): Promise<FamilySettings> {
  return (await api("/family")).json() as Promise<FamilySettings>;
}

/** Abre ou fecha a entrada de pessoas novas pelo endereço do app. */
export async function setEntryOpen(open: boolean): Promise<FamilySettings> {
  return (await api("/family/entry", "PUT", { open })).json() as Promise<FamilySettings>;
}
