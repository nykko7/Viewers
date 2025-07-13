import { useEffect } from 'react';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { cache } from '@cornerstonejs/core';
import { segmentation as cstSegmentation, Enums as cstEnums } from '@cornerstonejs/tools';

// OpenCV-like functions for contour analysis (simplified for browser)
interface Point {
  x: number;
  y: number;
}

interface Contour extends Array<Point> {}

interface MinAreaRect {
  center: Point;
  size: { width: number; height: number };
  angle: number;
}

const { SegmentationRepresentations } = cstEnums;

/**
 * Helper functions for contour analysis and OBB calculations
 */

/**
 * Find contours in a binary mask
 */
function findContours(mask: Uint8Array, width: number, height: number): Contour[] {
  const contours: Contour[] = [];
  const visited = new Set<number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0 && !visited.has(idx)) {
        const contour = traceContour(mask, width, height, x, y, visited);
        if (contour.length > 1) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Trace a contour starting from a point
 */
function traceContour(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<number>
): Contour {
  const contour: Contour = [];
  const stack: Point[] = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const point = stack.pop()!;
    const idx = point.y * width + point.x;

    if (
      visited.has(idx) ||
      point.x < 0 ||
      point.x >= width ||
      point.y < 0 ||
      point.y >= height ||
      mask[idx] === 0
    ) {
      continue;
    }

    visited.add(idx);
    contour.push(point);

    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        stack.push({ x: point.x + dx, y: point.y + dy });
      }
    }
  }

  return contour;
}

/**
 * Calculate contour area
 */
function contourArea(contour: Contour): number {
  if (contour.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i].x * contour[j].y;
    area -= contour[j].x * contour[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate minimum area rectangle (OBB) for a contour
 */
function minAreaRect(contour: Contour): MinAreaRect {
  if (contour.length < 3) {
    return {
      center: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
      angle: 0,
    };
  }

  // Find convex hull first
  const hull = convexHull(contour);

  let minArea = Infinity;
  let bestRect: MinAreaRect = {
    center: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    angle: 0,
  };

  // Try different orientations based on hull edges
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const edge = { x: hull[j].x - hull[i].x, y: hull[j].y - hull[i].y };
    const angle = Math.atan2(edge.y, edge.x);

    const rect = getOrientedBoundingRect(hull, angle);
    const area = rect.size.width * rect.size.height;

    if (area < minArea) {
      minArea = area;
      bestRect = rect;
    }
  }

  return bestRect;
}

/**
 * Calculate convex hull using Graham scan
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) {
    return points;
  }

  // Find bottom-most point (or left most in case of tie)
  let start = points[0];
  let startIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < start.y || (points[i].y === start.y && points[i].x < start.x)) {
      start = points[i];
      startIdx = i;
    }
  }

  // Sort points by polar angle with respect to start point
  const sorted = points.slice();
  sorted.splice(startIdx, 1);
  sorted.sort((a, b) => {
    const angleA = Math.atan2(a.y - start.y, a.x - start.x);
    const angleB = Math.atan2(b.y - start.y, b.x - start.x);
    return angleA - angleB;
  });

  const hull = [start];
  for (const point of sorted) {
    while (
      hull.length > 1 &&
      crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
    ) {
      hull.pop();
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Calculate cross product for three points
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Get oriented bounding rectangle for given angle
 */
function getOrientedBoundingRect(points: Point[], angle: number): MinAreaRect {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Rotate points
  const rotated = points.map(p => ({
    x: p.x * cos + p.y * sin,
    y: -p.x * sin + p.y * cos,
  }));

  // Find axis-aligned bounding box of rotated points
  let minX = rotated[0].x,
    maxX = rotated[0].x;
  let minY = rotated[0].y,
    maxY = rotated[0].y;

  for (const p of rotated) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Rotate center back
  const originalCenterX = centerX * cos - centerY * sin;
  const originalCenterY = centerX * sin + centerY * cos;

  return {
    center: { x: originalCenterX, y: originalCenterY },
    size: { width, height },
    angle: (angle * 180) / Math.PI,
  };
}

/**
 * Compute diameters of a lesion using OBB method with largest-area unconnected strategy
 */
function computeDiameters(
  mask: any,
  lesion: any,
  method: 'obb' = 'obb',
  unconnectedStrategy: 'largest-area' = 'largest-area',
  spacing: number[] = [1, 1, 1],
  returnFigureParams: boolean = false
): any {
  console.log('[computeDiameters] Computing diameters for lesion:', lesion);

  if (!lesion || !lesion.coords) {
    console.log('[computeDiameters] Invalid lesion data');
    return null;
  }

  // Get unique slices where the lesion exists
  const uniqueSlices = [...new Set(lesion.coords.map((coord: number[]) => coord[0]))];
  const groupedMaxDiameters: Record<string, number> = {};
  const groupedMinDiameters: Record<string, number> = {};

  console.log('[computeDiameters] Processing slices:', uniqueSlices);

  if (method === 'obb') {
    // Process each slice
    for (const sliceIdx of uniqueSlices) {
      try {
        // Create slice mask for this specific slice
        const sliceCoords = lesion.coords.filter((coord: number[]) => coord[0] === sliceIdx);

        if (sliceCoords.length === 0) {
          console.log(`[computeDiameters] No coordinates for slice ${sliceIdx}`);
          continue;
        }

        // Find bounding box for this slice
        const minRow = Math.min(...sliceCoords.map((coord: number[]) => coord[1]));
        const maxRow = Math.max(...sliceCoords.map((coord: number[]) => coord[1]));
        const minCol = Math.min(...sliceCoords.map((coord: number[]) => coord[2]));
        const maxCol = Math.max(...sliceCoords.map((coord: number[]) => coord[2]));

        const width = maxCol - minCol + 1;
        const height = maxRow - minRow + 1;

        // Create binary mask for this slice
        const sliceMask = new Uint8Array(width * height);

        for (const coord of sliceCoords) {
          const row = coord[1] - minRow;
          const col = coord[2] - minCol;
          if (row >= 0 && row < height && col >= 0 && col < width) {
            sliceMask[row * width + col] = 255;
          }
        }

        console.log(
          `[computeDiameters] Processing slice ${sliceIdx} with dimensions ${width}x${height}`
        );

        // Find contours in the slice
        const contours = findContours(sliceMask, width, height);

        if (contours.length === 0) {
          console.log(`[computeDiameters] No contours found for slice ${sliceIdx}`);
          continue;
        }

        console.log(`[computeDiameters] Found ${contours.length} contours for slice ${sliceIdx}`);

        let majorLength = 0;
        let minorLength = 0;

        // Apply unconnected strategy
        if (unconnectedStrategy === 'largest-area') {
          // Find the contour with the largest area
          const largestContour = contours.reduce((prev, current) =>
            contourArea(current) > contourArea(prev) ? current : prev
          );

          const rect = minAreaRect(largestContour);
          majorLength = Math.max(rect.size.width, rect.size.height) * spacing[1];
          minorLength = Math.min(rect.size.width, rect.size.height) * spacing[1];

          console.log(
            `[computeDiameters] Slice ${sliceIdx} largest contour - major: ${majorLength}, minor: ${minorLength}`
          );
        } else {
          console.log(
            `[computeDiameters] Unconnected strategy '${unconnectedStrategy}' not implemented`
          );
          continue;
        }

        groupedMaxDiameters[sliceIdx.toString()] = majorLength;
        groupedMinDiameters[sliceIdx.toString()] = minorLength;
      } catch (error) {
        console.error(`[computeDiameters] Error processing slice ${sliceIdx}:`, error);
        continue;
      }
    }
  } else {
    console.log(`[computeDiameters] Method '${method}' not implemented`);
    return null;
  }

  // Find the slice with the maximum diameter
  const majorAxisSliceIdx = Object.keys(groupedMaxDiameters).reduce((a, b) =>
    groupedMaxDiameters[a] > groupedMaxDiameters[b] ? a : b
  );

  const majorAxis = groupedMaxDiameters[majorAxisSliceIdx] || 0;
  const minorAxis = groupedMinDiameters[majorAxisSliceIdx] || 0;

  const output = {
    label_value: lesion.label,
    major_axis_mm: majorAxis,
    minor_axis_mm: minorAxis,
    major_axis_slice_idx: parseInt(majorAxisSliceIdx),
    method: method,
    unconnected_strategy: unconnectedStrategy,
  };

  console.log('[computeDiameters] Final result:', output);

  if (returnFigureParams) {
    // For now, return just the output. Figure params can be added later if needed
    return { output, figures: [] };
  }

  return output;
}

/**
 * Extract lesion coordinates from segmentation data
 */
function extractLesionCoordinates(
  segmentVoxelData: any,
  segmentIndex: number,
  dimensions: number[]
): number[][] {
  const coords: number[][] = [];

  if (!segmentVoxelData || !dimensions || dimensions.length < 3) {
    return coords;
  }

  const [depth, height, width] = dimensions;

  // Iterate through the voxel data and find coordinates for the specific segment
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = z * height * width + y * width + x;
        if (segmentVoxelData[index] === segmentIndex) {
          coords.push([z, y, x]);
        }
      }
    }
  }

  return coords;
}

/**
 * Enhanced calculate and update stats with OBB diameter calculation
 */
function calculateAndUpdateStatsWithOBB(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any,
  voxelData?: any,
  dimensions?: number[]
) {
  // Calculate volume and diameter for each segment
  const voxelVolume = spacing[0] * spacing[1] * spacing[2]; // mm³

  Object.entries(segmentVoxelCounts).forEach(([segmentIndexStr, voxelCount]) => {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000; // Convert to cm³

    // Calculate diameter assuming spherical shape
    const radius = Math.pow((3 * volumeCm3) / (4 * Math.PI), 1 / 3);
    const sphericalDiameter = 2 * radius; // in cm

    console.log(
      `[calculateAndUpdateStatsWithOBB] Segment ${segmentIndex}: ${voxelCount} voxels, ${volumeMm3.toFixed(2)} mm³`
    );

    // Try to calculate more accurate diameters using OBB method
    let obbDiameters = null;
    try {
      if (voxelData && dimensions) {
        // Extract coordinates for this specific segment
        const coords = extractLesionCoordinates(voxelData, segmentIndex, dimensions);

        if (coords.length > 0) {
          const mockLesion = {
            label: segmentIndex,
            coords: coords,
          };

          obbDiameters = computeDiameters(
            null, // mask not used in our implementation
            mockLesion,
            'obb',
            'largest-area',
            spacing,
            false
          );

          console.log(
            `[calculateAndUpdateStatsWithOBB] OBB diameters for segment ${segmentIndex}:`,
            obbDiameters
          );
        } else {
          console.log(
            `[calculateAndUpdateStatsWithOBB] No coordinates found for segment ${segmentIndex}`
          );
        }
      } else {
        console.log(
          `[calculateAndUpdateStatsWithOBB] Voxel data or dimensions not available for OBB calculation`
        );
      }
    } catch (error) {
      console.log(
        `[calculateAndUpdateStatsWithOBB] Could not calculate OBB diameters for segment ${segmentIndex}:`,
        error
      );
    }

    // Update segment cachedStats directly in the OHIF segmentation
    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      console.log(
        `[calculateAndUpdateStatsWithOBB] Updating segment ${segmentIndex} with new statistics`
      );

      // Update the cachedStats directly
      if (!segment.cachedStats) {
        segment.cachedStats = {};
      }

      // Use OBB diameters if available, otherwise use spherical diameter (all in mm)
      const sphericalDiameterMm = sphericalDiameter * 10; // Convert cm to mm
      const majorDiameterMm = obbDiameters?.major_axis_mm
        ? obbDiameters.major_axis_mm
        : sphericalDiameterMm;
      const minorDiameterMm = obbDiameters?.minor_axis_mm
        ? obbDiameters.minor_axis_mm
        : sphericalDiameterMm;

      // Update the cachedStats with real calculated values - create new object to trigger React updates
      segment.cachedStats = {
        ...segment.cachedStats,
        volume: volumeMm3, // Volume in mm³
        diameter: majorDiameterMm, // Use major diameter as the primary diameter in mm
        major_diameter: majorDiameterMm,
        minor_diameter: minorDiameterMm,
        axial_diameter: majorDiameterMm,
        coronal_diameter: majorDiameterMm,
        sagittal_diameter: majorDiameterMm,
        obb_method: obbDiameters ? 'obb' : 'spherical',
        obb_strategy: obbDiameters ? 'largest-area' : null,
        major_axis_slice_idx: obbDiameters?.major_axis_slice_idx || null,
      };

      // Force a re-render by updating the segmentation object reference
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(
        `[calculateAndUpdateStatsWithOBB] Updated segment ${segmentIndex} with ${obbDiameters ? 'OBB' : 'spherical'} diameters`
      );
    }
  });

  console.log('[calculateAndUpdateStatsWithOBB] Statistics calculation completed successfully');
}

// Declare global types for cornerstoneTools
declare global {
  interface Window {
    cornerstoneTools: any;
    segmentationUpdateTimeout: any;
  }
}

type UseSegmentationDataSyncProps = {
  servicesManager: any;
  subscribeToDataModified?: boolean;
};

export function useSegmentationDataSync({
  servicesManager,
  subscribeToDataModified = false,
}: UseSegmentationDataSyncProps) {
  const { segmentations, updateSegment } = useSegmentationsStore();

  useEffect(() => {
    if (!subscribeToDataModified) {
      console.log('[useSegmentationDataSync] subscribeToDataModified is false, not subscribing');
      return;
    }

    const { segmentationService } = servicesManager.services;
    console.log('[useSegmentationDataSync] Setting up subscription to SEGMENTATION_DATA_MODIFIED');
    console.log('[useSegmentationDataSync] Available events:', segmentationService.EVENTS);

    const unsubscribe = segmentationService.subscribe(
      segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED,
      (evt: any) => {
        console.log('[useSegmentationDataSync] SEGMENTATION_DATA_MODIFIED event received:', evt);

        // Debounce the calculation to avoid excessive updates during rapid brush strokes
        clearTimeout(window.segmentationUpdateTimeout);
        window.segmentationUpdateTimeout = setTimeout(() => {
          handleSegmentationDataModified(evt, segmentations, updateSegment, segmentationService);
        }, 500);
      }
    );

    console.log('[useSegmentationDataSync] Subscription set up successfully');

    return () => {
      console.log('[useSegmentationDataSync] Cleaning up subscription');
      unsubscribe();
      clearTimeout(window.segmentationUpdateTimeout);
    };
  }, [subscribeToDataModified, segmentations, updateSegment, servicesManager]);
}

/**
 * Handle segmentation data modified event
 */
async function handleSegmentationDataModified(
  evt: any,
  segmentations: any,
  updateSegment: any,
  segmentationService: any
) {
  console.log('[handleSegmentationDataModified] Processing event:', evt);

  const segmentationId = evt.detail?.segmentationId || evt.segmentationId;
  if (!segmentationId) {
    console.log('[handleSegmentationDataModified] No segmentationId found in event');
    return;
  }

  console.log('[handleSegmentationDataModified] Processing segmentation:', segmentationId);

  // Get the segmentation directly from the segmentation service
  const segmentation = segmentationService.getSegmentation(segmentationId);
  if (!segmentation) {
    console.log(
      '[handleSegmentationDataModified] Segmentation not found in service:',
      segmentationId
    );
    return;
  }

  console.log('[handleSegmentationDataModified] Found segmentation:', segmentation);

  // Get the active segment index using cornerstone tools API
  let activeSegmentIndex;
  try {
    activeSegmentIndex = cstSegmentation.activeSegmentation.getActiveSegmentIndex(segmentationId);
    console.log(
      '[handleSegmentationDataModified] Active segment index from cornerstone:',
      activeSegmentIndex
    );
  } catch (error) {
    console.log(
      '[handleSegmentationDataModified] Failed to get active segment index from cornerstone:',
      error
    );

    // Try alternative approach: check which segment is marked as active in the segmentation
    const activeSegment = Object.values(segmentation.segments).find(
      (segment: any) => segment.active
    );
    activeSegmentIndex = activeSegment?.segmentIndex;
    console.log(
      '[handleSegmentationDataModified] Active segment index from segmentation data:',
      activeSegmentIndex
    );
  }

  // Calculate updated statistics
  await calculateUpdatedStatistics(
    segmentationId,
    segmentation,
    updateSegment,
    segmentationService,
    activeSegmentIndex
  );
}

/**
 * Get volumes from segmentation using the same approach as TMTV extension
 */
function getVolumesFromSegmentation(segmentationId: string) {
  console.log('[getVolumesFromSegmentation] Getting volumes for segmentationId:', segmentationId);

  try {
    // Get the segmentation from cornerstone state using the correct API
    const segmentation = cstSegmentation.state.getSegmentation(segmentationId);

    if (!segmentation) {
      console.log('[getVolumesFromSegmentation] No segmentation found for ID:', segmentationId);
      return { labelmapVolume: null, referencedVolume: null };
    }

    console.log('[getVolumesFromSegmentation] Found segmentation:', segmentation);

    // Get the labelmap representation
    const labelmapRepresentation =
      segmentation.representationData?.[SegmentationRepresentations.Labelmap];

    if (!labelmapRepresentation) {
      console.log('[getVolumesFromSegmentation] No labelmap representation found');
      return { labelmapVolume: null, referencedVolume: null };
    }

    console.log('[getVolumesFromSegmentation] Labelmap representation:', labelmapRepresentation);

    // Get the volume ID from the labelmap - if volumeId is undefined, try using the segmentationId
    const { volumeId, referencedVolumeId } = labelmapRepresentation;
    const actualVolumeId = volumeId || segmentationId;

    console.log(
      '[getVolumesFromSegmentation] volumeId:',
      volumeId,
      'referencedVolumeId:',
      referencedVolumeId,
      'actualVolumeId:',
      actualVolumeId
    );

    // Debug: Check what volumes are available in the cache
    const allVolumes = cache.getVolumes();
    console.log('[getVolumesFromSegmentation] All volumes in cache:', Object.keys(allVolumes));

    // Get the labelmap volume using the correct cache API
    let labelmapVolume = null;
    if (actualVolumeId) {
      try {
        labelmapVolume = cache.getVolume(actualVolumeId);
        console.log('[getVolumesFromSegmentation] Got labelmap volume from cache:', labelmapVolume);
      } catch (error) {
        console.log(
          '[getVolumesFromSegmentation] Failed to get labelmap volume from cache:',
          error
        );

        // Try using the segmentationId as volume ID if the first attempt failed
        if (actualVolumeId !== segmentationId) {
          try {
            labelmapVolume = cache.getVolume(segmentationId);
            console.log(
              '[getVolumesFromSegmentation] Got labelmap volume using segmentationId:',
              labelmapVolume
            );
          } catch (error2) {
            console.log(
              '[getVolumesFromSegmentation] Failed to get volume using segmentationId:',
              error2
            );
          }
        }

        // Try to find a volume that contains the segmentation ID in its name
        const possibleVolumeIds = Object.keys(allVolumes).filter(
          volumeId => volumeId.includes(segmentationId) || segmentationId.includes(volumeId)
        );
        console.log('[getVolumesFromSegmentation] Possible volume IDs:', possibleVolumeIds);

        if (possibleVolumeIds.length > 0) {
          try {
            labelmapVolume = cache.getVolume(possibleVolumeIds[0]);
            console.log(
              '[getVolumesFromSegmentation] Got labelmap volume using possible ID:',
              labelmapVolume
            );
          } catch (error3) {
            console.log(
              '[getVolumesFromSegmentation] Failed to get volume using possible ID:',
              error3
            );
          }
        }
      }
    }

    // Get the referenced volume
    let referencedVolume = null;
    if (referencedVolumeId) {
      try {
        referencedVolume = cache.getVolume(referencedVolumeId);
        console.log(
          '[getVolumesFromSegmentation] Got referenced volume from cache:',
          referencedVolume
        );
      } catch (error) {
        console.log(
          '[getVolumesFromSegmentation] Failed to get referenced volume from cache:',
          error
        );
      }
    }

    return { labelmapVolume, referencedVolume };
  } catch (error) {
    console.error('[getVolumesFromSegmentation] Error getting volumes:', error);
    return { labelmapVolume: null, referencedVolume: null };
  }
}

/**
 * Calculate updated statistics using the same approach as TMTV extension
 */
async function calculateUpdatedStatistics(
  segId: string,
  segmentation: any,
  updateSegment: any,
  segmentationService: any,
  activeSegmentIndex?: number
) {
  console.log('[calculateUpdatedStatistics] Calculating statistics for segmentation:', segId);

  try {
    // Use the same approach as TMTV extension
    const { labelmapVolume, referencedVolume } = getVolumesFromSegmentation(segId);

    if (!labelmapVolume) {
      console.log(
        '[calculateUpdatedStatistics] No labelmap volume found, trying segmentation service method...'
      );

      // Try the segmentation service method as fallback
      try {
        const serviceVolume = segmentationService.getLabelmapVolume(segId);
        if (serviceVolume) {
          console.log(
            '[calculateUpdatedStatistics] Got volume from segmentation service:',
            serviceVolume
          );
          return await processVolume(serviceVolume, segId, segmentation, updateSegment);
        }
      } catch (error) {
        console.log('[calculateUpdatedStatistics] Segmentation service method also failed:', error);
      }

      // Try alternative approach: use the segmentation's imageIds to create a simple statistics calculation
      console.log('[calculateUpdatedStatistics] Trying alternative approach with imageIds...');
      const labelmapData = segmentation.representationData?.[SegmentationRepresentations.Labelmap];
      if (labelmapData?.imageIds && labelmapData.imageIds.length > 0) {
        console.log(
          '[calculateUpdatedStatistics] Found imageIds, attempting to calculate statistics...'
        );
        return await calculateStatsFromImageIds(
          segId,
          segmentation,
          labelmapData,
          updateSegment,
          activeSegmentIndex,
          segmentationService
        );
      }

      console.log('[calculateUpdatedStatistics] No labelmap volume found for segmentation:', segId);
      return;
    }

    console.log('[calculateUpdatedStatistics] Successfully found labelmap volume:', labelmapVolume);
    return await processVolume(labelmapVolume, segId, segmentation, updateSegment);
  } catch (error) {
    console.error('[calculateUpdatedStatistics] Error calculating statistics:', error);
  }
}

/**
 * Process the labelmap volume to calculate statistics
 */
async function processVolume(
  labelmapVolume: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  console.log('[processVolume] Volume properties:', {
    volumeId: labelmapVolume.volumeId,
    dimensions: labelmapVolume.dimensions,
    spacing: labelmapVolume.spacing,
    hasVoxelManager: !!labelmapVolume.voxelManager,
    hasScalarData: !!labelmapVolume.scalarData,
  });

  const { voxelManager: segVoxelManager, imageData, spacing } = labelmapVolume;

  // Try voxelManager approach first (newer API)
  if (segVoxelManager) {
    console.log('[processVolume] Using voxelManager approach...');
    return processWithVoxelManager(
      segVoxelManager,
      imageData,
      spacing,
      segId,
      segmentation,
      updateSegment
    );
  }

  // Fall back to scalarData approach (older API)
  const scalarData = labelmapVolume.scalarData || labelmapVolume.getScalarData();
  if (scalarData) {
    console.log('[processVolume] Using scalarData approach...');
    return processWithScalarData(scalarData, spacing, segId, segmentation, updateSegment);
  }

  console.log('[processVolume] No voxel manager or scalar data available in labelmap volume');
}

/**
 * Process volume using voxelManager (newer API)
 */
function processWithVoxelManager(
  segVoxelManager: any,
  imageData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment using voxelManager.forEach
  const callback = ({ value, index }) => {
    if (value > 0) {
      // Skip background (0)
      segmentVoxelCounts[value] = (segmentVoxelCounts[value] || 0) + 1;
    }
  };

  segVoxelManager.forEach(callback, { imageData });

  console.log('[processWithVoxelManager] Voxel counts per segment:', segmentVoxelCounts);

  // Try to use enhanced OBB calculation if we have access to voxel data
  try {
    const dimensions = imageData?.getDimensions() || labelmapVolume?.dimensions;
    const voxelData = segVoxelManager;

    if (voxelData && dimensions) {
      return calculateAndUpdateStatsWithOBB(
        segmentVoxelCounts,
        spacing,
        segId,
        segmentation,
        updateSegment,
        voxelData,
        dimensions
      );
    }
  } catch (error) {
    console.log(
      '[processWithVoxelManager] Could not use OBB calculation, falling back to standard method:',
      error
    );
  }

  return calculateAndUpdateStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

/**
 * Process volume using scalarData (older API)
 */
function processWithScalarData(
  scalarData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment using direct scalarData access
  for (let i = 0; i < scalarData.length; i++) {
    const segmentIndex = scalarData[i];
    if (segmentIndex > 0) {
      // Skip background (0)
      segmentVoxelCounts[segmentIndex] = (segmentVoxelCounts[segmentIndex] || 0) + 1;
    }
  }

  console.log('[processWithScalarData] Voxel counts per segment:', segmentVoxelCounts);

  // Try to use enhanced OBB calculation if we have access to scalar data and dimensions
  try {
    // For scalar data, we need to infer dimensions from the data length and spacing
    // This is a simplified approach - in practice, dimensions should be provided
    const totalVoxels = scalarData.length;
    const voxelData = scalarData;

    // We would need proper dimensions here for accurate OBB calculation
    // For now, fall back to standard calculation
    console.log(
      '[processWithScalarData] Using standard calculation (dimensions not available for OBB)'
    );
  } catch (error) {
    console.log('[processWithScalarData] Could not use OBB calculation:', error);
  }

  return calculateAndUpdateStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

/**
 * Calculate statistics and update segments
 */
function calculateAndUpdateStats(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  // Calculate volume and diameter for each segment
  const voxelVolume = spacing[0] * spacing[1] * spacing[2]; // mm³

  Object.entries(segmentVoxelCounts).forEach(([segmentIndexStr, voxelCount]) => {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000; // Convert to cm³

    // Calculate diameter assuming spherical shape
    // Volume = (4/3) * π * r³, so r = ∛(3V/4π), diameter = 2r
    const radius = Math.pow((3 * volumeCm3) / (4 * Math.PI), 1 / 3);
    const sphericalDiameter = 2 * radius; // in cm

    console.log(
      `[calculateAndUpdateStats] Segment ${segmentIndex}: ${voxelCount} voxels, ${volumeMm3.toFixed(2)} mm³, ${(sphericalDiameter * 10).toFixed(2)} mm spherical diameter`
    );

    // Try to calculate more accurate diameters using OBB method
    const obbDiameters = null;
    try {
      // Create a mock lesion object for the computeDiameters function
      const mockLesion = {
        label: segmentIndex,
        coords: [], // This would need to be populated with actual coordinates
      };

      // For now, we'll use the spherical diameter as fallback
      // In a full implementation, you would extract the actual coordinates from the segmentation
      console.log(
        `[calculateAndUpdateStats] Using spherical diameter for segment ${segmentIndex} (OBB calculation requires coordinate extraction)`
      );
    } catch (error) {
      console.log(
        `[calculateAndUpdateStats] Could not calculate OBB diameters for segment ${segmentIndex}:`,
        error
      );
    }

    // Update segment cachedStats directly in the OHIF segmentation
    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      console.log(`[calculateAndUpdateStats] Updating segment ${segmentIndex} with new statistics`);

      // Update the cachedStats directly
      if (!segment.cachedStats) {
        segment.cachedStats = {};
      }

      // Use OBB diameters if available, otherwise use spherical diameter (all in mm)
      const sphericalDiameterMm = sphericalDiameter * 10; // Convert cm to mm
      const majorDiameterMm = obbDiameters?.major_axis_mm
        ? obbDiameters.major_axis_mm
        : sphericalDiameterMm;
      const minorDiameterMm = obbDiameters?.minor_axis_mm
        ? obbDiameters.minor_axis_mm
        : sphericalDiameterMm;

      // Update the cachedStats with real calculated values - create new object to trigger React updates
      segment.cachedStats = {
        ...segment.cachedStats,
        volume: volumeMm3, // Volume in mm³
        diameter: majorDiameterMm, // Use major diameter as the primary diameter in mm
        major_diameter: majorDiameterMm,
        minor_diameter: minorDiameterMm,
        axial_diameter: majorDiameterMm,
        coronal_diameter: majorDiameterMm,
        sagittal_diameter: majorDiameterMm,
        obb_method: obbDiameters ? 'obb' : 'spherical',
        obb_strategy: obbDiameters ? 'largest-area' : null,
      };

      // Force a re-render by updating the segmentation object reference
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(
        `[calculateAndUpdateStats] Updated segment ${segmentIndex} with immutable update`
      );

      console.log(
        `[calculateAndUpdateStats] Updated segment ${segmentIndex} cachedStats:`,
        segment.cachedStats
      );
    }
  });

  console.log('[calculateAndUpdateStats] Statistics calculation completed successfully');
}

/**
 * Calculate statistics from imageIds when volume data is not available
 */
async function calculateStatsFromImageIds(
  segId: string,
  segmentation: any,
  labelmapData: any,
  updateSegment: any,
  activeSegmentIndex?: number,
  segmentationService?: any
) {
  console.log('[calculateStatsFromImageIds] Calculating REAL statistics from imageIds...');
  console.log('[calculateStatsFromImageIds] Labelmap data:', labelmapData);
  console.log('[calculateStatsFromImageIds] Active segment index:', activeSegmentIndex);

  try {
    // Get the real volume statistics by accessing the labelmap data
    const realStats = await calculateRealVolumeStatistics(segId, labelmapData);

    if (!realStats) {
      console.log(
        '[calculateStatsFromImageIds] Failed to calculate real statistics, falling back to previous approach'
      );
      return;
    }

    console.log('[calculateStatsFromImageIds] Real statistics calculated:', realStats);

    // Only update the active segment if we know which one it is
    if (
      activeSegmentIndex &&
      segmentation.segments[activeSegmentIndex] &&
      realStats[activeSegmentIndex]
    ) {
      const segment = segmentation.segments[activeSegmentIndex];
      const stats = realStats[activeSegmentIndex];

      if (segment && segment.cachedStats) {
        console.log(
          `[calculateStatsFromImageIds] Updating active segment ${segment.segmentIndex} with REAL volume data`
        );

        // Update the cachedStats with real calculated values - create new object to trigger React updates
        segment.cachedStats = {
          ...segment.cachedStats,
          volume: stats.volumeMm3, // Volume in mm³
          diameter: stats.diameter * 10, // Diameter in mm
          axial_diameter: stats.diameter * 10,
          coronal_diameter: stats.diameter * 10,
          sagittal_diameter: stats.diameter * 10,
        };

        // Force a re-render by updating the segmentation object reference
        segmentation.segments = {
          ...segmentation.segments,
          [activeSegmentIndex]: {
            ...segment,
            cachedStats: segment.cachedStats,
          },
        };

        console.log(
          `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with immutable update`
        );

        console.log(
          `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with REAL data:`,
          {
            volume: stats.volumeMm3,
            diameter: stats.diameter * 10, // mm
            voxelCount: stats.voxelCount,
          }
        );
      }
    } else {
      console.log('[calculateStatsFromImageIds] Updating all segments with real volume data');

      // Update all segments with real data
      Object.entries(realStats).forEach(([segmentIndexStr, stats]) => {
        const segmentIndex = parseInt(segmentIndexStr);
        const segment = segmentation.segments[segmentIndex];

        if (segment && segment.cachedStats && stats) {
          console.log(
            `[calculateStatsFromImageIds] Updating segment ${segment.segmentIndex} with REAL volume data`
          );

          // Update the cachedStats with real calculated values - create new object to trigger React updates
          segment.cachedStats = {
            ...segment.cachedStats,
            volume: stats.volumeMm3, // Volume in mm³
            diameter: stats.diameter * 10, // Diameter in mm
            axial_diameter: stats.diameter * 10,
            coronal_diameter: stats.diameter * 10,
            sagittal_diameter: stats.diameter * 10,
          };

          // Force a re-render by updating the segmentation object reference
          segmentation.segments = {
            ...segmentation.segments,
            [segmentIndex]: {
              ...segment,
              cachedStats: segment.cachedStats,
            },
          };

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with immutable update`
          );

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with REAL data:`,
            {
              volume: stats.volumeMm3,
              diameter: stats.diameter * 10, // mm
              voxelCount: stats.voxelCount,
            }
          );
        }
      });
    }

    console.log('[calculateStatsFromImageIds] REAL statistics calculation completed successfully');

    // Trigger OHIF segmentation service update to ensure proper propagation
    try {
      console.log('[calculateStatsFromImageIds] Triggering segmentation service update...');

      // Update the segmentation in OHIF's segmentation service
      if (segmentationService) {
        // This will trigger the segmentation service to update and notify all subscribers
        segmentationService.addOrUpdateSegmentation({
          segmentationId: segId,
          config: {
            segments: Object.fromEntries(
              Object.entries(segmentation.segments).map(([key, segment]) => [
                key,
                {
                  color: segment.color,
                  visible: segment.visible,
                  locked: segment.locked || false,
                },
              ])
            ),
          },
        });

        console.log('[calculateStatsFromImageIds] Segmentation service updated successfully');
      }
    } catch (serviceError) {
      console.log(
        '[calculateStatsFromImageIds] Error updating segmentation service:',
        serviceError
      );
    }
  } catch (error) {
    console.error('[calculateStatsFromImageIds] Error calculating real statistics:', error);
  }
}

/**
 * Calculate real volume statistics from image data
 */
async function calculateRealVolumeStatistics(segId: string, labelmapData: any) {
  console.log('[calculateRealVolumeStatistics] Starting real volume calculation...');
  console.log('[calculateRealVolumeStatistics] Labelmap data:', labelmapData);

  try {
    // Get the cornerstone cache and tools
    const { cache } = cornerstone;
    const { segmentation: cstSegmentation } = cornerstoneTools;

    // First try to get the segmentation data directly from cornerstone tools
    const segmentationData = cstSegmentation.state.getSegmentation(segId);
    if (segmentationData && segmentationData.representationData) {
      console.log('[calculateRealVolumeStatistics] Found segmentation data:', segmentationData);

      // Try to process the volume data if available
      const labelmapData = segmentationData.representationData.LABELMAP;
      if (labelmapData && labelmapData.volumeId) {
        const volume = cache.getVolume(labelmapData.volumeId);
        if (volume) {
          console.log('[calculateRealVolumeStatistics] Using volume data for calculation');
          return await calculateStatsFromVolume(volume, segId);
        }
      }
    }

    // Fallback to image-based calculation
    const { imageIds } = labelmapData;

    if (!imageIds || imageIds.length === 0) {
      console.log('[calculateRealVolumeStatistics] No imageIds found in labelmap data');
      return null;
    }

    console.log(
      '[calculateRealVolumeStatistics] Found imageIds:',
      imageIds.length,
      '- using image-based calculation'
    );

    // Get spacing information from the first image
    const firstImageId = imageIds[0];
    const image = cache.getImage(firstImageId);

    if (!image) {
      console.log(
        '[calculateRealVolumeStatistics] Could not get image from cache for:',
        firstImageId
      );
      return null;
    }

    // Try to get more detailed metadata from the image
    const metadata = image.data || image;

    console.log('[calculateRealVolumeStatistics] Image metadata:', metadata);
    const pixelSpacingFromMetadata = metadata.pixelSpacing || metadata.PixelSpacing;
    const sliceThicknessFromMetadata =
      metadata.sliceThickness || metadata.SliceThickness || metadata.spacingBetweenSlices;

    console.log('[calculateRealVolumeStatistics] Image metadata:', {
      rows: image.rows,
      columns: image.columns,
      pixelSpacing: image.pixelSpacing,
      sliceThickness: image.sliceThickness,
      pixelSpacingFromMetadata: pixelSpacingFromMetadata,
      sliceThicknessFromMetadata: sliceThicknessFromMetadata,
      fullMetadata: metadata,
    });

    // Calculate voxel volume in mm³ - try to get real spacing values
    let pixelSpacing = image.pixelSpacing || pixelSpacingFromMetadata;
    let sliceThickness = image.sliceThickness || sliceThicknessFromMetadata;

    // If still no spacing, try to get from cornerstone cache metadata
    if (!pixelSpacing || !sliceThickness) {
      try {
        const { metaData } = cornerstone;
        const imagePlaneModule = metaData.get('imagePlaneModule', firstImageId);
        const pixelSpacingModule = metaData.get('pixelSpacingModule', firstImageId);

        if (imagePlaneModule && imagePlaneModule.pixelSpacing) {
          pixelSpacing = imagePlaneModule.pixelSpacing;
        }
        if (imagePlaneModule && imagePlaneModule.sliceThickness) {
          sliceThickness = imagePlaneModule.sliceThickness;
        }

        console.log('[calculateRealVolumeStatistics] Metadata from cornerstone:', {
          imagePlaneModule,
          pixelSpacingModule,
        });
      } catch (metadataError) {
        console.log(
          '[calculateRealVolumeStatistics] Could not get cornerstone metadata:',
          metadataError
        );
      }
    }

    console.log('[calculateRealVolumeStatistics] Pixel spacing:', pixelSpacing);
    console.log('[calculateRealVolumeStatistics] Slice thickness:', sliceThickness);

    // Final fallback to 1mm if still no spacing
    pixelSpacing = pixelSpacing || [1, 1];
    sliceThickness = sliceThickness || 2;

    const voxelVolumeMm3 = pixelSpacing[0] * pixelSpacing[1] * sliceThickness;

    console.log('[calculateRealVolumeStatistics] Voxel volume:', voxelVolumeMm3, 'mm³');

    // Count voxels for each segment
    const segmentStats = {};

    // Process each image slice
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];
      const image = cache.getImage(imageId);

      if (!image || !image.getPixelData) {
        console.log('[calculateRealVolumeStatistics] Skipping image without pixel data:', imageId);
        continue;
      }

      const pixelData = image.getPixelData();

      // Count pixels for each segment value
      for (let j = 0; j < pixelData.length; j++) {
        const segmentValue = pixelData[j];

        if (segmentValue > 0) {
          // Only count non-background pixels
          if (!segmentStats[segmentValue]) {
            segmentStats[segmentValue] = {
              voxelCount: 0,
              volumeMm3: 0,
              volumeCm3: 0,
              diameter: 0,
            };
          }
          segmentStats[segmentValue].voxelCount++;
        }
      }
    }

    // Calculate final statistics for each segment
    Object.keys(segmentStats).forEach(segmentValue => {
      const stats = segmentStats[segmentValue];

      // Calculate volume
      stats.volumeMm3 = stats.voxelCount * voxelVolumeMm3;
      stats.volumeCm3 = stats.volumeMm3 / 1000; // Convert mm³ to cm³

      // Calculate equivalent sphere diameter (in cm)
      // Volume = (4/3) * π * r³, so r = (3V/4π)^(1/3)
      // Diameter = 2r
      const radius = Math.pow((3 * stats.volumeCm3) / (4 * Math.PI), 1 / 3);
      stats.diameter = 2 * radius;

      console.log(`[calculateRealVolumeStatistics] Segment ${segmentValue} statistics:`, {
        voxelCount: stats.voxelCount,
        volumeMm3: stats.volumeMm3,
        volumeCm3: stats.volumeCm3,
        diameter: stats.diameter,
      });
    });

    console.log('[calculateRealVolumeStatistics] Final segment statistics:', segmentStats);
    return segmentStats;
  } catch (error) {
    console.error(
      '[calculateRealVolumeStatistics] Error calculating real volume statistics:',
      error
    );
    return null;
  }
}

/**
 * Calculate statistics from volume data (when available)
 */
async function calculateStatsFromVolume(volume: any, segId: string) {
  console.log('[calculateStatsFromVolume] Calculating from volume data...');

  try {
    const { scalarData, spacing, dimensions } = volume;

    if (!scalarData) {
      console.log('[calculateStatsFromVolume] No scalarData available');
      return null;
    }

    console.log('[calculateStatsFromVolume] Volume info:', {
      dimensions,
      spacing,
      dataLength: scalarData.length,
    });

    // Calculate voxel volume in mm³
    const voxelVolumeMm3 = spacing[0] * spacing[1] * spacing[2];
    console.log('[calculateStatsFromVolume] Voxel volume:', voxelVolumeMm3, 'mm³');

    // Count voxels for each segment
    const segmentStats = {};

    for (let i = 0; i < scalarData.length; i++) {
      const segmentValue = scalarData[i];

      if (segmentValue > 0) {
        // Only count non-background pixels
        if (!segmentStats[segmentValue]) {
          segmentStats[segmentValue] = {
            voxelCount: 0,
            volumeMm3: 0,
            volumeCm3: 0,
            diameter: 0,
          };
        }
        segmentStats[segmentValue].voxelCount++;
      }
    }

    // Calculate final statistics for each segment
    Object.keys(segmentStats).forEach(segmentValue => {
      const stats = segmentStats[segmentValue];

      // Calculate volume
      stats.volumeMm3 = stats.voxelCount * voxelVolumeMm3;
      stats.volumeCm3 = stats.volumeMm3 / 1000; // Convert mm³ to cm³

      // Calculate equivalent sphere diameter (in cm)
      const radius = Math.pow((3 * stats.volumeCm3) / (4 * Math.PI), 1 / 3);
      stats.diameter = 2 * radius;

      console.log(`[calculateStatsFromVolume] Segment ${segmentValue} statistics:`, {
        voxelCount: stats.voxelCount,
        volumeMm3: stats.volumeMm3,
        volumeCm3: stats.volumeCm3,
        diameter: stats.diameter,
      });
    });

    return segmentStats;
  } catch (error) {
    console.error('[calculateStatsFromVolume] Error calculating volume statistics:', error);
    return null;
  }
}
