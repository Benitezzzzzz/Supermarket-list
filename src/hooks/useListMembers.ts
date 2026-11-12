import { useCallback, useEffect, useState } from "react";
import { fetchMembers, removeMember } from "../data/listsApi";
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

  async function remove(userId: string) {
    try {
      await removeMember(listId, userId);
      await reload();
    } catch {
      setError("Não consegui remover. Tente de novo.");
    }
  }

  return { members, error, remove };
}
