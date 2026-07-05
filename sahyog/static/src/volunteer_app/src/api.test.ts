import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiGet, apiPost } from './api';

function mockFetch(
  body: unknown,
  { status = 200, contentType = 'application/json' } = {},
) {
  return vi.fn().mockResolvedValue({
    status,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? contentType : null,
    },
    json: async () => body,
  });
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('unwraps the {success, data} envelope on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true, data: { hello: 'world' } }));
    const data = await apiGet<{ hello: string }>('/thing');
    expect(data).toEqual({ hello: 'world' });
  });

  it('throws the error message from a failure envelope', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: false, error: 'nope' }));
    await expect(apiGet('/thing')).rejects.toThrow('nope');
  });

  it('prefixes the base path and sends a JSON body on POST', async () => {
    const f = mockFetch({ success: true, data: 1 });
    vi.stubGlobal('fetch', f);
    await apiPost('/thing', { a: 1 });
    expect(f).toHaveBeenCalledWith(
      '/sahyog/api/thing',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ a: 1 }),
      }),
    );
  });

  it('rejects when the server returns non-JSON (unexpected content type)', async () => {
    vi.stubGlobal('fetch', mockFetch('<xml/>', { contentType: 'application/xml' }));
    await expect(apiGet('/thing')).rejects.toThrow('Unexpected response');
  });
});
