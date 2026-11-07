/** Avisa os aparelhos conectados de uma família. Os avisos não levam dados. */
export interface Notifier {
  broadcast(familyId: string): Promise<void>;
  disconnectMember(familyId: string, memberId: string): Promise<void>;
  /** Abre o canal em tempo real de um membro. */
  connect(familyId: string, memberId: string, request: Request): Promise<Response>;
}

/** Implementação com um Durable Object por família, que guarda as conexões abertas. */
export function durableObjectNotifier(namespace: DurableObjectNamespace): Notifier {
  const stub = (familyId: string) => namespace.get(namespace.idFromName(familyId));
  const call = async (familyId: string, path: string) => {
    await stub(familyId).fetch(new Request(`https://eventos${path}`, { method: "POST" }));
  };

  return {
    broadcast: (familyId) => call(familyId, "/notify"),
    disconnectMember: (familyId, memberId) =>
      call(familyId, `/disconnect?member=${encodeURIComponent(memberId)}`),
    connect: async (familyId, memberId, request) => {
      const response = await stub(familyId).fetch(
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
