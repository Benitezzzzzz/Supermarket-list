/** Avisa os aparelhos conectados a uma lista. Os avisos não levam dados. */
export interface Notifier {
  broadcast(listId: string): Promise<void>;
  disconnectMember(listId: string, userId: string): Promise<void>;
  /** Abre o canal em tempo real de um membro. */
  connect(listId: string, userId: string, request: Request): Promise<Response>;
}

/** Implementação com um Durable Object por lista, que guarda as conexões abertas. */
export function durableObjectNotifier(namespace: DurableObjectNamespace): Notifier {
  const stub = (listId: string) => namespace.get(namespace.idFromName(listId));
  const call = async (listId: string, path: string) => {
    await stub(listId).fetch(new Request(`https://eventos${path}`, { method: "POST" }));
  };

  return {
    broadcast: (listId) => call(listId, "/notify"),
    disconnectMember: (listId, memberId) =>
      call(listId, `/disconnect?member=${encodeURIComponent(memberId)}`),
    connect: async (listId, memberId, request) => {
      const response = await stub(listId).fetch(
        new Request(`https://eventos/connect?member=${encodeURIComponent(memberId)}`, request),
      );
      // A resposta do Durable Object tem cabeçalhos imutáveis; a cópia deixa os
      // middlewares (como o de cabeçalhos de segurança) acrescentarem os seus.
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
        webSocket: response.webSocket,
      });
    },
  };
}
