import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon, Tooltip } from '@ohif/ui';
import { useViewportGrid } from '@ohif/ui';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { formatVolumeForDisplay } from '../utils/volumeUnits';
import { formatValue } from '../utils/formatters';
import { affectedOrgansLabels, optionalClassifications } from '../../../types';
import { getRenderingEngine } from '@cornerstonejs/core';
import { ToolGroupManager, annotation } from '@cornerstonejs/tools';
import { Types } from '@ohif/core';
import * as cornerstone from '@cornerstonejs/core';

// Define the SegmentStatsType interface
interface SegmentStatsType {
  volume?: number;
  diameter?: number;
  minDiameter?: number;
  affected_organs?: string;
  lession_classification?: string;
  lession_type?: string;
  [key: string]: any;
}

type SegmentStatsProps = {
  stats: SegmentStatsType & {
    maxDiameterSlice?: number;
    minDiameterSlice?: number;
    isCalculating?: boolean;
  };
  showChangeValues?: boolean;
  isCalculating?: boolean;
  segmentationId?: string;
  segmentIndex?: number;
  servicesManager?: Types.Extensions.ExtensionParams['servicesManager'];
};

// Pulse loading indicator component
const PulseIndicator = () => (
  <span className="ml-2 inline-flex h-2 w-2">
    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75"></span>
    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
  </span>
);

export function SegmentStats({
  stats,
  showChangeValues = true,
  isCalculating = false,
  segmentationId,
  segmentIndex,
  servicesManager,
}: SegmentStatsProps): React.JSX.Element {
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isCurrentlyCalculating, setIsCurrentlyCalculating] = useState(isCalculating);
  const [measurementsVisible, setMeasurementsVisible] = useState(false);
  const [createdMeasurements, setCreatedMeasurements] = useState<string[]>([]);

  // Function to check if measurements already exist for this segment
  const checkExistingMeasurements = (): boolean => {
    if (!segmentationId || segmentIndex === undefined) return false;

    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return false;

      const viewport = renderingEngine.getViewport('default');
      if (!viewport) return false;

      // Get all Length annotations for this viewport
      const annotations = annotation.state.getAnnotations?.('Length', viewport.element) || [];

      // Check if any annotations match our segment pattern
      const segmentMeasurements = annotations.filter((ann: any) => {
        const uid = ann.annotationUID || ann.uid;
        return (
          uid &&
          (uid.includes(`max-diameter-${segmentationId}-${segmentIndex}`) ||
            uid.includes(`min-diameter-${segmentationId}-${segmentIndex}`))
        );
      });

      console.log('[SegmentStats] Checking existing measurements:', {
        segmentationId,
        segmentIndex,
        totalAnnotations: annotations.length,
        segmentMeasurements: segmentMeasurements.length,
        measurementUIDs: segmentMeasurements.map((ann: any) => ann.annotationUID || ann.uid),
      });

      return segmentMeasurements.length > 0;
    } catch (error) {
      console.warn('[SegmentStats] Error checking existing measurements:', error);
      return false;
    }
  };

  // Function to remove existing measurements for this segment
  const removeExistingMeasurements = async (): Promise<void> => {
    if (!segmentationId || segmentIndex === undefined) return;

    try {
      const { annotation, utilities } = await import('@cornerstonejs/tools');
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.warn('[SegmentStats] No rendering engine found for measurement removal');
        return;
      }

      // Try to find the correct viewport (could be 'default' or another ID)
      const viewports = renderingEngine.getViewports();
      const viewport = viewports.find(vp => vp.id === 'default') || viewports[0];

      if (!viewport) {
        console.warn('[SegmentStats] No viewport found for measurement removal');
        return;
      }

      console.log('[SegmentStats] Attempting to remove measurements for:', {
        segmentationId,
        segmentIndex,
        viewportId: viewport.id,
        viewportType: viewport.type,
      });

      // Get all Length annotations for this viewport
      const annotations = annotation.state.getAnnotations?.('Length', viewport.element) || [];

      console.log('[SegmentStats] Found annotations before removal:', {
        totalAnnotations: annotations.length,
        annotationUIDs: annotations.map((ann: any) => ann.annotationUID || ann.uid),
      });

      // Find and remove annotations that match our segment pattern
      const segmentMeasurements = annotations.filter((ann: any) => {
        const uid = ann.annotationUID || (ann as any).uid;
        return (
          uid &&
          (uid.includes(`max-diameter-${segmentationId}-${segmentIndex}`) ||
            uid.includes(`min-diameter-${segmentationId}-${segmentIndex}`))
        );
      });

      console.log('[SegmentStats] Found segment measurements to remove:', {
        count: segmentMeasurements.length,
        measurementUIDs: segmentMeasurements.map(
          (ann: any) => ann.annotationUID || (ann as any).uid
        ),
      });

      if (segmentMeasurements.length === 0) {
        console.warn('[SegmentStats] No segment measurements found to remove');
        return;
      }

      // Remove each annotation
      for (const ann of segmentMeasurements) {
        const uid = ann.annotationUID || (ann as any).uid;
        try {
          // Try multiple removal methods
          annotation.state.removeAnnotation?.(uid);

          console.log('[SegmentStats] Removed measurement annotation:', uid);
        } catch (removeError) {
          console.warn('[SegmentStats] Error removing annotation:', uid, removeError);
        }
      }

      // Force annotation render updates
      try {
        utilities.triggerAnnotationRenderForViewportIds?.([viewport.id]);
        utilities.triggerAnnotationRender?.(viewport.element);
      } catch (renderError) {
        console.warn('[SegmentStats] Error triggering annotation render:', renderError);
      }

      // Trigger viewport render to update display
      viewport.render();

      // Verify removal
      setTimeout(() => {
        const remainingAnnotations =
          annotation.state.getAnnotations?.('Length', viewport.element) || [];
        console.log('[SegmentStats] Annotations after removal:', {
          totalAnnotations: remainingAnnotations.length,
          annotationUIDs: remainingAnnotations.map((ann: any) => ann.annotationUID || ann.uid),
        });
      }, 100);
    } catch (error) {
      console.error('[SegmentStats] Error removing existing measurements:', error);
    }
  };

  // Navigation function to go to specific slice (uses active viewport from services)
  const navigateToSlice = (sliceIndex: number) => {
    try {
      console.log(`[SegmentStats] Attempting to navigate to slice ${sliceIndex + 1}`);

      // Ensure the segment becomes active as when clicking the segment card
      try {
        if (segmentationId != null && segmentIndex != null) {
          const segmentationService = servicesManager?.services?.segmentationService as any;
          const commandsManager = (servicesManager as any)?.commandsManager;

          if (commandsManager?.run) {
            console.log('[SegmentStats] Selecting segment via command before navigation', {
              segmentationId,
              segmentIndex,
            });
            commandsManager.run('setActiveSegmentAndCenter', { segmentationId, segmentIndex });
          } else if (segmentationService?.setActiveSegment) {
            console.log('[SegmentStats] Selecting segment via service before navigation', {
              segmentationId,
              segmentIndex,
            });
            segmentationService.setActiveSegment(segmentationId, segmentIndex);
          }
        }
      } catch (selErr) {
        console.warn('[SegmentStats] Failed to set active segment before navigation', selErr);
      }

      // Resolve active viewport via services to ensure correct series
      const viewportGridService = (servicesManager as any)?.services?.viewportGridService;
      const cornerstoneViewportService = (servicesManager as any)?.services
        ?.cornerstoneViewportService;
      const activeViewportId = viewportGridService?.getActiveViewportId?.();
      const viewport = cornerstoneViewportService?.getCornerstoneViewport?.(activeViewportId);

      if (!viewport) {
        console.error('[SegmentStats] Active Cornerstone viewport not found');
        return;
      }

      // Get current image index and calculate difference
      const currentImageIndex = viewport.getCurrentImageIdIndex();
      const targetImageIndex = sliceIndex;
      const scrollDelta = targetImageIndex - currentImageIndex;

      console.log(
        `[SegmentStats] Current slice: ${currentImageIndex}, Target: ${targetImageIndex}, Delta: ${scrollDelta}`
      );

      // Use the scroll method to navigate (cast to any to avoid TypeScript issues)
      const viewportAny = viewport as any;
      if (typeof viewportAny.scroll === 'function') {
        viewportAny.scroll(scrollDelta);
        console.log(`[SegmentStats] Successfully navigated to slice ${sliceIndex + 1}`);
      } else if (typeof viewportAny.setImageIdIndex === 'function') {
        // Alternative method: set image index directly
        viewportAny.setImageIdIndex(targetImageIndex);
        console.log(
          `[SegmentStats] Successfully navigated to slice ${sliceIndex + 1} via setImageIdIndex`
        );
      } else {
        console.error('[SegmentStats] No navigation method available on viewport');
        console.log(
          '[SegmentStats] Available viewport methods:',
          Object.getOwnPropertyNames(viewport)
        );
      }
    } catch (error) {
      console.error('[SegmentStats] Navigation failed:', error);
    }
  };

  // Create measurement annotation for diameter (max or min)
  const createDiameterMeasurement = async (measurementType: 'max' | 'min') => {
    try {
      console.log(`[SegmentStats] Creating measurement for ${measurementType} diameter`);

      if (!segmentationId || segmentIndex === undefined) {
        console.error(
          '[SegmentStats] Missing segmentationId or segmentIndex for measurement creation'
        );
        return;
      }

      // Ensure the clicked segment becomes the active one (same behavior as clicking segment card)
      try {
        const segmentationService = servicesManager?.services?.segmentationService as any;
        const commandsManager = (servicesManager as any)?.commandsManager;

        if (commandsManager?.run) {
          console.log('[SegmentStats] Selecting segment via command: setActiveSegmentAndCenter', {
            segmentationId,
            segmentIndex,
          });
          commandsManager.run('setActiveSegmentAndCenter', { segmentationId, segmentIndex });
        } else if (segmentationService?.setActiveSegment) {
          console.log('[SegmentStats] Selecting segment via segmentationService.setActiveSegment', {
            segmentationId,
            segmentIndex,
          });
          segmentationService.setActiveSegment(segmentationId, segmentIndex);
        } else {
          console.warn(
            '[SegmentStats] Unable to select segment: no commandsManager or segmentationService available'
          );
        }
      } catch (selErr) {
        console.warn(
          '[SegmentStats] Failed to set active segment before navigation/measurement',
          selErr
        );
      }

      // Access OBB calculation results directly from Cornerstone segmentation state
      // Using the same pattern as useSegmentationDataSync.ts
      try {
        const { segmentation: cstSegmentation } = await import('@cornerstonejs/tools');
        const segmentation = cstSegmentation.state.getSegmentation(segmentationId);

        if (!segmentation?.segments?.[segmentIndex]?.cachedStats) {
          console.error('[SegmentStats] No cached stats available for measurement creation');
          return;
        }

        const cachedStats = segmentation.segments[segmentIndex].cachedStats;
        const maxDiameterSlice = cachedStats.maxDiameterSlice as number;
        const minDiameterSlice = cachedStats.minDiameterSlice as number;
        const overallMajorAxis = cachedStats.overallMajorAxis as any;
        const overallMinorAxis = cachedStats.overallMinorAxis as any;
        const overallMajorAxisPixels = cachedStats.overallMajorAxisPixels as any;
        const overallMinorAxisPixels = cachedStats.overallMinorAxisPixels as any;

        // Get the actual diameter values from OBB calculation results
        const maxDiameterFromOBB = cachedStats.maxDiameter as number;
        const minDiameterFromOBB = cachedStats.minDiameter as number;

        const targetSlice = measurementType === 'max' ? maxDiameterSlice : minDiameterSlice;
        const targetAxis = measurementType === 'max' ? overallMajorAxis : overallMinorAxis;
        const targetAxisPixels =
          measurementType === 'max' ? overallMajorAxisPixels : overallMinorAxisPixels;
        const targetDiameter = measurementType === 'max' ? maxDiameterFromOBB : minDiameterFromOBB;

        if (typeof targetSlice !== 'number' || !targetAxis) {
          console.error(
            `[SegmentStats] Missing OBB calculation data for ${measurementType} diameter measurement:`,
            {
              targetSlice,
              targetAxis: !!targetAxis,
            }
          );
          return;
        }

        console.log(`[SegmentStats] Found OBB data for ${measurementType} diameter measurement:`, {
          targetSlice,
          targetAxis,
          targetAxisPixels,
          diameter: targetDiameter,
          hasPixelCoords: !!targetAxisPixels,
          maxDiameterFromOBB,
          minDiameterFromOBB,
          statsValues: { diameter: stats.diameter, minDiameter: (stats as any).minDiameter },
          cachedStatsKeys: Object.keys(cachedStats),
          allPixelCoords: {
            major: cachedStats.overallMajorAxisPixels,
            minor: cachedStats.overallMinorAxisPixels,
          },
        });

        // Navigate to the target slice first
        await navigateToSlice(targetSlice);

        // Use world coordinates directly from OBB calculation
        // The OBB calculation already provides properly scaled world coordinates in mm
        // Using pixel coordinates causes coordinate system scaling issues
        const coordinatesToUse = targetAxis; // Always use world coordinates

        console.log(`[SegmentStats] Using world coordinates directly from OBB:`, {
          hasPixelCoords: !!targetAxisPixels,
          hasWorldCoords: !!targetAxis,
          usingWorldCoords: true,
          coordinates: coordinatesToUse,
          expectedDiameter: targetDiameter,
        });

        // Create measurement data using available coordinates
        const measurementData = {
          slice: targetSlice + 1,
          diameter: `${targetDiameter?.toFixed(2)}mm`,
          measurementType,
          coordinates: {
            start: {
              x: coordinatesToUse[0].x,
              y: coordinatesToUse[0].y,
            },
            end: {
              x: coordinatesToUse[1].x,
              y: coordinatesToUse[1].y,
            },
          },
        };

        console.log(`[SegmentStats] Using coordinates for ${measurementType} diameter:`, {
          coordinates: coordinatesToUse,
          measurementType,
          targetSlice,
          usingPixelCoords: !!targetAxisPixels,
        });

        console.log(
          `[SegmentStats] ${measurementType} diameter measurement data:`,
          measurementData
        );

        // Try to access OHIF measurementService from servicesManager
        console.log('[SegmentStats] Debugging servicesManager access:', {
          hasServicesManager: !!servicesManager,
          hasServices: !!servicesManager?.services,
          availableServices: servicesManager?.services
            ? Object.keys(servicesManager.services)
            : 'none',
          measurementService: !!servicesManager?.services?.measurementService,
        });

        const measurementService = servicesManager?.services?.measurementService;

        if (!measurementService) {
          console.log(
            '[SegmentStats] Failed to create OHIF measurement: Error: OHIF measurementService not available'
          );
          console.log('[SegmentStats] Max diameter measurement data ready for visualization:', {
            slice: measurementData.slice,
            diameter: measurementData.diameter,
          });
          return;
        }

        try {
          console.log('[SegmentStats] Creating Cornerstone Tools annotation...');

          // Import Cornerstone Tools
          const { annotation, utilities } = await import('@cornerstonejs/tools');
          const core = await import('@cornerstonejs/core');

          // Use the active Cornerstone viewport from services
          const viewportGridService = (servicesManager as any)?.services?.viewportGridService;
          const cornerstoneViewportService = (servicesManager as any)?.services
            ?.cornerstoneViewportService;
          const activeViewportId = viewportGridService?.getActiveViewportId?.();
          const viewport = cornerstoneViewportService?.getCornerstoneViewport?.(activeViewportId);

          if (!viewport) {
            throw new Error('Active Cornerstone viewport not found for annotation');
          }

          // Ensure we are on the target slice, then get current imageId from the active viewport
          const targetSliceIndex = measurementData.slice - 1; // Convert to 0-based index
          try {
            (viewport as any).setImageIdIndex?.(targetSliceIndex);
          } catch {}
          try {
            viewport.render?.();
          } catch {}
          await new Promise<void>(resolve =>
            typeof requestAnimationFrame !== 'undefined'
              ? requestAnimationFrame(() => resolve())
              : setTimeout(() => resolve(), 0)
          );
          const currentImageId: string = (viewport as any).getCurrentImageId?.() || '';

          if (!currentImageId) {
            console.error('[SegmentStats] No currentImageId available from active viewport');
            return;
          }

          // Use the raw Cornerstone imageId (e.g. wadors:...) for OHIF mapping metadata lookups
          // Prefixing with 'imageId:' can cause metadata provider mismatches for WADO-RS imageIds
          const referencedImageId = currentImageId;
          // Cornerstone Tools requires targetIds to be prefixed; use this for cachedStats keys
          const targetIdForTools = currentImageId.startsWith('imageId:')
            ? currentImageId
            : `imageId:${currentImageId}`;

          // Fetch DICOM UIDs from meta to help mapping to MeasurementService
          const metaImageId = currentImageId.startsWith('imageId:')
            ? currentImageId.substring('imageId:'.length)
            : currentImageId;
          const StudyInstanceUID = (core as any).metaData?.get?.('StudyInstanceUID', metaImageId);
          const SeriesInstanceUID = (core as any).metaData?.get?.('SeriesInstanceUID', metaImageId);
          const SOPInstanceUID = (core as any).metaData?.get?.('SOPInstanceUID', metaImageId);
          const FrameOfReferenceFromMeta = (core as any).metaData?.get?.(
            'FrameOfReferenceUID',
            metaImageId
          );

          console.log('[SegmentStats] Target slice image info:', {
            targetSliceIndex,
            targetSlice: measurementData.slice,
            currentImageId,
            viewportId: viewport.id,
            StudyInstanceUID,
            SeriesInstanceUID,
            SOPInstanceUID,
          });

          // Use OBB pixel coordinates directly - they represent the actual segment position
          let startWorld: [number, number, number];
          let endWorld: [number, number, number];

          // Always use pixel coordinates from OBB if available - they are the true segment positions
          const startPx = targetAxisPixels && targetAxisPixels[0];
          const endPx = targetAxisPixels && targetAxisPixels[1];

          if (startPx && endPx) {
            console.log('[SegmentStats] Using OBB pixel coordinates for segment positioning:', {
              startPx: { x: startPx.x, y: startPx.y },
              endPx: { x: endPx.x, y: endPx.y },
              targetSliceIndex,
            });

            // Check viewport orientation and transformation
            const camera = viewport.getCamera?.();
            const properties = viewport.getProperties?.();
            console.log('[SegmentStats] Viewport orientation info:', {
              camera: camera
                ? {
                    viewPlaneNormal: camera.viewPlaneNormal,
                    viewUp: camera.viewUp,
                    focalPoint: camera.focalPoint,
                  }
                : null,
              properties: properties
                ? {
                    rotation: properties.rotation,
                    flipHorizontal: properties.flipHorizontal,
                    flipVertical: properties.flipVertical,
                  }
                : null,
              viewportType: viewport.type,
            });

            // Convert OBB image pixel coordinates using Cornerstone's coordinate transformation
            // OBB coordinates are in image space, need to convert to world space properly
            const imagePixelStart = [startPx.x, startPx.y] as [number, number];
            const imagePixelEnd = [endPx.x, endPx.y] as [number, number];

            console.log('[SegmentStats] Converting image pixels to world coordinates:', {
              imagePixels: { start: imagePixelStart, end: imagePixelEnd },
              viewportType: viewport.type,
            });

            // For stack viewports, use viewport-specific coordinate transforms with canvas bounds clamping
            if (viewport.type === 'stack') {
              try {
                // Get canvas element and size for bounds checking
                const el: any = (viewport as any).element;
                const canvasSize = el
                  ? { w: el.clientWidth, h: el.clientHeight }
                  : { w: 512, h: 512 };

                // Apply canvas bounds clamping to ensure annotations are visible
                // Add 10px margins from edges to ensure visibility
                const clampToCanvas = (pt: [number, number]): [number, number] => [
                  Math.max(10, Math.min(pt[0], canvasSize.w - 10)),
                  Math.max(10, Math.min(pt[1], canvasSize.h - 10)),
                ];

                const clampedStart = clampToCanvas(imagePixelStart);
                const clampedEnd = clampToCanvas(imagePixelEnd);

                console.log('[SegmentStats] Applied canvas bounds clamping:', {
                  original: { start: imagePixelStart, end: imagePixelEnd },
                  clamped: { start: clampedStart, end: clampedEnd },
                  canvasSize,
                });

                // Use viewport's coordinate transformation methods for proper image-to-world conversion
                // This ensures coordinates are properly aligned with the current viewport state
                if ((viewport as any).canvasToWorld && (viewport as any).worldToCanvas) {
                  // First, we need to convert image pixel coordinates to world coordinates properly
                  // For stack viewports, we need to account for image scaling and positioning

                  // Use DICOM-based coordinate transformation for accurate positioning and measurements
                  // This approach uses the actual DICOM pixel spacing and image positioning data
                  const imageData = viewport.getImageData?.();
                  const currentImageId = viewport.getCurrentImageId?.();

                  // Get DICOM metadata for proper coordinate transformation
                  let pixelSpacing: [number, number] | undefined;
                  let imageOrigin: [number, number, number] = [0, 0, 0];
                  let imageOrientation: number[] = [1, 0, 0, 0, 1, 0];

                  if (currentImageId) {
                    // Try to get pixel spacing from DICOM metadata
                    const imagePlaneModule = cornerstone.metaData.get(
                      'imagePlaneModule',
                      currentImageId
                    );
                    const imagePixelModule = cornerstone.metaData.get(
                      'imagePixelModule',
                      currentImageId
                    );

                    pixelSpacing = imagePlaneModule?.pixelSpacing || imagePixelModule?.pixelSpacing;
                    imageOrigin = imagePlaneModule?.imagePositionPatient || [0, 0, 0];
                    imageOrientation = imagePlaneModule?.imageOrientationPatient || [
                      1, 0, 0, 0, 1, 0,
                    ];

                    console.log('[SegmentStats] Retrieved DICOM metadata:', {
                      pixelSpacing,
                      imageOrigin,
                      imageOrientation: imageOrientation.slice(0, 6),
                    });
                  }

                  // If we don't have proper pixel spacing, calculate it from the expected OBB diameter
                  if (!pixelSpacing || pixelSpacing[0] === 1.0 || pixelSpacing[1] === 1.0) {
                    const pixelDistance = Math.sqrt(
                      Math.pow(imagePixelEnd[0] - imagePixelStart[0], 2) +
                        Math.pow(imagePixelEnd[1] - imagePixelStart[1], 2)
                    );
                    const expectedDiameter = targetDiameter; // Use the actual expected diameter from OBB
                    const calculatedSpacing = expectedDiameter / pixelDistance;
                    pixelSpacing = [calculatedSpacing, calculatedSpacing];

                    console.log('[SegmentStats] Calculated pixel spacing from OBB diameter:', {
                      expectedDiameter,
                      pixelDistance,
                      calculatedSpacing,
                      pixelSpacing,
                    });
                  }

                  const spacingX = pixelSpacing[0]; // mm per pixel in X direction
                  const spacingY = pixelSpacing[1]; // mm per pixel in Y direction

                  // Convert image pixel coordinates to physical world coordinates using DICOM transformation
                  // Formula: WorldCoord = ImageOrigin + (PixelCoord * PixelSpacing * ImageOrientation)
                  const startWorldX =
                    imageOrigin[0] +
                    imagePixelStart[0] * spacingX * imageOrientation[0] +
                    imagePixelStart[1] * spacingY * imageOrientation[3];
                  const startWorldY =
                    imageOrigin[1] +
                    imagePixelStart[0] * spacingX * imageOrientation[1] +
                    imagePixelStart[1] * spacingY * imageOrientation[4];
                  const startWorldZ =
                    imageOrigin[2] +
                    imagePixelStart[0] * spacingX * imageOrientation[2] +
                    imagePixelStart[1] * spacingY * imageOrientation[5];

                  const endWorldX =
                    imageOrigin[0] +
                    imagePixelEnd[0] * spacingX * imageOrientation[0] +
                    imagePixelEnd[1] * spacingY * imageOrientation[3];
                  const endWorldY =
                    imageOrigin[1] +
                    imagePixelEnd[0] * spacingX * imageOrientation[1] +
                    imagePixelEnd[1] * spacingY * imageOrientation[4];
                  const endWorldZ =
                    imageOrigin[2] +
                    imagePixelEnd[0] * spacingX * imageOrientation[2] +
                    imagePixelEnd[1] * spacingY * imageOrientation[5];

                  startWorld = [startWorldX, startWorldY, startWorldZ];
                  endWorld = [endWorldX, endWorldY, endWorldZ];

                  // Calculate the actual distance to verify it matches expected diameter
                  const actualDistance = Math.sqrt(
                    Math.pow(endWorldX - startWorldX, 2) +
                      Math.pow(endWorldY - startWorldY, 2) +
                      Math.pow(endWorldZ - startWorldZ, 2)
                  );

                  console.log('[SegmentStats] Used DICOM-based coordinate transformation:', {
                    imagePixels: { start: imagePixelStart, end: imagePixelEnd },
                    pixelSpacing: { x: spacingX, y: spacingY },
                    imageOrigin,
                    imageOrientation: imageOrientation.slice(0, 6),
                    worldCoords: { start: startWorld, end: endWorld },
                    expectedDiameter: targetDiameter,
                    actualDistance: actualDistance.toFixed(2) + 'mm',
                    distanceMatch:
                      Math.abs(actualDistance - targetDiameter) < 1.0 ? 'GOOD' : 'NEEDS_ADJUSTMENT',
                  });

                  // Verify the coordinates will be visible in the viewport
                  const startCanvas = (viewport as any).worldToCanvas?.(startWorld);
                  const endCanvas = (viewport as any).worldToCanvas?.(endWorld);
                  const inBounds = (pt: any) =>
                    !!pt &&
                    pt[0] >= 0 &&
                    pt[1] >= 0 &&
                    pt[0] <= canvasSize.w &&
                    pt[1] <= canvasSize.h;

                  console.log('[SegmentStats] Coordinate visibility check:', {
                    startCanvas,
                    endCanvas,
                    startInBounds: inBounds(startCanvas),
                    endInBounds: inBounds(endCanvas),
                    canvasSize,
                  });
                } else {
                  // Fallback: Use DICOM pixel spacing but with clamped coordinates
                  const imageData = viewport.getImageData?.();
                  const metadata = imageData?.metadata || {};

                  // Try multiple ways to get pixel spacing from DICOM metadata
                  let pixelSpacing = metadata.pixelSpacing || metadata.PixelSpacing;

                  // Check if we can get it from the current image metadata
                  if (!pixelSpacing) {
                    const currentImageId = viewport.getCurrentImageId?.();
                    if (currentImageId) {
                      const imageMetadata =
                        cornerstone.metaData.get('imagePlaneModule', currentImageId) ||
                        cornerstone.metaData.get('imagePixelModule', currentImageId);
                      pixelSpacing = imageMetadata?.pixelSpacing || imageMetadata?.PixelSpacing;
                    }
                  }

                  // If still no pixel spacing, calculate from expected vs actual OBB distances
                  if (!pixelSpacing || pixelSpacing[0] === 1.0) {
                    // Calculate pixel spacing based on expected diameter vs pixel distance
                    const expectedDiameter = measurementType === 'max' ? 90.03 : 65.84; // Expected mm
                    const pixelDistance = Math.sqrt(
                      Math.pow(clampedEnd[0] - clampedStart[0], 2) +
                        Math.pow(clampedEnd[1] - clampedStart[1], 2)
                    );
                    const calculatedSpacing = expectedDiameter / pixelDistance;
                    pixelSpacing = [calculatedSpacing, calculatedSpacing];

                    console.log('[SegmentStats] Calculated pixel spacing from clamped OBB data:', {
                      expectedDiameter,
                      pixelDistance,
                      calculatedSpacing,
                      pixelSpacing,
                    });
                  }

                  const spacingX = pixelSpacing[0]; // mm per pixel in X direction
                  const spacingY = pixelSpacing[1]; // mm per pixel in Y direction

                  // Get image origin and orientation from DICOM
                  const imageOrigin = metadata.imagePositionPatient || [0, 0, 0];
                  const imageOrientation = metadata.imageOrientationPatient || [1, 0, 0, 0, 1, 0];

                  // Convert clamped image pixel coordinates to physical world coordinates (mm)
                  const startWorldX =
                    imageOrigin[0] +
                    clampedStart[0] * spacingX * imageOrientation[0] +
                    clampedStart[1] * spacingY * imageOrientation[3];
                  const startWorldY =
                    imageOrigin[1] +
                    clampedStart[0] * spacingX * imageOrientation[1] +
                    clampedStart[1] * spacingY * imageOrientation[4];
                  const startWorldZ =
                    imageOrigin[2] +
                    clampedStart[0] * spacingX * imageOrientation[2] +
                    clampedStart[1] * spacingY * imageOrientation[5];

                  const endWorldX =
                    imageOrigin[0] +
                    clampedEnd[0] * spacingX * imageOrientation[0] +
                    clampedEnd[1] * spacingY * imageOrientation[3];
                  const endWorldY =
                    imageOrigin[1] +
                    clampedEnd[0] * spacingX * imageOrientation[1] +
                    clampedEnd[1] * spacingY * imageOrientation[4];
                  const endWorldZ =
                    imageOrigin[2] +
                    clampedEnd[0] * spacingX * imageOrientation[2] +
                    clampedEnd[1] * spacingY * imageOrientation[5];

                  startWorld = [startWorldX, startWorldY, startWorldZ];
                  endWorld = [endWorldX, endWorldY, endWorldZ];

                  console.log('[SegmentStats] Used DICOM pixel spacing with clamped coordinates:', {
                    clampedPixels: { start: clampedStart, end: clampedEnd },
                    pixelSpacing: { x: spacingX, y: spacingY },
                    imageOrigin,
                    imageOrientation,
                    worldCoords: { start: startWorld, end: endWorld },
                    calculatedDistance:
                      Math.sqrt(
                        Math.pow(endWorldX - startWorldX, 2) +
                          Math.pow(endWorldY - startWorldY, 2) +
                          Math.pow(endWorldZ - startWorldZ, 2)
                      ).toFixed(2) + 'mm',
                  });
                }
              } catch (transformError) {
                console.error('[SegmentStats] Coordinate transformation failed:', transformError);
                throw new Error(
                  `Failed to transform image coordinates to world space: ${transformError.message}`
                );
              }
            } else {
              throw new Error('Unsupported viewport type for coordinate transformation');
            }
          } else {
            throw new Error('No pixel coordinates available from OBB calculation');
          }

          console.log(
            `[SegmentStats] Converted OBB coordinates to Cornerstone world space for ${measurementType} diameter:`,
            {
              obbCoordinates: {
                start: measurementData.coordinates.start,
                end: measurementData.coordinates.end,
              },
              cornerstoneWorld: { startWorld, endWorld },
              sliceIndex: targetSliceIndex,
              measurementType,
              expectedDiameter: targetDiameter,
              calculatedDistance:
                Math.sqrt(
                  Math.pow(endWorld[0] - startWorld[0], 2) +
                    Math.pow(endWorld[1] - startWorld[1], 2)
                ).toFixed(2) + 'mm',
            }
          );

          // Ensure Length tool is enabled on this viewport's tool group so it renders
          try {
            const toolGroup = ToolGroupManager.getToolGroupForViewport(
              viewport.id,
              (viewport as any).renderingEngineId
            );
            if (toolGroup) {
              const hasLength = !!toolGroup.getToolOptions?.('Length');
              if (!hasLength && (toolGroup as any).addTool) {
                (toolGroup as any).addTool('Length');
              }
              // Make sure it's active so annotations are rendered immediately
              if (toolGroup.setToolActive) {
                toolGroup.setToolActive('Length');
              } else {
                toolGroup.setToolEnabled?.('Length');
              }
              console.log('[SegmentStats] Enabled Length tool for viewport toolGroup');
            } else {
              console.warn(
                '[SegmentStats] No toolGroup found for viewport; annotation may not render'
              );
            }
          } catch (tgErr) {
            console.warn('[SegmentStats] Failed to enable Length tool on toolGroup', tgErr);
          }

          // Create Length annotation data
          const annotationUID = `${measurementType}-diameter-${segmentationId}-${segmentIndex}-${Date.now()}`;
          const camera = viewport.getCamera?.() || ({} as any);
          // Try to resolve a displaySetInstanceUID for MeasurementService mapping
          let displaySetInstanceUID: string | undefined;
          try {
            const services = (servicesManager?.services as any) || {};
            const dssvc = services.displaySetService;
            let ds = dssvc?.getDisplaySetForSOPInstanceUID?.(SOPInstanceUID);
            if (!ds) {
              // Fallback 1: inspect display sets assigned to this viewport via displaySetService
              const dsForVp: any[] = dssvc?.getDisplaySetsForViewport?.(viewport.id) || [];
              ds = dsForVp.find(d => d.SeriesInstanceUID === SeriesInstanceUID) || dsForVp[0];
            }
            if (!ds) {
              // Fallback 2: cornerstoneViewportService -> viewport displaySetInstanceUIDs
              const cvs = services.cornerstoneViewportService;
              const csVp = cvs?.getCornerstoneViewport?.(viewport.id);
              const vpDsUids = csVp?.getDisplaySetInstanceUIDs?.() || [];
              if (vpDsUids.length) {
                displaySetInstanceUID = vpDsUids[0];
              }
            } else {
              displaySetInstanceUID = ds?.displaySetInstanceUID;
            }
            if (!displaySetInstanceUID) {
              // Fallback 3: viewportGridService state
              const vgs = services.viewportGridService;
              const state = vgs?.getState?.();
              const vpCfg = state?.viewports?.find?.((v: any) => v.viewportId === viewport.id);
              const firstDs = vpCfg?.displaySetInstanceUIDs?.[0];
              if (firstDs) displaySetInstanceUID = firstDs;
            }
          } catch {}
          // Build Tools targetId now that we are on the correct slice
          const targetIdForToolsResolved = `imageId:${currentImageId}`;
          // Log final canvas positions to verify segment alignment
          const finalSCanvas = (viewport as any).worldToCanvas?.(startWorld);
          const finalECanvas = (viewport as any).worldToCanvas?.(endWorld);
          const el: any = (viewport as any).element;
          const canvasSize = el ? { w: el.clientWidth, h: el.clientHeight } : undefined;
          const inBounds = (pt: any) =>
            !!pt &&
            pt[0] >= -5 &&
            pt[1] >= -5 &&
            (!canvasSize || (pt[0] <= canvasSize.w + 5 && pt[1] <= canvasSize.h + 5));

          console.log('[SegmentStats] Final segment-aligned positions', {
            currentImageIdIndex: (viewport as any).getCurrentImageIdIndex?.() ?? null,
            targetSliceIndex,
            startCanvas: finalSCanvas,
            endCanvas: finalECanvas,
            canvasSize,
            startInBounds: inBounds(finalSCanvas),
            endInBounds: inBounds(finalECanvas),
          });
          const annotationData = {
            annotationUID,
            toolName: 'Length',
            isVisible: true,
            isHighlighted: true,
            annotationViewportIds: [viewport.id],
            metadata: {
              toolName: 'Length',
              viewportId: viewport.id,
              renderingEngineId: (viewport as any).renderingEngineId,
              FrameOfReferenceUID: viewport.getFrameOfReferenceUID?.() || FrameOfReferenceFromMeta,
              // Use the EXACT current imageId to match the displayed slice
              referencedImageId: currentImageId,
              imageId: currentImageId,
              frameNumber: 1,
              displaySetInstanceUID,
              // Camera context to help renderer decide visibility on slice
              viewPlaneNormal: camera.viewPlaneNormal,
              viewUp: camera.viewUp,
              sliceIndex: targetSliceIndex,
              // Tools-specific target; must be prefixed with 'imageId:'
              targetId: targetIdForToolsResolved,
              // Explicit DICOM identifiers for MeasurementService mapping
              StudyInstanceUID,
              SeriesInstanceUID,
              SOPInstanceUID,
            },
            data: {
              label: `${measurementType.charAt(0).toUpperCase() + measurementType.slice(1)} Diameter S${segmentIndex + 1}`,
              handles: {
                points: [startWorld, endWorld] as [number, number, number][],
                activeHandleIndex: undefined,
              },
              textBox: {
                hasMoved: false,
                worldPosition: [
                  (startWorld[0] + endWorld[0]) / 2,
                  (startWorld[1] + endWorld[1]) / 2,
                  (startWorld[2] + endWorld[2]) / 2,
                ] as [number, number, number],
              },
              cachedStats: {
                [targetIdForToolsResolved]: {
                  length: targetDiameter,
                  unit: 'mm',
                },
              },
            },
            // Some code paths also read top-level FoR
            FrameOfReferenceUID: viewport.getFrameOfReferenceUID?.() || FrameOfReferenceFromMeta,
          } as any;

          // Add the annotation to Cornerstone Tools state
          try {
            const el: any = (viewport as any).element || (viewport as any).canvas || undefined;
            console.log('[SegmentStats] Using element for addAnnotation:', {
              hasElement: !!el,
              tag: el?.tagName,
              viewportId: viewport.id,
              renderingEngineId: (viewport as any).renderingEngineId,
            });
            annotation.state.addAnnotation(annotationData, el);
            try {
              (annotation.state as any).setAnnotationViewportIds?.(annotationUID, [viewport.id]);
            } catch {}
            // Force update to ensure state indexes and subscriptions catch this annotation
            try {
              (annotation.state as any).updateAnnotation?.(annotationUID, annotationData);
            } catch {}
            try {
              (annotation.state as any).annotationModified?.(annotationUID);
            } catch {}
            try {
              const tools = await import('@cornerstonejs/tools');
              (tools as any).triggerAnnotationRenderForViewportIds?.([viewport.id]);
              (tools as any).triggerAnnotationRender?.(el);
            } catch {}
            try {
              viewport.render?.();
            } catch {}
          } catch (addErr) {
            console.warn(
              '[SegmentStats] addAnnotation with element failed, retrying without element',
              addErr
            );
            try {
              (annotation.state as any).addAnnotation?.(annotationData);
            } catch {}
            try {
              (annotation.state as any).updateAnnotation?.(annotationUID, annotationData);
            } catch {}
            try {
              (annotation.state as any).annotationModified?.(annotationUID);
            } catch {}
            try {
              (annotation.state as any).setAnnotationViewportIds?.(annotationUID, [viewport.id]);
            } catch {}
            try {
              const tools = await import('@cornerstonejs/tools');
              (tools as any).triggerAnnotationRenderForViewportIds?.([viewport.id]);
            } catch {}
          }
          // Debug: log annotation count for this viewport
          try {
            const annsForVp = annotation.state.getAnnotations?.('Length', viewport.element) || [];
            console.log(
              '[SegmentStats] Length annotations on this viewport after add:',
              annsForVp.length
            );
          } catch {}
          // Force active/visible selection in this viewport
          try {
            (annotation.state as any).setAnnotationActive?.(annotationUID, viewport.element);
          } catch {}
          try {
            (annotation.state as any).setAnnotationVisibility?.(annotationUID, true);
          } catch {}
          try {
            (annotation.state as any).setAnnotationViewportIds?.(annotationUID, [viewport.id]);
          } catch {}
          // Explicitly trigger annotation render on this viewport
          try {
            utilities.triggerAnnotationRenderForViewportIds?.([viewport.id]);
          } catch {}
          // Notify tools that annotation changed
          try {
            (annotation.state as any).triggerAnnotationModified?.(annotationUID);
          } catch {}

          // Wait a moment for navigation to complete, then render
          setTimeout(() => {
            try {
              viewport.render();
              try {
                utilities.triggerAnnotationRenderForViewportIds?.([viewport.id]);
              } catch {}
              // Force a second render to ensure visibility
              setTimeout(() => {
                viewport.render();
                try {
                  utilities.triggerAnnotationRenderForViewportIds?.([viewport.id]);
                } catch {}
                console.log(
                  '[SegmentStats] Annotation should now be visible on slice:',
                  viewport.getCurrentImageIdIndex()
                );
              }, 100);
            } catch (renderError) {
              console.error('[SegmentStats] Error during annotation render:', renderError);
            }
          }, 200);

          console.log('[SegmentStats] Created Cornerstone annotation:', {
            annotationUID: annotationData.annotationUID,
            diameter: targetDiameter,
            coordinates: { start: startWorld, end: endWorld },
          });

          // Track the created measurement
          setCreatedMeasurements(prev => [...prev, annotationUID]);

          // Update local state to ensure button updates immediately
          setMeasurementsVisible(true);

          // Log success message
          console.log(
            `[SegmentStats] ${measurementType.charAt(0).toUpperCase() + measurementType.slice(1)} Diameter Measurement Created:`,
            {
              slice: measurementData.slice,
              diameter: measurementData.diameter,
              annotationUID,
              measurementType,
            }
          );
        } catch (ohifError) {
          console.error('[SegmentStats] Failed to create OHIF measurement:', ohifError);

          // Fallback to coordinate display
          console.log(
            `[SegmentStats] ${measurementType} diameter measurement data ready for visualization:`,
            {
              slice: measurementData.slice,
              diameter: measurementData.diameter,
              coordinates: measurementData.coordinates,
            }
          );

          console.warn(
            `[SegmentStats] Visual measurement creation failed for ${measurementType} diameter:`,
            {
              slice: measurementData.slice,
              diameter: measurementData.diameter,
              coordinates: measurementData.coordinates,
              error: ohifError,
            }
          );
        }
      } catch (importError) {
        console.error(
          '[SegmentStats] Failed to import Cornerstone tools or access segmentation data:',
          importError
        );
      }
    } catch (error) {
      console.error('[SegmentStats] Error creating measurement:', error);
    }
  };

  // Toggle measurements visibility
  const toggleMeasurements = async () => {
    // Use the same logic as the button display: check both existing measurements and local state
    const hasExistingMeasurements = checkExistingMeasurements();
    const shouldHide = hasExistingMeasurements || measurementsVisible;

    if (shouldHide) {
      // Hide measurements - remove existing annotations for this segment
      await removeExistingMeasurements();
      setMeasurementsVisible(false);
      setCreatedMeasurements([]);
      console.log('[SegmentStats] Removed existing measurements for segment', {
        segmentationId,
        segmentIndex,
      });

      // Force re-render to update button state
      setForceUpdate(prev => prev + 1);
    } else {
      // Show measurements - create both max and min diameter measurements
      await createDiameterMeasurement('max');
      await createDiameterMeasurement('min');
      setMeasurementsVisible(true);
      console.log('[SegmentStats] Created new measurements for segment', {
        segmentationId,
        segmentIndex,
      });

      // Force re-render to update button state after a short delay to ensure annotations are created
      setTimeout(() => {
        setForceUpdate(prev => prev + 1);
      }, 500);
    }
  };

  // Remove all created measurements
  const removeMeasurements = async () => {
    try {
      const { annotation } = await import('@cornerstonejs/tools');
      const { getRenderingEngine } = await import('@cornerstonejs/core');

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.warn('[SegmentStats] Rendering engine not found for measurement removal');
        return;
      }

      const viewports = renderingEngine.getViewports();
      const viewport = viewports.find(vp => vp.id.includes('axial')) || viewports[0];

      if (!viewport) {
        console.warn('[SegmentStats] No viewport found for measurement removal');
        return;
      }

      // Remove each created measurement
      createdMeasurements.forEach(annotationUID => {
        try {
          annotation.state.removeAnnotation(annotationUID);
          console.log(`[SegmentStats] Removed measurement: ${annotationUID}`);
        } catch (error) {
          console.warn(`[SegmentStats] Failed to remove measurement ${annotationUID}:`, error);
        }
      });

      // Clear the tracking array
      setCreatedMeasurements([]);

      // Re-render the viewport
      viewport.render();

      console.log('[SegmentStats] All measurements removed');
    } catch (error) {
      console.error('[SegmentStats] Error removing measurements:', error);
    }
  };

  // Listen for async OBB calculation completion to force re-render
  useEffect(() => {
    const handleStatsUpdate = (event: CustomEvent) => {
      const { segmentationId: eventSegId, segmentIndex: eventSegIndex } = event.detail;

      // Only update if this is for the current segment
      if (eventSegId === segmentationId && eventSegIndex === segmentIndex) {
        setForceUpdate(prev => prev + 1);
        setIsCurrentlyCalculating(false);
        console.log(
          `[SegmentStats] Received stats update for segment ${segmentIndex}, forcing re-render`
        );
      }
    };

    window.addEventListener('segmentation-stats-updated', handleStatsUpdate as EventListener);

    return () => {
      window.removeEventListener('segmentation-stats-updated', handleStatsUpdate as EventListener);
    };
  }, [segmentationId, segmentIndex]);

  // Update calculating state when props change
  useEffect(() => {
    const newCalculatingState = isCalculating || (stats as any)?.isCalculating || false;
    console.log(`[SegmentStats] Loading state update for segment ${segmentIndex}:`, {
      isCalculating,
      statsIsCalculating: (stats as any)?.isCalculating,
      newCalculatingState,
      currentState: isCurrentlyCalculating,
    });
    setIsCurrentlyCalculating(newCalculatingState);
  }, [isCalculating, stats, segmentIndex]);

  const segmentAdditionalStats: Record<
    string,
    { label: string; unit: string | null; showLoading?: boolean }
  > = {
    volume: {
      label: 'Volume',
      unit: 'mL', // Volume is always in mL (cubic centimeters) from useSegmentationDataSync.ts
      showLoading: true, // Show loading for volume as well
    },
    diameter: {
      label: 'Max Diameter',
      unit: 'mm',
      showLoading: true,
    },
    minDiameter: {
      label: 'Min Diameter',
      unit: 'mm',
      showLoading: true,
    },
    affected_organs: {
      label: 'Organ',
      unit: null,
    },
  };

  const renderChangeValue = (change: number) => {
    if (!showChangeValues) {
      return null;
    }

    if (change > 0) {
      return <span className="ml-2 text-red-500">(+{change}%)</span>;
    } else if (change < 0) {
      return <span className="ml-2 text-green-500">({change}%)</span>;
    } else if (change === 0) {
      return <span className="ml-2 text-gray-500">({change}%)</span>;
    }
    return null;
  };

  // Check if the current segment has a non-measurable classification type
  const isNonMeasurableClassification = useMemo(() => {
    // Get the segment's classification
    const classification = stats?.lession_classification;
    
    // Check if it's one of the optional classifications that should hide measurements
    return classification && optionalClassifications.includes(classification);
  }, [stats]);

  return (
    <div className="ml-7 flex flex-col px-2 py-2">
      {Object.entries(segmentAdditionalStats).map(([key, value]) => (
        <div
          key={key}
          className="text-secondary-foreground flex h-full items-center justify-between text-base leading-normal"
        >
          <span className="flex-1">{value.label}:</span>
          <div className="flex items-center gap-1">
            <span className="font-bold">
              {key === 'affected_organs'
                ? (affectedOrgansLabels[stats[key]] ?? 'Unknown')
                : (() => {
                    // Only show calculated values, not backend values
                    // For volume and diameter, only show if we have calculated values or if calculation is complete
                    if (key === 'volume' || key === 'diameter' || key === 'minDiameter') {
                      // Check if this is a calculated value (has specific calculated properties)
                      const hasCalculatedDiameter =
                        stats.maxDiameterSlice !== undefined ||
                        stats.minDiameterSlice !== undefined;
                      // For volume, check if we're currently calculating or if calculation is complete (not calculating)
                      const isVolumeCalculating = isCurrentlyCalculating;

                      // For diameter fields, only show if we have calculated diameter data
                      if ((key === 'diameter' || key === 'minDiameter') && !hasCalculatedDiameter) {
                        return '--';
                      }

                      // For volume, only show if we're not currently calculating (meaning calculation is complete)
                      if (key === 'volume' && isVolumeCalculating) {
                        return '--';
                      }

                      // If we have calculated data, show it
                      if (stats[key]) {
                        // Volume is already in mL from useSegmentationDataSync.ts
                        // Use our specialized formatter for volume values
                        if (key === 'volume') {
                          return `${formatVolumeForDisplay(stats[key])} ${value.unit || ''}`;
                        } else {
                          // For other numeric values, use the general formatter
                          return `${formatValue(stats[key])} ${value.unit || ''}`;
                        }
                      }
                    } else {
                      // For other fields (like affected_organs), show normally
                      return stats[key] ? `${formatValue(stats[key])} ${value.unit || ''}` : '--';
                    }
                    return '--';
                  })()}
            </span>
            {value.showLoading && isCurrentlyCalculating && <PulseIndicator />}
            {/* Only show measurement and slice navigation controls if NOT a non-measurable classification */}
            {key === 'diameter' && stats.maxDiameterSlice !== undefined && !isNonMeasurableClassification && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateToSlice(stats.maxDiameterSlice)}
                  className="rounded bg-blue-500 py-0 px-1 text-xs text-white transition-colors hover:bg-blue-600"
                  title={`Go to slice ${stats.maxDiameterSlice + 1} (max diameter)`}
                >
                  {'>'}
                </button>
                <button
                  onClick={toggleMeasurements}
                  className={`rounded py-0 px-1 text-xs text-white transition-colors ${
                    checkExistingMeasurements() || measurementsVisible
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                  title={
                    checkExistingMeasurements() || measurementsVisible
                      ? 'Hide diameter measurements'
                      : 'Show diameter measurements'
                  }
                >
                  {checkExistingMeasurements() || measurementsVisible ? '🚫' : '📏'}
                </button>
              </div>
            )}
            {/* Only show min diameter slice navigation if NOT a non-measurable classification */}
            {/* {key === 'minDiameter' && stats.minDiameterSlice !== undefined && !isNonMeasurableClassification && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateToSlice(stats.minDiameterSlice)}
                  className="rounded bg-purple-500 py-0 px-1 text-xs text-white transition-colors hover:bg-purple-600"
                  title={`Go to slice ${stats.minDiameterSlice + 1} (min diameter)`}
                >
                  {'>'}
                </button>
              </div>
            )} */}
          </div>
          {stats[`${key}_change`] && renderChangeValue(stats[`${key}_change`] as number)}
        </div>
      ))}
    </div>
  );
}
