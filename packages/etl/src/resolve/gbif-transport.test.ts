import { describe, expect, it, vi } from 'vitest';
import { createFetchGbifTransport } from './gbif-transport.ts';

/** A minimal stand-in for the `Response` object `fetch` resolves to. */
function fakeResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

/** A `fetch`-shaped mock so its recorded call arguments are properly typed. */
function fetchMock(response: Response) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match `typeof fetch` for `fetchImpl.mock.calls` to type-check.
  return vi.fn(async (..._args: Parameters<typeof fetch>): Promise<Response> => response);
}

describe('createFetchGbifTransport', () => {
  it('queries GBIF species/match with the name as a query parameter and returns the parsed body', async () => {
    const fetchImpl = fetchMock(
      fakeResponse({
        usageKey: 1000001,
        canonicalName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
      }),
    );
    const transport = createFetchGbifTransport(fetchImpl);

    const result = await transport.matchName('onion');

    expect(result).toEqual({
      usageKey: 1000001,
      canonicalName: 'Allium cepa',
      matchType: 'EXACT',
      confidence: 98,
    });
    const [requestedUrl] = fetchImpl.mock.calls[0];
    expect(String(requestedUrl)).toContain('species/match');
    expect((requestedUrl as URL).searchParams.get('name')).toBe('onion');
  });

  it('throws a descriptive error on a non-2xx response, without retrying', async () => {
    const fetchImpl = fetchMock(
      fakeResponse({}, { ok: false, status: 503, statusText: 'Service Unavailable' }),
    );
    const transport = createFetchGbifTransport(fetchImpl);

    await expect(transport.matchName('onion')).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws rather than trusting a response whose fields do not match the expected shape', async () => {
    // usageKey should be a number; GBIF (or some future API change) returning
    // a string here must not be silently accepted as a valid match.
    const fetchImpl = fetchMock(fakeResponse({ usageKey: 'not-a-number', matchType: 'EXACT' }));
    const transport = createFetchGbifTransport(fetchImpl);

    await expect(transport.matchName('onion')).rejects.toThrow(/unexpected response shape/);
  });

  it('throws rather than trusting a non-object response body', async () => {
    const fetchImpl = fetchMock(fakeResponse(null));
    const transport = createFetchGbifTransport(fetchImpl);

    await expect(transport.matchName('onion')).rejects.toThrow(/non-object response/);
  });
});
