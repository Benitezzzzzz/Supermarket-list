import { useCallback, useEffect, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { addMember, fetchMembers, removeMember } from "../data/listsApi";
import type { ListMember } from "../domain/types";

export function useListMembers(listId: string) {
  const [members, setMembers] = useState<ListMember[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setMembers(await fetchMembers(listId));
      setError("");
    } catch {
      setError("Não consegui carregar os participantes. Confira a internet.");
    }
  }, [listId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Devolve a mensagem de erro, ou "" se deu certo. */
  async function add(username: string): Promise<string> {
    try {
      await addMember(listId, username);
      await reload();
      return "";
    } catch (failure) {
      return failure instanceof RejectedOpError ? failure.message : "Não consegui adicionar. Confira a internet.";
    }
  }

  async function remove(userId: string) {
    try {
      await removeMember(listId, userId);
      await reload();
    } catch {
      setError("Não consegui remover. Tente de novo.");
    }
  }

  return { members, error, add, remove };
}
