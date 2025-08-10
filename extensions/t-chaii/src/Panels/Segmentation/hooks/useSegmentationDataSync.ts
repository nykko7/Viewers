import { useEffect } from 'react';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { cache, metaData, utilities } from '@cornerstonejs/core';
import { segmentation as cstSegmentation, Enums as cstEnums } from '@cornerstonejs/tools';
import { calculateOBBDiameters } from '../utils/obbCalculation';

const { SegmentationRepresentations } = cstEnums;

// Types
interface SegmentStats {
  voxelCount: number;
  volume: number; // Volume in mL
  diameter: number; // Diameter in mm
  majorAxisMm?: number;
  minorAxisMm?: number;
  // Enhanced OBB properties
  maxDiameter?: number; // in mm
  minDiameter?: number; // in mm
  maxDiameterSlice?: number;
  minDiameterSlice?: number;
  majorAxis?: [{ x: number; y: number }, { x: number; y: number }];
  minorAxis?: [{ x: number; y: number }, { x: number; y: number }];
  sliceResults?: any[];
}

type SegmentStatsMap = Record<string, SegmentStats>;

interface UseSegmentationDataSyncProps {
  servicesManager: any;
  subscribeToDataModified?: boolean;
  // Debounce time (ms) specifically for triggering heavy OBB calculations
  obbDebounceMs?: number;
}

// Global timeout declaration
declare global {
  interface Window {
    segmentationUpdateTimeout: any;
    // Map of segmentationId -> (segmentIndex -> timeoutId)
    obbCalcTimers?: Record<string, Record<number, any>>;
    // Track if we have completed the initial full-stats computation per segmentation
    segmentationInitComputed?: Record<string, boolean>;
  }
}

// Main hook
export function useSegmentationDataSync({
  servicesManager,
  subscribeToDataModified = false,
  obbDebounceMs = 300,
}: UseSegmentationDataSyncProps) {
  const updateSegment = useSegmentationsStore(state => state.updateSegment);
  const getStudies = useSegmentationsStore(state => state.getStudies);

  useEffect(() => {
    console.log('🚀 [useSegmentationDataSync] useEffect triggered!', {
      subscribeToDataModified,
      hasServicesManager: !!servicesManager,
    });

    if (!subscribeToDataModified) {
      console.log('[useSegmentationDataSync] subscribeToDataModified is false, not subscribing');
      return;
    }

    const { segmentationService } = servicesManager.services;

    const unsubscribe = segmentationService.subscribe(
      segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED,
      (evt: any) => {
        console.log('[useSegmentationDataSync] SEGMENTATION_DATA_MODIFIED event received:', evt);

        // Debounce updates (reduced timeout for more responsive UI)
        clearTimeout(window.segmentationUpdateTimeout);
        window.segmentationUpdateTimeout = setTimeout(() => {
          // Get current store state instead of using closure
          const currentState = useSegmentationsStore.getState();
          const currentStudies = currentState.getStudies();
          const currentUpdateSegment = currentState.updateSegment;
          handleSegmentationDataModified(
            evt,
            currentStudies,
            currentUpdateSegment,
            segmentationService,
            obbDebounceMs
          );
        }, 50); // Reduced from 500ms to 50ms for immediate responsiveness
      }
    );

    console.log('[useSegmentationDataSync] Subscription set up successfully');

    return () => {
      console.log('[useSegmentationDataSync] Cleaning up subscription');
      unsubscribe();
      clearTimeout(window.segmentationUpdateTimeout);
    };
  }, [subscribeToDataModified, updateSegment, getStudies, servicesManager]);
}

// Handle segmentation data modified event
async function handleSegmentationDataModified(
  evt: any,
  studies: any,
  updateSegment: any,
  segmentationService: any,
  obbDebounceMs: number
) {
  console.log('[handleSegmentationDataModified] Processing event:', evt);

  const segmentationId = evt.detail?.segmentationId || evt.segmentationId;
  if (!segmentationId) {
    console.log('[handleSegmentationDataModified] No segmentationId found in event');
    return;
  }

  console.log('[handleSegmentationDataModified] Processing segmentation:', segmentationId);

  // Get the segmentation directly from the segmentation service (like in the original code)
  const segmentation = segmentationService.getSegmentation(segmentationId);
  if (!segmentation) {
    console.log(
      '[handleSegmentationDataModified] Segmentation not found in service:',
      segmentationId
    );
    return;
  }

  console.log('[handleSegmentationDataModified] Found segmentation:', segmentation);

  // Get active segment index by searching through segments
  let activeSegmentIndex;
  const activeSegment = Object.values(segmentation.segments || {}).find(
    (segment: any) => segment.active
  );
  activeSegmentIndex = activeSegment?.segmentIndex;
  console.log(
    '[handleSegmentationDataModified] Active segment index from segmentation data:',
    activeSegmentIndex
  );

  await calculateUpdatedStatistics(
    segmentationId,
    segmentation,
    updateSegment,
    segmentationService,
    activeSegmentIndex,
    obbDebounceMs
  );
}

// Get volumes from segmentation
function getVolumesFromSegmentation(segmentationId: string) {
  console.log('[getVolumesFromSegmentation] Getting volumes for segmentationId:', segmentationId);

  try {
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

    // Get the volume ID from the labelmap - check for different possible properties
    const volumeId =
      (labelmapRepresentation as any)?.volumeId || (labelmapRepresentation as any)?.imageIds;
    const _referencedVolumeId = (labelmapRepresentation as any)?.referencedVolumeId;
    const actualVolumeId = volumeId || segmentationId;

    console.log(
      '[getVolumesFromSegmentation] volumeId:',
      volumeId,
      'referencedVolumeId:',
      _referencedVolumeId,
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
    if (_referencedVolumeId) {
      try {
        referencedVolume = cache.getVolume(_referencedVolumeId);
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

// Calculate updated statistics
async function calculateUpdatedStatistics(
  segId: string,
  segmentation: any,
  updateSegment: any,
  segmentationService: any,
  activeSegmentIndex?: number,
  obbDebounceMs: number = 300
) {
  console.log('[calculateUpdatedStatistics] Calculating statistics for segmentation:', segId);

  try {
    // Determine if this is the initial full computation for this segmentation
    if (!window.segmentationInitComputed) {
      window.segmentationInitComputed = {};
    }
    const isInitialFullCompute = window.segmentationInitComputed[segId] !== true;

    const { labelmapVolume } = getVolumesFromSegmentation(segId);

    if (!labelmapVolume) {
      console.log(
        '[calculateUpdatedStatistics] No labelmap volume found, trying alternative method...'
      );

      // Use the labelmap data from the segmentation representation
      const labelmapData = segmentation.representationData?.[SegmentationRepresentations.Labelmap];
      if (labelmapData?.imageIds && labelmapData.imageIds.length > 0) {
        console.log(
          '[calculateUpdatedStatistics] Found imageIds, attempting to calculate statistics...'
        );
        const result = await calculateStatsFromImageIds(
          segId,
          segmentation,
          labelmapData,
          updateSegment,
          activeSegmentIndex,
          segmentationService,
          obbDebounceMs,
          isInitialFullCompute
        );
        // Mark initial compute as done
        if (isInitialFullCompute) {
          window.segmentationInitComputed[segId] = true;
        }
        return result;
      }

      console.log(
        '[calculateUpdatedStatistics] No labelmap volume or imageIds found for segmentation:',
        segId
      );
      return;
    }

    console.log('[calculateUpdatedStatistics] Successfully found labelmap volume:', labelmapVolume);
    return await processVolume(labelmapVolume, segId, segmentation, updateSegment);
  } catch (error) {
    console.error('[calculateUpdatedStatistics] Error calculating statistics:', error);
  }
}

// Process the labelmap volume to calculate statistics
async function processVolume(
  labelmapVolume: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  console.log('[processVolume] Processing volume:', {
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
    return await processWithVoxelManager(
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

// Process volume using voxelManager (newer API)
async function processWithVoxelManager(
  segVoxelManager: any,
  imageData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment
  const callback = ({ value, index }) => {
    if (value > 0) {
      segmentVoxelCounts[value] = (segmentVoxelCounts[value] || 0) + 1;
    }
  };

  segVoxelManager.forEach(callback, { imageData });

  console.log('[processWithVoxelManager] Segment voxel counts:', segmentVoxelCounts);

  // Try enhanced calculation with OBB if possible
  try {
    const voxelData = segVoxelManager.getCompleteScalarDataArray?.();
    const dimensions = imageData?.getDimensions?.();

    if (voxelData && dimensions && Object.keys(segmentVoxelCounts).length > 0) {
      console.log('🔍 [STATS UPDATE] Using enhanced OBB calculation...');
      return await calculateStatsWithOBB(
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
      '[processWithVoxelManager] Could not use OBB calculation, using standard method:',
      error
    );
  }

  return calculateBasicStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

// Process volume using scalarData (older API)
function processWithScalarData(
  scalarData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment
  for (let i = 0; i < scalarData.length; i++) {
    const segmentIndex = scalarData[i];
    if (segmentIndex > 0) {
      segmentVoxelCounts[segmentIndex] = (segmentVoxelCounts[segmentIndex] || 0) + 1;
    }
  }

  console.log('[processWithScalarData] Segment voxel counts:', segmentVoxelCounts);
  return calculateBasicStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

// Calculate basic statistics (volume and spherical diameter)
function calculateBasicStats(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  _segId: string,
  segmentation: any,
  _updateSegment: any
) {
  const voxelVolume = spacing[0] * spacing[1] * spacing[2]; // mm³

  Object.entries(segmentVoxelCounts).forEach(([segmentIndexStr, voxelCount]) => {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000;

    // Calculate spherical diameter (assuming spherical lesion)
    const radius = Math.pow((3 * volumeMm3) / (4 * Math.PI), 1 / 3);
    const diameter = 2 * radius;

    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      segment.cachedStats = {
        ...segment.cachedStats,
        voxelCount,
        volume: volumeCm3, // Store volume in mL (same as volumeCm3)
        volumeMm3,
        volumeCm3,
        diameter,
      };

      // Update segmentation with new reference for reactivity
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(`[calculateBasicStats] Updated segment ${segmentIndex} with basic stats`);
    }
  });

  console.log('[calculateBasicStats] Statistics calculation completed');
}

// Enhanced calculation with OBB diameter calculation
async function calculateStatsWithOBB(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  _segId: string,
  segmentation: any,
  _updateSegment: any,
  voxelData?: any,
  dimensions?: number[]
) {
  console.log('🎯 [calculateStatsWithOBB] Starting enhanced OBB calculation...');

  const voxelVolume = spacing[0] * spacing[1] * spacing[2];

  // Try to load OpenCV for advanced diameter calculation
  const openCV = await loadOpenCV();
  const useOpenCV = !!openCV;

  console.log(`[calculateStatsWithOBB] OpenCV available: ${useOpenCV}`);

  for (const [segmentIndexStr, voxelCount] of Object.entries(segmentVoxelCounts)) {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000;

    // Calculate spherical diameter as fallback
    const radius = Math.pow((3 * volumeMm3) / (4 * Math.PI), 1 / 3);
    const sphericalDiameter = 2 * radius;

    let majorAxisMm = sphericalDiameter;
    let minorAxisMm = sphericalDiameter;

    // Try OBB calculation if OpenCV is available and we have the necessary data
    if (useOpenCV && voxelData && dimensions) {
      try {
        // Use the new OBB-based diameter calculation with OpenCV
        const obbResult = await computeDiametersWithOpenCV(
          voxelData,
          segmentIndex,
          dimensions,
          spacing,
          openCV
        );
        if (obbResult && obbResult.majorAxisMm > 0) {
          majorAxisMm = obbResult.majorAxisMm;
          minorAxisMm = obbResult.minorAxisMm;
          console.log(
            `[calculateStatsWithOBB] OBB calculation successful for segment ${segmentIndex}: major=${majorAxisMm.toFixed(2)}mm, minor=${minorAxisMm.toFixed(2)}mm, slice=${obbResult.majorAxisSlice}`
          );
        }
      } catch (error) {
        console.log(
          `[calculateStatsWithOBB] OBB calculation failed for segment ${segmentIndex}:`,
          error
        );
      }
    }

    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      segment.cachedStats = {
        ...segment.cachedStats,
        voxelCount,
        volume: volumeCm3, // Store volume in mL (same as volumeCm3)
        volumeMm3,
        volumeCm3,
        diameter: Math.max(majorAxisMm, minorAxisMm), // Use the larger diameter
        majorAxisMm,
        minorAxisMm,
      };

      // Update segmentation with new reference for reactivity
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(
        `[calculateStatsWithOBB] Updated segment ${segmentIndex} with ${useOpenCV ? 'OBB' : 'spherical'} diameters`
      );
    }
  }

  console.log('[calculateStatsWithOBB] Statistics calculation completed');
}

// Compute diameters using OpenCV with OBB method and 'largest-area' strategy
async function computeDiametersWithOpenCV(
  segmentVoxelData: any,
  segmentIndex: number,
  dimensions: number[],
  spacing: number[],
  cv: any
): Promise<any> {
  console.log('[computeDiametersWithOpenCV] Starting OBB-based diameter calculation...');
  console.log('[computeDiametersWithOpenCV] Segment index:', segmentIndex);
  console.log('[computeDiametersWithOpenCV] Dimensions:', dimensions);
  console.log('[computeDiametersWithOpenCV] Spacing:', spacing);

  if (!segmentVoxelData || !dimensions || dimensions.length < 3) {
    console.log('[computeDiametersWithOpenCV] Invalid input data');
    return { majorAxisMm: 0, minorAxisMm: 0, majorAxisSlice: -1 };
  }

  try {
    const [width, height, depth] = dimensions;
    const groupedMaxDiameters: { [key: string]: number } = {};
    const groupedMinDiameters: { [key: string]: number } = {};

    // Process each slice (z-direction)
    for (let z = 0; z < depth; z++) {
      // Create binary mask for current slice
      const sliceMask = new Uint8Array(width * height);
      let hasSegmentPixels = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = z * width * height + y * width + x;
          if (segmentVoxelData[index] === segmentIndex) {
            sliceMask[y * width + x] = 255;
            hasSegmentPixels = true;
          }
        }
      }

      if (!hasSegmentPixels) {
        continue; // Skip slices without segment pixels
      }

      try {
        // Create OpenCV Mat from slice mask
        const mat = new cv.Mat(height, width, cv.CV_8UC1);
        mat.data.set(sliceMask);

        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(mat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        if (contours.size() === 0) {
          mat.delete();
          contours.delete();
          hierarchy.delete();
          continue;
        }

        let majorLength = 0;
        let minorLength = 0;

        // Apply 'largest-area' strategy
        if (contours.size() === 1) {
          // Single contour case
          const contour = contours.get(0);
          const rotatedRect = cv.minAreaRect(contour);
          const width_px = rotatedRect.size.width;
          const height_px = rotatedRect.size.height;

          majorLength = Math.max(width_px, height_px) * spacing[1]; // Use row spacing
          minorLength = Math.min(width_px, height_px) * spacing[1];
        } else {
          // Multiple contours - find largest by area
          let largestContour = null;
          let maxArea = 0;

          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            if (area > maxArea) {
              maxArea = area;
              largestContour = contour;
            }
          }

          if (largestContour) {
            const rotatedRect = cv.minAreaRect(largestContour);
            const width_px = rotatedRect.size.width;
            const height_px = rotatedRect.size.height;

            majorLength = Math.max(width_px, height_px) * spacing[1];
            minorLength = Math.min(width_px, height_px) * spacing[1];
          }
        }

        if (majorLength > 0) {
          groupedMaxDiameters[z.toString()] = majorLength;
          groupedMinDiameters[z.toString()] = minorLength;
          console.log(
            `[computeDiametersWithOpenCV] Slice ${z}: major=${majorLength.toFixed(2)}mm, minor=${minorLength.toFixed(2)}mm`
          );
        }

        // Clean up OpenCV objects
        mat.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.log(`[computeDiametersWithOpenCV] Error processing slice ${z}:`, error);
      }
    }

    // Find the slice with the maximum major axis
    if (Object.keys(groupedMaxDiameters).length === 0) {
      console.log('[computeDiametersWithOpenCV] No valid measurements found');
      return { majorAxisMm: 0, minorAxisMm: 0, majorAxisSlice: -1 };
    }

    const majorAxisSliceIdx = Object.keys(groupedMaxDiameters).reduce((a, b) =>
      groupedMaxDiameters[a] > groupedMaxDiameters[b] ? a : b
    );

    const majorAxisMm = groupedMaxDiameters[majorAxisSliceIdx];
    const minorAxisMm = groupedMinDiameters[majorAxisSliceIdx];
    const majorAxisSlice = parseInt(majorAxisSliceIdx);

    console.log(
      `[computeDiametersWithOpenCV] Final result - Slice: ${majorAxisSlice}, Major: ${majorAxisMm.toFixed(2)}mm, Minor: ${minorAxisMm.toFixed(2)}mm`
    );

    return {
      majorAxisMm,
      minorAxisMm,
      majorAxisSlice,
    };
  } catch (error) {
    console.error('[computeDiametersWithOpenCV] Error in OBB diameter calculation:', error);
    return { majorAxisMm: 0, minorAxisMm: 0, majorAxisSlice: -1 };
  }
}

// Calculate statistics from imageIds when volume data is not available
async function calculateStatsFromImageIds(
  segId: string,
  segmentation: any,
  labelmapData: any,
  updateSegment: any,
  activeSegmentIndex?: number,
  segmentationService?: any,
  obbDebounceMs: number = 300,
  isInitialFullCompute: boolean = false
) {
  console.log('[calculateStatsFromImageIds] Calculating statistics from imageIds...');

  try {
    const realStats = await calculateRealVolumeStatistics(
      segId,
      labelmapData,
      obbDebounceMs,
      activeSegmentIndex,
      isInitialFullCompute
    );

    if (realStats && Object.keys(realStats).length > 0) {
      // Update segments with real statistics
      Object.entries(realStats).forEach(([segmentIndexStr, stats]) => {
        const segmentIndex = parseInt(segmentIndexStr);
        const segment = segmentation.segments[segmentIndex];

        if (segment) {
          // Transform internal SegmentStats format to SegmentStatsType format for UI
          const transformedStats = {
            volume: stats.volume, // Use mL as the single volume unit
            diameter: stats.diameter, // Already in mm
            affected_organs: segment.cachedStats?.affected_organs || '',
            lession_classification: segment.cachedStats?.lession_classification || '',
            lession_type: segment.cachedStats?.lession_type || '',
          };

          // Create a completely new cachedStats object to trigger React re-render
          const newCachedStats = {
            ...segment.cachedStats,
            ...transformedStats,
          };

          // Create a new segment object with updated cachedStats
          const updatedSegment = {
            ...segment,
            cachedStats: newCachedStats,
          };

          // Update the segment directly in the segmentation object that the UI reads from
          segment.cachedStats = newCachedStats;

          // CRITICAL: Call updateSegment to trigger store update and UI re-render
          if (updateSegment && typeof updateSegment === 'function') {
            updateSegment(updatedSegment);
            console.log(
              `[calculateStatsFromImageIds] Called updateSegment for segment ${segmentIndex} to trigger UI update`
            );
          } else {
            console.warn(
              `[calculateStatsFromImageIds] updateSegment function not available for segment ${segmentIndex}`
            );
          }

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segmentIndex} with volume: ${newCachedStats.volume} mL`
          );

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segmentIndex} cachedStats:`,
            newCachedStats
          );
        }
      });

      // CRITICAL: Update the segmentation through the service to trigger UI refresh
      // This will automatically trigger the SEGMENTATION_DATA_MODIFIED event that useActiveViewportSegmentationRepresentations listens to
      if (
        segmentationService &&
        typeof segmentationService.addOrUpdateSegmentation === 'function'
      ) {
        try {
          // Update the segmentation through the service once after all segments are updated
          segmentationService.addOrUpdateSegmentation(segmentation);
          console.log(
            `[calculateStatsFromImageIds] Updated segmentation through service to trigger UI refresh`
          );
        } catch (error) {
          console.warn(
            `[calculateStatsFromImageIds] Could not update segmentation through service:`,
            error
          );
        }
      } else {
        console.warn(
          `[calculateStatsFromImageIds] segmentationService.addOrUpdateSegmentation not available`
        );
      }

      console.log(
        '[calculateStatsFromImageIds] Segmentation data updated, forced viewport refresh'
      );

      console.log('[calculateStatsFromImageIds] Updated segments with real statistics');
    }
  } catch (error) {
    console.error('[calculateStatsFromImageIds] Error calculating statistics:', error);
  }
}

// Calculate real volume statistics from image data
async function calculateRealVolumeStatistics(
  segId: string,
  labelmapData: any,
  obbDebounceMs: number = 300,
  activeSegmentIndex?: number,
  isInitialFullCompute: boolean = false
): Promise<SegmentStatsMap | null> {
  console.log('[calculateRealVolumeStatistics] Starting real volume calculation...');
  console.log('[calculateRealVolumeStatistics] Labelmap data:', labelmapData);

  try {
    // First try to get the segmentation data directly from cornerstone tools
    const segmentationData = cstSegmentation.state.getSegmentation(segId);
    if (segmentationData && segmentationData.representationData) {
      console.log('[calculateRealVolumeStatistics] Found segmentation data:', segmentationData);

      // Try to process the volume data if available
      const labelmapRepresentation =
        segmentationData.representationData[SegmentationRepresentations.Labelmap];
      if (labelmapRepresentation && (labelmapRepresentation as any).volumeId) {
        try {
          const volume = cache.getVolume((labelmapRepresentation as any).volumeId);
          if (volume) {
            console.log('[calculateRealVolumeStatistics] Using volume data for calculation');
            return await calculateStatsFromVolume(volume, segId);
          }
        } catch (error) {
          console.log('[calculateRealVolumeStatistics] Could not get volume from cache:', error);
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

    // Use proper Cornerstone3D approach to get spacing
    let pixelSpacing: number[] = [1, 1]; // default
    let sliceThickness: number = 1; // default

    try {
      // Get spacing information
      const { zSpacing } = utilities.sortImageIdsAndGetSpacing(imageIds);
      if (zSpacing && zSpacing > 0) {
        sliceThickness = Math.abs(zSpacing);
        console.log(
          '[calculateRealVolumeStatistics] Got slice spacing from utility:',
          sliceThickness
        );
      }

      // Get pixel spacing from imagePlaneModule
      const firstImageId = imageIds[0];
      const imagePlaneModule = metaData.get('imagePlaneModule', firstImageId);
      if (imagePlaneModule?.pixelSpacing) {
        pixelSpacing = imagePlaneModule.pixelSpacing;
        console.log('[calculateRealVolumeStatistics] Got pixel spacing:', pixelSpacing);
      }
    } catch (error) {
      console.log(
        '[calculateRealVolumeStatistics] Could not get spacing info, using defaults:',
        error
      );
    }

    console.log('[calculateRealVolumeStatistics] Final spacing values:', {
      pixelSpacing,
      sliceThickness,
    });

    const voxelVolumeMm3 = pixelSpacing[0] * pixelSpacing[1] * sliceThickness;
    console.log('[calculateRealVolumeStatistics] Voxel volume:', voxelVolumeMm3, 'mm³');

    // Count voxels for each segment by processing each image slice
    const segmentStats: SegmentStatsMap = {};

    // Process each image slice to count voxels
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];

      try {
        const image = cache.getImage(imageId);

        if (!image || !image.getPixelData) {
          console.log(
            '[calculateRealVolumeStatistics] Skipping image without pixel data:',
            imageId
          );
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
                volume: 0,
                diameter: 0,
              };
            }
            segmentStats[segmentValue].voxelCount++;
          }
        }
      } catch (error) {
        console.log(`[calculateRealVolumeStatistics] Error processing image ${i}:`, error);
        continue;
      }
    }

    // Calculate final statistics for each segment
    const finalStats: SegmentStatsMap = {};

    for (const segmentValue of Object.keys(segmentStats)) {
      const stats = segmentStats[segmentValue];
      const segmentIndex = parseInt(segmentValue);

      // If not initial compute, only process active segment to avoid freezing
      if (!isInitialFullCompute && activeSegmentIndex != null && segmentIndex !== activeSegmentIndex) {
        continue;
      }

      // Calculate volume in mL (convert from mm³)
      stats.volume = (stats.voxelCount * voxelVolumeMm3) / 1000;

      // Don't calculate spherical diameter - only use OBB calculation
      // Keep existing diameter if it exists and is reasonable, otherwise set to null
      if (!stats.diameter || stats.diameter < 1 || stats.diameter > 1000) {
        stats.diameter = null; // Will be set by OBB calculation
      }

      // Mark as calculating for loading indicator
      (stats as any).isCalculating = true;
      console.log(
        `[DEBUG] Segment ${segmentIndex} should show loading indicator (isCalculating: true)`
      );
      console.log(
        `[DEBUG] Segment ${segmentIndex} current diameter: ${stats.diameter?.toFixed(2) || 'null'}mm (waiting for OBB calculation)`
      );

      // Debounced async OBB calculation per segmentation and segment
      if (!window.obbCalcTimers) {
        window.obbCalcTimers = {};
      }
      if (!window.obbCalcTimers[segId]) {
        window.obbCalcTimers[segId] = {} as Record<number, any>;
      }

      const segTimers = window.obbCalcTimers[segId];
      if (segTimers[segmentIndex]) {
        clearTimeout(segTimers[segmentIndex]);
      }

      segTimers[segmentIndex] = setTimeout(async () => {
        try {
          console.log(`[OBB] Starting OBB calculation for segment ${segmentIndex}`);

          // Get image dimensions
          const firstImage = cache.getImage(imageIds[0]);
          if (!firstImage) {
            throw new Error('Could not get first image for dimensions');
          }

          const width = firstImage.width || firstImage.columns || 0;
          const height = firstImage.height || firstImage.rows || 0;
          const depth = imageIds.length;

          if (width === 0 || height === 0) {
            throw new Error('Invalid image dimensions');
          }

          // Reconstruct 3D volume data
          const segmentVoxelData = new Uint8Array(width * height * depth);

          // Fill with segment data from each slice
          for (let z = 0; z < imageIds.length; z++) {
            try {
              const image = cache.getImage(imageIds[z]);
              if (image && image.getPixelData) {
                const pixelData = image.getPixelData();
                const sliceOffset = z * width * height;

                for (let i = 0; i < pixelData.length && i < width * height; i++) {
                  segmentVoxelData[sliceOffset + i] = pixelData[i];
                }
              }

              // Yield every 20 slices to prevent blocking
              if (z % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            } catch (error) {
              console.warn(`[OBB] Error processing slice ${z}:`, error);
            }
          }

          console.log(
            `[OBB] Reconstructed volume for segment ${segmentIndex}: ${width}x${height}x${depth}`
          );

          // Calculate OBB diameters
          const obbResult = calculateOBBDiameters(
            segmentVoxelData,
            segmentIndex,
            [width, height, depth],
            [pixelSpacing[0], pixelSpacing[1], sliceThickness]
          );

          // Update segment with OBB results
          const updatedSegmentation = cstSegmentation.state.getSegmentation(segId);
          if (updatedSegmentation && updatedSegmentation.segments[segmentIndex]) {
            const segment = updatedSegmentation.segments[segmentIndex];
            if (segment.cachedStats) {
              // Store OBB results
              segment.cachedStats.maxDiameter = obbResult.maxDiameter;
              segment.cachedStats.minDiameter = obbResult.minDiameter;
              segment.cachedStats.maxDiameterSlice = obbResult.maxDiameterSlice;
              segment.cachedStats.minDiameterSlice = obbResult.minDiameterSlice;

              console.log(`[OBB] Stored OBB results in cached stats:`, {
                maxDiameter: obbResult.maxDiameter,
                minDiameter: obbResult.minDiameter,
                maxDiameterSlice: obbResult.maxDiameterSlice,
                minDiameterSlice: obbResult.minDiameterSlice,
                hasPixelCoords: !!(
                  obbResult.overallMajorAxisPixels && obbResult.overallMinorAxisPixels
                ),
              });
              // Store coordinate data for measurement creation
              segment.cachedStats.overallMajorAxis = obbResult.overallMajorAxis;
              segment.cachedStats.overallMinorAxis = obbResult.overallMinorAxis;
              // Store pixel coordinates for proper measurement positioning
              segment.cachedStats.overallMajorAxisPixels = obbResult.overallMajorAxisPixels;
              segment.cachedStats.overallMinorAxisPixels = obbResult.overallMinorAxisPixels;

              // Always use OBB diameter (no spherical fallback)
              if (obbResult.maxDiameter > 0 && obbResult.maxDiameter < 1000) {
                segment.cachedStats.diameter = obbResult.maxDiameter;
                console.log(
                  `[OBB] Updated segment ${segmentIndex} diameter to OBB: ${obbResult.maxDiameter.toFixed(2)}mm`
                );
              } else {
                console.log(
                  `[OBB] Invalid OBB diameter for segment ${segmentIndex}: ${obbResult.maxDiameter.toFixed(2)}mm - keeping existing value`
                );
              }

              // Remove calculating flag
              delete (segment.cachedStats as any).isCalculating;

              // DO NOT UPDATE ZUSTAND STORE - This causes data corruption!
              // The OBB results should only be stored in Cornerstone segmentation object
              // to avoid contaminating the shared studies data across different study contexts.
              console.log(
                `[OBB] Skipping store update to prevent data corruption - OBB result stored in Cornerstone only`
              );

              // Note: The EditLesionDialog should read OBB results from Cornerstone segmentation
              // instead of from the studies data to get the correct, context-specific values.

              // Dispatch UI update event
              const event = new CustomEvent('segmentation-stats-updated', {
                detail: { segmentationId: segId, segmentIndex, stats: segment.cachedStats },
              });
              window.dispatchEvent(event);
              console.log(`[OBB] Dispatched UI update for segment ${segmentIndex}`);
            }
          }
        } catch (error) {
          console.error(`[OBB] Error in OBB calculation for segment ${segmentIndex}:`, error);

          // Remove calculating flag and keep spherical diameter
          const updatedSegmentation = cstSegmentation.state.getSegmentation(segId);
          if (updatedSegmentation && updatedSegmentation.segments[segmentIndex]) {
            const segment = updatedSegmentation.segments[segmentIndex];
            if (segment.cachedStats) {
              delete (segment.cachedStats as any).isCalculating;

              // Dispatch UI update event even on error
              const event = new CustomEvent('segmentation-stats-updated', {
                detail: { segmentationId: segId, segmentIndex, stats: segment.cachedStats },
              });
              window.dispatchEvent(event);
            }
          }
        }
      }, obbDebounceMs);

      console.log(`[calculateRealVolumeStatistics] Segment ${segmentValue} final statistics:`, {
        voxelCount: stats.voxelCount,
        volume: stats.volume,
        diameter: stats.diameter,
        isCalculating: (stats as any).isCalculating,
        segmentIndex: segmentIndex,
      });

      // Debug: Log which segment should show loading indicator
      if ((stats as any).isCalculating) {
        console.log(
          `[DEBUG] Segment ${segmentIndex} should show loading indicator (isCalculating: true)`
        );
      }

      finalStats[segmentValue] = stats;
    }

    console.log('[calculateRealVolumeStatistics] Final segment statistics:', finalStats);

    console.log('[calculateRealVolumeStatistics] Completed image-based calculation');
    return finalStats;
  } catch (error) {
    console.error(
      '[calculateRealVolumeStatistics] Error calculating real volume statistics:',
      error
    );
    return null;
  }
}

// Calculate statistics from volume data (when available)
async function calculateStatsFromVolume(
  volume: any,
  _segId: string
): Promise<SegmentStatsMap | null> {
  console.log('[calculateStatsFromVolume] Calculating statistics from volume data');

  try {
    const stats: SegmentStatsMap = {};

    // This would use the volume processing logic similar to processVolume
    // For now, return empty stats as this is a fallback case
    console.log('[calculateStatsFromVolume] Volume-based calculation not fully implemented');

    return stats;
  } catch (error) {
    console.error('[calculateStatsFromVolume] Error calculating volume statistics:', error);
    return null;
  }
}
