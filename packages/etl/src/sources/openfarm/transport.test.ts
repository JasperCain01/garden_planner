import { describe, expect, it, vi } from 'vitest';
import { createFetchOpenFarmTransport } from './transport.ts';

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

// Mirrors resolve/gbif-transport.test.ts: fetch itself is stubbed, so this
// suite never touches the network — the same "unit tests must not hit the
// network" discipline as the rest of the ETL.
describe('createFetchOpenFarmTransport', () => {
  const validRecord = {
    slug: 'onion',
    name: 'Onion',
    source: {
      origin: 'OpenFarm.cc',
      license: 'CC0-1.0',
      waybackUrl: 'https://web.archive.org/web/20250101000000/https://openfarm.cc/en/crops/onion',
      captured: '20250101',
    },
  };

  it('fetches and returns the parsed, validated dump', async () => {
    const fetchImpl = fetchMock(fakeResponse([validRecord]));

    const transport = createFetchOpenFarmTransport(fetchImpl);
    const dump = await transport.fetchDump();

    expect(dump).toEqual([validRecord]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requestedUrl] = fetchImpl.mock.calls[0];
    expect(String(requestedUrl)).toContain('thefullnacho/openfarm-crops-rescue');
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = fetchMock(fakeResponse('nope', { ok: false, status: 404 }));
    const transport = createFetchOpenFarmTransport(fetchImpl);

    await expect(transport.fetchDump()).rejects.toThrow(/404/);
  });

  it('throws when the response body is not a valid crop array', async () => {
    const fetchImpl = fetchMock(fakeResponse({ not: 'an array' }));
    const transport = createFetchOpenFarmTransport(fetchImpl);

    await expect(transport.fetchDump()).rejects.toThrow(/expected a JSON array/);
  });
});
