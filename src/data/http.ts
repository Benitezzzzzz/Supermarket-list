import { AccessRevokedError, RejectedOpError } from "./backend";

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Erro ${response.status}`;
}

/**
 * Chama a API e traduz a resposta: 401 vira perda de acesso, outros 4xx são
 * recusas definitivas e o resto (5xx, sem rede) lança erro comum, que a fila reenvia.
 */
export async function api(path: string, method = "GET", body?: unknown): Promise<Response> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.ok) return response;
  const message = await errorMessage(response);
  if (response.status === 401) throw new AccessRevokedError(message);
  if (response.status < 500) throw new RejectedOpError(message);
  throw new Error(message);
}
