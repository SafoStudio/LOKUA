import type {
  GeocodingProvider,
  GeocodingResult,
  ReverseGeocodingProvider,
  GeocodeOptions
} from '../../application/index.js';
import type { Coordinates } from '../../../../common/index.js';
import { GeocodingProviderError } from '../../domain/index.js';

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  country_code?: string;
}

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

export interface NominatimGeocodingProviderOptions {
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
}

export class NominatimGeocodingProvider implements GeocodingProvider, ReverseGeocodingProvider {
  public readonly providerName = 'nominatim';

  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private lastRequestTime = 0;

  constructor(options?: NominatimGeocodingProviderOptions) {
    this.baseUrl = options?.baseUrl ?? 'https://nominatim.openstreetmap.org';
    this.userAgent = options?.userAgent ?? 'LOKUA-App/1.0 (contact: info@lokua.app)';
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.minIntervalMs = options?.minIntervalMs ?? 1000;
  }

  async geocode(address: string, options?: GeocodeOptions): Promise<GeocodingResult | null> {
    await this.throttle();

    const parts = [address];
    if (options?.city) parts.push(options.city);
    if (options?.countryCode) parts.push(options.countryCode);
    const query = parts.join(', ');

    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    const items = await this.fetchJson<NominatimItem[]>(url);
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }
    return this.mapNominatimItem(items[0]);
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    await this.throttle();

    const url = new URL(`${this.baseUrl}/reverse`);
    url.searchParams.set('lat', coordinates.latitude.toString());
    url.searchParams.set('lon', coordinates.longitude.toString());
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const item = await this.fetchJson<NominatimItem>(url);
    if (!item || !item.lat || !item.lon) {
      return null;
    }
    return this.mapNominatimItem(item);
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new GeocodingProviderError(this.providerName, `HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof GeocodingProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new GeocodingProviderError(this.providerName, message);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapNominatimItem(item: NominatimItem): GeocodingResult {
    const addr = item.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? '';
    const district = addr.city_district ?? addr.suburb ?? null;
    const countryCode = (addr.country_code ?? 'ua').toUpperCase();

    return {
      formattedAddress: item.display_name,
      city,
      district,
      countryCode,
      coordinates: {
        latitude: Number.parseFloat(item.lat),
        longitude: Number.parseFloat(item.lon)
      },
      provider: this.providerName,
      providerPlaceId: String(item.place_id),
      rawPayload: item as unknown as Record<string, unknown>
    };
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
