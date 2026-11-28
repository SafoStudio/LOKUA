import { afterEach, describe, expect, it, vi } from 'vitest';
import { NominatimGeocodingProvider } from '../../../../src/modules/geolocation/infrastructure/index.js';

const item = {
  place_id: 42,
  lat: '50.4501',
  lon: '30.5234',
  display_name: 'Kyiv, Ukraine',
  address: { city: 'Kyiv', country_code: 'ua' }
};

describe('NominatimGeocodingProvider', () => {
  const createProvider = () =>
    new NominatimGeocodingProvider({ baseUrl: 'https://geo.example.test/', minIntervalMs: 0 });

  afterEach(() => vi.unstubAllGlobals());

  it('applies a country filter and maps a valid response', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([item]));
    vi.stubGlobal('fetch', fetch);
    await expect(
      createProvider().geocode('Khreshchatyk', { city: 'Kyiv', countryCode: 'UA' })
    ).resolves.toMatchObject({
      countryCode: 'UA',
      coordinates: { latitude: 50.4501, longitude: 30.5234 },
      providerPlaceId: '42'
    });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('Khreshchatyk, Kyiv');
    expect(url.searchParams.get('countrycodes')).toBe('ua');
  });

  it('distinguishes a missing location from invalid upstream data', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ ...item, lat: '50.45broken' }]))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider();
    await expect(provider.geocode('Unknown')).resolves.toBeNull();
    await expect(provider.geocode('Broken')).rejects.toMatchObject({ statusCode: 502 });
    await expect(provider.reverseGeocode({ latitude: 0, longitude: 0 })).resolves.toBeNull();
  });

  it('accepts a string place identifier from reverse geocoding', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ...item, place_id: '42' }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      createProvider().reverseGeocode({ latitude: 50.45, longitude: 30.52 })
    ).resolves.toMatchObject({ providerPlaceId: '42' });
  });

  it('rejects concurrent calls during the provider interval', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([item]));
    vi.stubGlobal('fetch', fetch);
    const provider = new NominatimGeocodingProvider({ baseUrl: 'https://geo.example.test' });
    const first = provider.geocode('Kyiv');
    await expect(provider.geocode('Lviv')).rejects.toMatchObject({ statusCode: 503 });
    await expect(first).resolves.toMatchObject({ providerPlaceId: '42' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('reports upstream timeouts without exposing request details', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, { signal }: RequestInit) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new Error('Internal request information')),
            {
              once: true
            }
          );
        })
    );
    const provider = new NominatimGeocodingProvider({
      baseUrl: 'https://geo.example.test',
      timeoutMs: 5
    });
    await expect(provider.geocode('Kyiv')).rejects.toMatchObject({
      statusCode: 504,
      message: 'Geocoding provider timed out'
    });
  });
});
