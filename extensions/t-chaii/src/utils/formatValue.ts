/**
 * Formats a numeric value with 2 decimal places
 * @param value The number to format
 * @returns Formatted string or '--' if value is null/undefined
 */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}
