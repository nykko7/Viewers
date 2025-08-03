import React, { useEffect, useState } from 'react';
import { affectedOrgansLabels, SegmentStatsType } from '../../../types';
import { formatValue } from '../../../utils/formatValue';
import { getRenderingEngine } from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { Types } from '@ohif/core';

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

  // Navigation function to go to specific slice
  const navigateToSlice = (sliceIndex: number) => {
    try {
      console.log(`[SegmentStats] Attempting to navigate to slice ${sliceIndex + 1}`);

      // Try to find any available rendering engine
      console.log('[SegmentStats] Searching for rendering engines...');

      // Try common rendering engine names
      const engineNames = ['OHIFCornerstoneRenderingEngine', 'myRenderingEngine', 'default'];
      let renderingEngine = null;

      for (const engineName of engineNames) {
        try {
          renderingEngine = getRenderingEngine(engineName);
          if (renderingEngine) {
            console.log(`[SegmentStats] Found rendering engine: ${engineName}`);
            break;
          }
        } catch (e) {
          // Continue trying
        }
      }

      if (!renderingEngine) {
        console.error('[SegmentStats] No rendering engine found, trying custom event approach');
        // Fallback to custom event
        const event = new CustomEvent('navigate-to-slice', {
          detail: { sliceIndex },
        });
        window.dispatchEvent(event);
        return;
      }

      // Try common viewport names
      const viewportNames = ['CT_AXIAL', 'default', 'viewport-1', 'viewport1'];
      let viewport = null;

      for (const viewportName of viewportNames) {
        try {
          viewport = renderingEngine.getViewport(viewportName);
          if (viewport) {
            console.log(`[SegmentStats] Found viewport: ${viewportName}`);
            break;
          }
        } catch (e) {
          // Continue trying
        }
      }

      if (!viewport) {
        console.error('[SegmentStats] No viewport found');
        console.log('[SegmentStats] Available viewports:', renderingEngine.getViewports?.());
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
          const { getRenderingEngine } = await import('@cornerstonejs/core');

          // Get the rendering engine and viewport
          const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
          if (!renderingEngine) {
            throw new Error('Rendering engine not found');
          }

          const viewports = renderingEngine.getViewports();
          const viewport = viewports.find(vp => vp.id.includes('axial')) || viewports[0];

          if (!viewport) {
            throw new Error('No viewport found for annotation');
          }

          // Get the correct image ID for the target slice (not current viewport position)
          const targetSliceIndex = measurementData.slice - 1; // Convert to 0-based index
          const allImageIds = (viewport as any).imageIds || [];
          const rawImageId = allImageIds[targetSliceIndex] || `image-${targetSliceIndex}`;
          // Ensure the image ID has the proper prefix for Cornerstone Tools
          const currentImageId = rawImageId.startsWith('imageId:')
            ? rawImageId
            : `imageId:${rawImageId}`;

          console.log('[SegmentStats] Target slice image info:', {
            targetSliceIndex,
            targetSlice: measurementData.slice,
            rawImageId,
            currentImageId,
            viewportId: viewport.id,
            totalImages: allImageIds.length,
          });

          // Convert OBB world coordinates to Cornerstone world coordinate system
          // The OBB provides coordinates in mm, but we need to convert them to Cornerstone's world space
          const imageData = viewport.getImageData();
          const spacing = imageData?.spacing || [1, 1, 1];
          const origin = imageData?.origin || [0, 0, 0];

          // Convert OBB world coordinates (mm) to Cornerstone world coordinates
          const startWorld: [number, number, number] = [
            measurementData.coordinates.start.x + origin[0],
            measurementData.coordinates.start.y + origin[1],
            targetSliceIndex * spacing[2] + origin[2],
          ];
          const endWorld: [number, number, number] = [
            measurementData.coordinates.end.x + origin[0],
            measurementData.coordinates.end.y + origin[1],
            targetSliceIndex * spacing[2] + origin[2],
          ];

          console.log(
            `[SegmentStats] Converted OBB coordinates to Cornerstone world space for ${measurementType} diameter:`,
            {
              obbCoordinates: {
                start: {
                  x: measurementData.coordinates.start.x,
                  y: measurementData.coordinates.start.y,
                },
                end: { x: measurementData.coordinates.end.x, y: measurementData.coordinates.end.y },
              },
              cornerstoneWorld: { startWorld, endWorld },
              imageInfo: { spacing, origin },
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

          // Create Length annotation data
          const annotationUID = `${measurementType}-diameter-${segmentationId}-${segmentIndex}-${Date.now()}`;
          const annotationData = {
            annotationUID,
            metadata: {
              toolName: 'Length',
              viewportId: viewport.id,
              FrameOfReferenceUID: viewport.getFrameOfReferenceUID(),
              referencedImageId: rawImageId,
            },
            data: {
              label: `${measurementType.charAt(0).toUpperCase() + measurementType.slice(1)} Diameter S${segmentIndex + 1}`,
              handles: {
                points: [startWorld, endWorld],
                textBox: {
                  hasMoved: false,
                  worldPosition: [
                    (startWorld[0] + endWorld[0]) / 2,
                    (startWorld[1] + endWorld[1]) / 2,
                    (startWorld[2] + endWorld[2]) / 2,
                  ] as [number, number, number],
                },
              },
              cachedStats: {
                [currentImageId]: {
                  length: targetDiameter,
                  unit: 'mm',
                },
              },
            },
          };

          // Add the annotation to Cornerstone Tools state
          annotation.state.addAnnotation(annotationData, viewport.element);

          // Wait a moment for navigation to complete, then render
          setTimeout(() => {
            try {
              viewport.render();
              // Force a second render to ensure visibility
              setTimeout(() => {
                viewport.render();
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
    if (measurementsVisible) {
      // Hide measurements - remove all created annotations
      await removeMeasurements();
      setMeasurementsVisible(false);
    } else {
      // Show measurements - create both max and min diameter measurements
      await createDiameterMeasurement('max');
      await createDiameterMeasurement('min');
      setMeasurementsVisible(true);
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
      unit: 'mm³',
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
                : stats[key]
                  ? `${formatValue(stats[key])} ${value.unit || ''}`
                  : '--'}
            </span>
            {value.showLoading && isCurrentlyCalculating && <PulseIndicator />}
            {key === 'diameter' && stats.maxDiameterSlice !== undefined && (
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
                    measurementsVisible
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                  title={
                    measurementsVisible
                      ? 'Hide diameter measurements'
                      : 'Show diameter measurements'
                  }
                >
                  {measurementsVisible ? '🚫' : '📏'}
                </button>
              </div>
            )}
            {/* {key === 'minDiameter' && stats.minDiameterSlice !== undefined && (
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
