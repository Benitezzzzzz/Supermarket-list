import { AccessRevokedError, RejectedOpError } from "./backend";

async function errorBody(response: Response): Promise<{ message: string; code?: string }> {
  const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  return { message: body?.error ?? `Erro ${response.status}`, code: body?.code };
}

/**
 * Chama a API e traduz a resposta: 401 é conta desconectada, 404 com
 * code "list_access" é lista sem acesso, outros 4xx são recusas definitivas,
 * e o resto (5xx, sem rede) lança erro comum, que a fila reenvia.
 */
export async function api(path: string, method = "GET", body?: unknown): Promise<Response> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.ok) return response;
  const { message, code } = await errorBody(response);
  if (response.status === 401) throw new AccessRevokedError(message, "session");
  if (code === "list_access") throw new AccessRevokedError(message, "list");
  if (response.status < 500) throw new RejectedOpError(message);
  throw new Error(message);
}
