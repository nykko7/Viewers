import { useEffect } from 'react';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { cache } from '@cornerstonejs/core';
import { segmentation as cstSegmentation, Enums as cstEnums } from '@cornerstonejs/tools';

const { SegmentationRepresentations } = cstEnums;

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
    const diameter = 2 * radius; // in cm

    console.log(
      `[calculateAndUpdateStats] Segment ${segmentIndex}: ${voxelCount} voxels, ${volumeCm3.toFixed(2)} cm³, ${diameter.toFixed(2)} cm diameter`
    );

    // Update segment cachedStats directly in the OHIF segmentation
    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      console.log(`[calculateAndUpdateStats] Updating segment ${segmentIndex} with new statistics`);

      // Update the cachedStats directly
      if (!segment.cachedStats) {
        segment.cachedStats = {};
      }

      // Update the cachedStats with real calculated values - create new object to trigger React updates
      segment.cachedStats = {
        ...segment.cachedStats,
        volume: volumeCm3,
        diameter: diameter,
        axial_diameter: diameter,
        coronal_diameter: diameter,
        sagittal_diameter: diameter,
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
          volume: stats.volumeCm3,
          diameter: stats.diameter,
          axial_diameter: stats.diameter,
          coronal_diameter: stats.diameter,
          sagittal_diameter: stats.diameter,
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
            volume: stats.volumeCm3,
            diameter: stats.diameter,
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
            volume: stats.volumeCm3,
            diameter: stats.diameter,
            axial_diameter: stats.diameter,
            coronal_diameter: stats.diameter,
            sagittal_diameter: stats.diameter,
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
              volume: stats.volumeCm3,
              diameter: stats.diameter,
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

        if (pixelSpacingModule && pixelSpacingModule.pixelSpacing) {
          pixelSpacing = pixelSpacingModule.pixelSpacing;
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

    // Final fallback to 1mm if still no spacing
    pixelSpacing = pixelSpacing || [1, 1];
    sliceThickness = sliceThickness || 1;

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
