/**
 * Volume Units Documentation and Utilities
 * 
 * This file documents the volume unit conventions used throughout the segmentation components
 * and provides utility functions for consistent unit conversion.
 * 
 * VOLUME UNIT CONVENTIONS:
 * -----------------------
 * 1. API Data: The API provides volume in cubic millimeters (mm³)
 * 2. Internal Storage: In segment.cachedStats, volume is stored in milliliters (mL)
 *    - 1 mL = 1 cm³ = 1000 mm³
 * 3. UI Display: All volume values are displayed in mL
 * 
 * CONVERSION RULES:
 * ---------------
 * - When receiving volume from API (mm³): divide by 1000 to get mL
 * - When calculating volume from voxels: 
 *   1. Calculate in mm³: voxelCount * (spacingX * spacingY * spacingZ)
 *   2. Convert to mL: volumeMm3 / 1000
 * - When displaying volume: use the value directly from cachedStats.volume (already in mL)
 * 
 * IMPLEMENTATION DETAILS:
 * ---------------------
 * - useSegmentationDataSync.ts: Handles conversion from mm³ to mL during calculation
 * - SegmentStats.tsx: Displays volume directly from cachedStats.volume (in mL)
 */

/**
 * Convert volume from cubic millimeters (mm³) to milliliters (mL)
 * 1 mL = 1 cm³ = 1000 mm³
 */
export function convertMm3ToMl(volumeMm3: number): number {
  return volumeMm3 / 1000;
}

/**
 * Convert volume from milliliters (mL) to cubic millimeters (mm³)
 * 1 mL = 1 cm³ = 1000 mm³
 */
export function convertMlToMm3(volumeMl: number): number {
  return volumeMl * 1000;
}

/**
 * Calculate volume in milliliters (mL) from voxel count and spacing
 * @param voxelCount Number of voxels in the segment
 * @param spacing Array of spacing values [x, y, z] in mm
 * @returns Volume in mL
 */
export function calculateVolumeInMl(voxelCount: number, spacing: [number, number, number]): number {
  const voxelVolumeMm3 = spacing[0] * spacing[1] * spacing[2]; // mm³
  const volumeMm3 = voxelCount * voxelVolumeMm3;
  return convertMm3ToMl(volumeMm3);
}

/**
 * Format volume for display with always 2 decimal places
 * @param volumeMl Volume in milliliters (mL)
 * @returns Formatted volume string with 2 decimal places
 */
export function formatVolumeForDisplay(volumeMl: number): string {
  // Always use 2 decimal places for consistency
  return volumeMl.toFixed(2);
}
