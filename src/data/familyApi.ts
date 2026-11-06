import type { Member } from "../domain/types";
import { api } from "./http";

export async function fetchMembers(): Promise<Member[]> {
  return (await api("/family/members")).json() as Promise<Member[]>;
}

export async function removeMember(id: string): Promise<void> {
  await api(`/family/members/${id}`, "DELETE");
}

export async function rotateInvite(): Promise<string> {
  const { inviteToken } = (await (await api("/family/invite", "POST")).json()) as {
    inviteToken: string;
  };
  return inviteToken;
}
