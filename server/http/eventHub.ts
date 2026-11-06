export interface Connection {
  memberId: string;
  notify: () => void;
  close: () => void;
}

/** Conexões SSE abertas, por família. O aviso não leva dados: o cliente relê pela API autenticada. */
export class EventHub {
  private families = new Map<string, Set<Connection>>();

  add(familyId: string, connection: Connection): () => void {
    const connections = this.families.get(familyId) ?? new Set();
    connections.add(connection);
    this.families.set(familyId, connections);

    return () => {
      connections.delete(connection);
      if (connections.size === 0) this.families.delete(familyId);
    };
  }

  broadcast(familyId: string) {
    for (const connection of this.families.get(familyId) ?? []) connection.notify();
  }

  disconnectMember(familyId: string, memberId: string) {
    for (const connection of this.families.get(familyId) ?? []) {
      if (connection.memberId === memberId) connection.close();
    }
  }
}
