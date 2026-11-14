import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const DEFAULT_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch wrapper with strict 8s timeout, Zod validation, and offline mock fallback stub.
 *
 * @param path Endpoint path relative to /api/v1 (e.g. '/crew')
 * @param schema Zod schema to validate response against
 * @param options Standard RequestInit options
 */
export async function apiClient<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {}
): Promise<T> {
  if (USE_MOCK) {
    // TODO: Connect to local /src/mocks static JSON files when VITE_USE_MOCK=true
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        errorJson?.error?.code || 'UNKNOWN_ERROR',
        errorJson?.error?.message || `HTTP ${response.status} error`
      );
    }

    const data = await response.json();
    return schema.parse(data);
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof z.ZodError) {
      throw new ApiError(422, 'SCHEMA_VALIDATION_ERROR', `Response validation failed: ${err.message}`);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    // TODO: On network failure or timeout, fallback to static /src/mocks
    throw new ApiError(0, 'NETWORK_ERROR', (err as Error).message || 'Network request failed');
  }
}
