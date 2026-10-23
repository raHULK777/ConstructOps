import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { API_BASE_URL } from './env';

export interface ApiResult<T> {
  status: number;
  data: T | null;
}

export interface ApiErrorBody {
  success?: false;
  error?: string;
  code?: string;
  requestId?: string;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  host: string;
  timeoutMs?: number;
}

/**
 * Server-side API client. Uses node:http directly because the tenant is chosen
 * by the Host header, which is easier to control here than through fetch, and
 * because the portal must never expose the API host to the browser.
 */
export function apiRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<ApiResult<T>> {
  const url = new URL(path, API_BASE_URL);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          Host: options.host,
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          raw += chunk;
        });
        response.on('end', () => {
          let data: unknown = null;
          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch {
              data = null;
            }
          }
          resolve({ status: response.statusCode ?? 0, data: (data as T | null) ?? null });
        });
      },
    );

    request.setTimeout(options.timeoutMs ?? 4_000, () => {
      request.destroy(new Error('API request timed out'));
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

/** Extracts a client-safe message from an API error envelope. */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as ApiErrorBody).error;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

/** Same as apiRequest, but a transport failure becomes status 0 instead of a throw. */
export async function safeApiRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<ApiResult<T>> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    console.warn(`API request failed (${path}): ${(error as Error).message}`);
    return { status: 0, data: null };
  }
}
