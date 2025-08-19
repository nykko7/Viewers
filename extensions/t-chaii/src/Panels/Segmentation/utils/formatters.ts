/**
 * Utility functions for formatting values in the segmentation UI
 */

/**
 * Format a numeric value for display with 2 decimal places
 * @param value The numeric value to format
 * @returns Formatted string with 2 decimal places
 */
export function formatValue(value: number): string {
  if (value === undefined || value === null) return '--';

  // Always use 2 decimal places for consistency
  return value.toFixed(2);
}
