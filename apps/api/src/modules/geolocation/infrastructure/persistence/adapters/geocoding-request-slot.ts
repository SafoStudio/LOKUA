import type { DataSource } from 'typeorm';

export async function reserveGeocodingSlot(dataSource: DataSource): Promise<boolean> {
  const rows = await dataSource.query<{ id: boolean }[]>(
    `INSERT INTO geocoding_request_slot (id, next_request_at)
     VALUES (true, clock_timestamp() + interval '1 second')
     ON CONFLICT (id) DO UPDATE SET next_request_at = clock_timestamp() + interval '1 second'
     WHERE geocoding_request_slot.next_request_at <= clock_timestamp()
     RETURNING id`
  );
  return rows.length === 1;
}
