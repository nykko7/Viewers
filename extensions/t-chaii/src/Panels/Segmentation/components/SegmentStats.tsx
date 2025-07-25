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

  // Create measurement annotation for max diameter
  const createMaxDiameterMeasurement = async () => {
    try {
      console.log(`[SegmentStats] Creating measurement for max diameter: ${stats.diameter}mm`);

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
        const overallMajorAxis = cachedStats.overallMajorAxis as any;

        if (typeof maxDiameterSlice !== 'number' || !overallMajorAxis) {
          console.error('[SegmentStats] Missing OBB calculation data for measurement creation:', {
            maxDiameterSlice,
            overallMajorAxis: !!overallMajorAxis,
          });
          return;
        }

        console.log('[SegmentStats] Found OBB data for measurement:', {
          maxDiameterSlice,
          overallMajorAxis,
          diameter: stats.diameter,
        });

        // Navigate to the max diameter slice first
        await navigateToSlice(maxDiameterSlice);

        // Get pixel coordinates from OBB calculation (before world coordinate conversion)
        // We need to access the original pixel coordinates, not the world coordinates
        const cachedStatsDetailed = segmentation.segments[segmentIndex].cachedStats;
        const pixelCoordinates = cachedStatsDetailed.overallMajorAxisPixels || overallMajorAxis;

        // Create measurement data using pixel coordinates
        const measurementData = {
          slice: maxDiameterSlice + 1,
          diameter: `${stats.diameter?.toFixed(2)}mm`,
          coordinates: {
            start: {
              x: pixelCoordinates[0].x || overallMajorAxis[0].x,
              y: pixelCoordinates[0].y || overallMajorAxis[0].y,
            },
            end: {
              x: pixelCoordinates[1].x || overallMajorAxis[1].x,
              y: pixelCoordinates[1].y || overallMajorAxis[1].y,
            },
          },
        };

        console.log('[SegmentStats] Using coordinates:', {
          pixelCoordinates: pixelCoordinates,
          worldCoordinates: overallMajorAxis,
          usingPixels: !!cachedStatsDetailed.overallMajorAxisPixels,
        });

        console.log('[SegmentStats] Max diameter measurement data:', measurementData);

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

          // Convert image pixel coordinates to world coordinates using imageToWorld
          // This is the correct method for converting image coordinates to world space
          const startImage: [number, number] = [
            measurementData.coordinates.start.x,
            measurementData.coordinates.start.y,
          ];
          const endImage: [number, number] = [
            measurementData.coordinates.end.x,
            measurementData.coordinates.end.y,
          ];

          let startWorld: [number, number, number];
          let endWorld: [number, number, number];

          try {
            // Try imageToWorld method if available
            if (typeof (viewport as any).imageToWorld === 'function') {
              startWorld = (viewport as any).imageToWorld(startImage);
              endWorld = (viewport as any).imageToWorld(endImage);
              console.log('[SegmentStats] Using imageToWorld conversion:', {
                startImage,
                endImage,
                startWorld,
                endWorld,
              });
            } else {
              // Fallback: use canvasToWorld but log the attempt
              console.log(
                '[SegmentStats] imageToWorld not available, using canvasToWorld fallback'
              );
              startWorld = viewport.canvasToWorld(startImage);
              endWorld = viewport.canvasToWorld(endImage);
              console.log('[SegmentStats] Using canvasToWorld fallback:', {
                startImage,
                endImage,
                startWorld,
                endWorld,
              });
            }
          } catch (conversionError) {
            console.error('[SegmentStats] Coordinate conversion failed:', conversionError);
            // Last resort: use pixel coordinates as world coordinates with proper Z
            startWorld = [startImage[0], startImage[1], 0];
            endWorld = [endImage[0], endImage[1], 0];
            console.log('[SegmentStats] Using pixel coordinates as fallback:', {
              startWorld,
              endWorld,
            });
          }

          // Create Length annotation data
          const annotationData = {
            annotationUID: `max-diameter-${segmentationId}-${segmentIndex}-${Date.now()}`,
            metadata: {
              toolName: 'Length',
              viewportId: viewport.id,
              FrameOfReferenceUID: viewport.getFrameOfReferenceUID(),
              referencedImageId: rawImageId,
            },
            data: {
              label: `Max Diameter S${segmentIndex + 1}`,
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
                  length: stats.diameter,
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
            diameter: stats.diameter,
            coordinates: { start: startWorld, end: endWorld },
          });

          // Show success message
          alert(
            `✅ Measurement Annotation Created!\n\nSlice: ${measurementData.slice}\nDiameter: ${measurementData.diameter}\nAnnotation ID: ${annotationData.annotationUID}\n\n📏 Visual measurement line added to viewer`
          );
        } catch (ohifError) {
          console.error('[SegmentStats] Failed to create OHIF measurement:', ohifError);

          // Fallback to coordinate display
          console.log('[SegmentStats] Max diameter measurement data ready for visualization:', {
            slice: measurementData.slice,
            diameter: measurementData.diameter,
            coordinates: measurementData.coordinates,
          });

          alert(
            `⚠️ Visual measurement creation failed\n\nSlice: ${measurementData.slice}\nDiameter: ${measurementData.diameter}\nLocation: (${measurementData.coordinates.start.x.toFixed(1)}, ${measurementData.coordinates.start.y.toFixed(1)}) to (${measurementData.coordinates.end.x.toFixed(1)}, ${measurementData.coordinates.end.y.toFixed(1)})\n\n📍 You are now on the slice with the maximum diameter\n\nSee console for error details`
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
      label: 'Diameter',
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
                {/* <button
                    onClick={createMaxDiameterMeasurement}
                    className="rounded bg-green-500 py-0 px-1 text-xs text-white transition-colors hover:bg-green-600"
                    title={`Create measurement for max diameter (${stats.diameter?.toFixed(2)}mm)`}
                  >
                    📏
                  </button> */}
              </div>
            )}
          </div>
          {stats[`${key}_change`] && renderChangeValue(stats[`${key}_change`] as number)}
        </div>
      ))}
    </div>
  );
}
