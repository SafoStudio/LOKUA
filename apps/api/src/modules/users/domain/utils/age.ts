export function calculateAge(
  birthDate: Date | string | null,
  now: Date = new Date()
): number | null {
  if (!birthDate) return null;

  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (!(birth instanceof Date) || Number.isNaN(birth.getTime())) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
