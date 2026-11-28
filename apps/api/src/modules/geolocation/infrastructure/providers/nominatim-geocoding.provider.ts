import type {
  GeocodingProvider,
  GeocodingResult,
  ReverseGeocodingProvider,
  GeocodeOptions
} from '../../application/index.js';
import type { Coordinates } from '../../../../common/index.js';
import { AppError } from '../../../../common/index.js';
import { GeocodingProviderError, isValidCoordinates } from '../../domain/index.js';
import { z } from 'zod';

const nominatimItem = z.object({
  place_id: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]),
  lat: z.string().trim().min(1).transform(Number),
  lon: z.string().trim().min(1).transform(Number),
  display_name: z.string().min(1),
  address: z.object({
    suburb: z.string().optional(),
    city_district: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    country_code: z.string().regex(/^[a-z]{2}$/i)
  })
});

export interface NominatimGeocodingProviderOptions {
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  acquireSlot?: () => Promise<boolean>;
}

export class NominatimGeocodingProvider implements GeocodingProvider, ReverseGeocodingProvider {
  public readonly providerName = 'nominatim';

  private readonly baseUrl?: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly acquireSlot?: () => Promise<boolean>;
  private nextRequestAt = 0;

  constructor(options?: NominatimGeocodingProviderOptions) {
    this.baseUrl = options?.baseUrl?.replace(/\/+$/, '');
    this.userAgent = options?.userAgent ?? 'LOKUA-App/1.0 (contact: info@lokua.app)';
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.minIntervalMs = options?.minIntervalMs ?? 1000;
    this.acquireSlot = options?.acquireSlot;
  }

  async geocode(address: string, options?: GeocodeOptions): Promise<GeocodingResult | null> {
    const url = this.endpoint('search');
    url.searchParams.set('q', options?.city ? `${address}, ${options.city}` : address);
    if (options?.countryCode)
      url.searchParams.set('countrycodes', options.countryCode.toLowerCase());
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    const items = await this.fetchJson(url);
    if (!Array.isArray(items)) throw this.invalidResponse();
    if (items.length === 0) return null;
    return this.mapNominatimItem(items[0]);
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    const url = this.endpoint('reverse');
    url.searchParams.set('lat', coordinates.latitude.toString());
    url.searchParams.set('lon', coordinates.longitude.toString());
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const item = await this.fetchJson(url, true);
    if (item === undefined) return null;
    return this.mapNominatimItem(item);
  }

  private async fetchJson(url: URL, allowNotFound = false): Promise<unknown> {
    if (!(await this.reserveRequest()))
      throw new AppError('Geocoding is busy. Try again shortly.', 503);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json'
        },
        signal: controller.signal,
        redirect: 'error'
      });

      if (allowNotFound && response.status === 404) return undefined;
      if (response.status === 429 || response.status === 503) {
        throw new AppError('Geocoding is temporarily unavailable', 503);
      }
      if (!response.ok) {
        throw new GeocodingProviderError(this.providerName, `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) throw new AppError('Geocoding provider timed out', 504);
      throw new GeocodingProviderError(this.providerName, 'Request failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapNominatimItem(input: unknown): GeocodingResult {
    const parsed = nominatimItem.safeParse(input);
    if (!parsed.success) throw this.invalidResponse();
    const { lat, lon, address, display_name, place_id } = parsed.data;
    const coordinates = { latitude: lat, longitude: lon };
    if (!isValidCoordinates(coordinates)) throw this.invalidResponse();

    return {
      formattedAddress: display_name,
      city: (address.city ?? address.town ?? address.village ?? '').slice(0, 100),
      district: (address.city_district ?? address.suburb)?.slice(0, 100) ?? null,
      countryCode: address.country_code.toUpperCase(),
      coordinates,
      provider: this.providerName,
      providerPlaceId: String(place_id)
    };
  }

  private invalidResponse() {
    return new GeocodingProviderError(this.providerName, 'Invalid response');
  }

  private endpoint(path: 'search' | 'reverse'): URL {
    if (!this.baseUrl) throw new AppError('Geocoding provider is not configured', 503);
    return new URL(`${this.baseUrl}/${path}`);
  }

  private async reserveRequest(): Promise<boolean> {
    if (this.acquireSlot) return this.acquireSlot();
    const now = Date.now();
    if (now < this.nextRequestAt) return false;
    this.nextRequestAt = now + this.minIntervalMs;
    return true;
  }
}
