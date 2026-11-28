export const snapshotDistrict = `district.id = (
  SELECT candidate.id FROM districts candidate
  WHERE candidate.city_id = snapshot.city_id
    AND (
      ST_Covers(CAST(candidate.boundary AS geometry), CAST(snapshot.coordinates AS geometry))
      OR (candidate.boundary IS NULL AND candidate.id = snapshot.district_id)
    )
  ORDER BY (candidate.id = snapshot.district_id) DESC NULLS LAST, candidate.id
  LIMIT 1
)`;
export const areaPoint = `COALESCE(
  CAST(district.center AS geometry),
  ST_SetSRID(ST_MakePoint(city.longitude, city.latitude), 4326)
)`;
export function foreignPrivateLocation(locationId: string, organizerId: string): string {
  return `EXISTS (
    SELECT 1 FROM locations
    WHERE id = ${locationId} AND is_private AND created_by IS DISTINCT FROM ${organizerId}
  ) OR EXISTS (
    SELECT 1 FROM events other_event
    LEFT JOIN event_location_snapshot other_snapshot ON other_snapshot.event_id = other_event.id
    WHERE other_event.hide_exact_address AND other_event.organizer_id <> ${organizerId}
      AND (other_event.primary_location_id = ${locationId} OR other_snapshot.location_id = ${locationId})
  )`;
}
