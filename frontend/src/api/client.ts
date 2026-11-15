import { z } from 'zod';
import crewMock from '../mocks/crew.json';
import vitalsC001Mock from '../mocks/vitals_C001.json';
import biomarkersC001Mock from '../mocks/biomarkers_C001.json';
import scenarioMock from '../mocks/scenario.json';
import copilotCachedMock from '../mocks/copilot_cached.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const DEFAULT_TIMEOUT_MS = 8000;

let mockInUse = USE_MOCK;

export function isUsingMock(): boolean {
  return mockInUse;
}

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

function resolveMockData(path: string): unknown {
  const cleanPath = path.split('?')[0];
  if (cleanPath === '/crew') {
    return crewMock;
  }
  if (cleanPath.startsWith('/crew/') && cleanPath.endsWith('/vitals')) {
    return vitalsC001Mock;
  }
  if (cleanPath.startsWith('/crew/') && cleanPath.endsWith('/biomarkers')) {
    return biomarkersC001Mock;
  }
  if (cleanPath === '/scenario/state') {
    return scenarioMock;
  }
  if (cleanPath === '/copilot/explain') {
    return copilotCachedMock;
  }
  return undefined;
}

/**
 * Fetch wrapper with strict 8s timeout, Zod validation, and offline mock fallback.
 *
 * @param path Endpoint path relative to /api/v1 (e.g. '/crew')
 * @param schema Zod schema to validate response against
 * @param options Standard RequestInit options
 */
export async function apiClient<T>(
  path: string,
  schema: z.ZodType<T, any, any>,
  options: RequestInit = {}
): Promise<T> {
  if (USE_MOCK) {
    const mock = resolveMockData(path);
    if (mock !== undefined) {
      mockInUse = true;
      return schema.parse(mock);
    }
    throw new ApiError(404, 'MOCK_NOT_FOUND', `No mock available for path: ${path}`);
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

    // On network failure or timeout, fallback to static /src/mocks
    const mock = resolveMockData(path);
    if (mock !== undefined) {
      mockInUse = true;
      return schema.parse(mock);
    }

    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const code = isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR';
    const message = isTimeout ? 'Request timed out' : ((err as Error).message || 'Network request failed');
    throw new ApiError(0, code, message);
  }
}
