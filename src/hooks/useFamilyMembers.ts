import { useCallback, useEffect, useState } from "react";
import { fetchMembers, removeMember } from "../data/familyApi";
import type { Member } from "../domain/types";

export function useFamilyMembers() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setMembers(await fetchMembers());
      setError("");
    } catch {
      setError("Não consegui carregar os participantes. Confira a internet.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function remove(id: string) {
    try {
      await removeMember(id);
      await reload();
    } catch {
      setError("Não consegui remover. Tente de novo.");
    }
  }

  return { members, error, remove };
}
