export type TemperatureUnit = 'celsius' | 'fahrenheit';

export function convertTemp(
  fahrenheit: number,
  unit: TemperatureUnit
): number {
  if (unit === 'celsius') {
    return Math.round((fahrenheit - 32) * (5 / 9));
  }
  return Math.round(fahrenheit);
}

export function tempLabel(
  fahrenheit: number,
  unit: TemperatureUnit
): string {
  return `${convertTemp(fahrenheit, unit)}°${unit === 'celsius' ? 'C' : 'F'}`;
}
