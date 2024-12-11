import { Segment, Segmentation } from '@cornerstonejs/tools/types';
import { eventTarget, Enums, triggerEvent } from '@cornerstonejs/core';
import * as cs from '@cornerstonejs/core';
import * as csTools from '@cornerstonejs/tools';

export interface SegmentStats {
  diameter: number;
  volume: number;
  affectedOrgan: string;
}

// function getVolumesFromSegmentation(segmentationId) {
//   segmentationService.getLabelmapVolume(segmentationId)

//   return { labelmapVolume, referencedVolume };
// }

// function getLabelmapVolumeFromSegmentation(segmentation) {
//   const { representationData } = segmentation;
//   const { volumeId } = representationData[
//     csTools.Enums.SegmentationRepresentations.Labelmap
//   ] as csTools.Types.LabelmapToolOperationDataVolume;

//   return cs.cache.getVolume(volumeId);
// }

export const updateSegmentationInfo = async ({
  segmentationId,
  commandsManager,
  segmentationService,
}: withAppTypes<{
  segmentationId: string;
}>) => {
  const segmentation = segmentationService.getSegmentation(segmentationId);
  if (!segmentation) return;

  triggerEvent(eventTarget, Enums.Events.WEB_WORKER_PROGRESS, {
    progress: 0,
    type: 'Calculate Segment Stats',
    id: segmentationId,
  });

  // Get the labelmap volume for calculations
  const labelmapVolume = segmentationService.getLabelmapVolume(segmentationId);
  const { imageData, spacing } = labelmapVolume;
  const scalarData = imageData.getPointData().getScalars().getData();

  // Update each segment with additional info
  for (const [segmentIndex, segment] of Object.entries(segmentation.segments)) {
    if (!segment) continue;

    const numericSegmentIndex = Number(segmentIndex);
    let voxelCount = 0;
    let maxDiameter = 0;

    // Calculate volume by counting voxels
    for (let i = 0; i < scalarData.length; i++) {
      if (scalarData[i] === numericSegmentIndex) {
        voxelCount++;
      }
    }

    // Calculate volume in mL (cubic millimeters to milliliters)
    const volumeInMl = voxelCount * spacing[0] * spacing[1] * spacing[2] * 1e-3;

    // Calculate approximate diameter (assuming roughly spherical shape)
    // Volume = (4/3)πr³, solve for diameter = 2r
    const radius = Math.pow((3 * volumeInMl) / (4 * Math.PI), 1 / 3);
    const diameterInMm = 2 * radius * 10; // Convert to mm

    const additionalStats = {
      diameter: parseFloat(diameterInMm.toFixed(1)), // mm
      volume: parseFloat(volumeInMl.toFixed(1)), // mL
      affectedOrgan: 'Unknown',
    };

    // Update the segment's cached stats
    const updatedSegment: Segment = {
      ...segment,
      cachedStats: {
        ...segment.cachedStats,
        ...additionalStats,
      },
    };

    segmentation.segments[segmentIndex] = updatedSegment;
  }

  // Update the segmentation object
  const updatedSegmentation: Segmentation = {
    ...segmentation,
    segments: {
      ...segmentation.segments,
    },
  };

  triggerEvent(eventTarget, Enums.Events.WEB_WORKER_PROGRESS, {
    progress: 100,
    type: 'Calculate Segment Stats',
    id: segmentationId,
  });

  // Update the segmentation in the service
  segmentationService.addOrUpdateSegmentation(updatedSegmentation);
};
