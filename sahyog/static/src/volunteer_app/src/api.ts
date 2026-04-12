const BASE = '/sahyog/api';

function getCsrfToken(): string | undefined {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf_token"]')?.content;
}

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const csrf = getCsrfToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...options?.headers,
    },
    credentials: 'same-origin',
  });

  if (res.status === 401 || res.status === 303) {
    window.location.href = '/sahyog/login';
    throw new Error('Session expired');
  }

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Unknown error');
  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiCall<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiCall<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
