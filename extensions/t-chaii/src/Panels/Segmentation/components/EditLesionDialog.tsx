import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  TooltipProvider,
  DialogDescription,
  Command,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@ohif/ui-next';
import { LesionFlowGraph } from './LesionFlowGraph';
import { useSegmentationTableContext } from '@ohif/ui-next';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { formatValue } from '../../../utils/formatValue';
import { useLesionTrajectory } from '../hooks/useLesionTrajectory';
import { cn } from '@ohif/ui-next/lib/utils';
import { buildConnectionMap } from '../utils/buildConnectionMap';
import {
  affectedOrgansLabels,
  Study,
  Segment,
  lesionTypeLabels,
  lesionClassificationLabels,
} from '../../../types';

import { Check, ChevronsUpDown } from 'lucide-react';
import { CommandEmpty, CommandInput, CommandList, CommandGroup, CommandItem } from '@ohif/ui-next';
import { Types } from '@ohif/core';

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
  servicesManager?: Types.Extensions.ExtensionParams['servicesManager'];
};

// Add this function to find the direct previous study
const getDirectPreviousStudy = (currentStudy: Study | null, allStudies: Study[]) => {
  if (!currentStudy) {
    return null;
  }

  // Sort studies by date
  const sortedStudies = [...allStudies].sort(
    (a, b) => new Date(a.study_date).getTime() - new Date(b.study_date).getTime()
  );

  // Find current study index
  const currentIndex = sortedStudies.findIndex(s => s.study_id === currentStudy.study_id);

  // Return previous study if exists
  return currentIndex > 0 ? sortedStudies[currentIndex - 1] : null;
};

// Update the interface to match the expected typing in the segmentation object
type SegmentationWithSegments = {
  segmentation: {
    segmentationId: string;
    segments: Array<{
      label: string;
      cachedStats: {
        id: string;
      };
    }>;
  };
};

// Add a helper component for the study group
type StudyGroupRowsProps = {
  study: Study;
  segments: Array<{
    segment: Segment;
    isSplit?: boolean;
    isMerge?: boolean;
  }>;
  totalVolume: number;
  onSegmentSelect: (segmentId: string) => void;
  selectedSegmentId: string | null;
};

function StudyGroupRows({
  study,
  segments,
  totalVolume,
  onSegmentSelect,
  selectedSegmentId,
}: StudyGroupRowsProps) {
  return (
    <div className="divide-y divide-gray-200/10">
      {segments.map((segmentData, index) => (
        <div
          key={segmentData.segment.id}
          className={cn(
            'text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm',
            'cursor-pointer transition-colors hover:bg-[#2563eb]/10',
            segmentData.segment.id === selectedSegmentId &&
              'border-l-4 !border-l-[#2563eb] bg-[#2563eb]/10',
            index > 0 && 'border-t-0'
          )}
          onClick={() => onSegmentSelect(segmentData.segment.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              onSegmentSelect(segmentData.segment.id);
            }
          }}
        >
          {/* Show date only for first segment in study */}
          <div>{index === 0 ? new Date(study.study_date).toLocaleDateString() : ''}</div>
          <div className="font-medium">
            {segmentData.segment.label}
            {segmentData.isSplit && <span className="ml-2 text-orange-500">(split)</span>}
            {segmentData.isMerge && <span className="ml-2 text-blue-500">(merge)</span>}
          </div>
          <div>{formatValue(segmentData.segment.volume)}</div>
          <div>{formatValue((segmentData.segment as any).diameter || segmentData.segment.axial_diameter)}</div>
        </div>
      ))}
      {segments.length > 1 && (
        <div className="text-secondary-foreground grid grid-cols-4 gap-4 bg-gray-50/10 px-4 py-2 text-sm font-semibold">
          <div></div>
          <div>Total</div>
          <div>{formatValue(totalVolume)}</div>
          <div>-</div>
        </div>
      )}
    </div>
  );
}

type FormValues = {
  label: string;
  affected_organs: string;
  lession_type: 'Mass' | 'Other' | 'Lymph';
  lession_classification: 'Target' | 'Non-Target' | 'New lession';
};

export function EditLesionDialog({
  open,
  onOpenChange,
  segmentIndex,
  servicesManager,
}: EditLesionDialogProps) {
  const { data, activeSegmentationId } = useSegmentationTableContext('SegmentationTable.Segments');
  const studies = useSegmentationsStore(state => state.getStudies());
  const updateSegment = useSegmentationsStore(state => state.updateSegment);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [temporaryConnection, setTemporaryConnection] = useState<{
    source: string | null;
    target: string | null;
  }>({ source: null, target: null });

  // Get active segmentation
  const activeSegmentation = data.find(
    item =>
      (item as unknown as SegmentationWithSegments).segmentation.segmentationId ===
      activeSegmentationId
  ) as unknown as SegmentationWithSegments | undefined;

  const defaultValues: FormValues = React.useMemo(
    () => ({
      label: `Segment ${segmentIndex + 1}`,
      affected_organs: '',
      lession_type: 'Mass',
      lession_classification: 'New lession',
    }),
    [segmentIndex]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues,
  });

  // Reset form and selected segment when dialog opens/closes or segment changes
  useEffect(() => {
    if (!open) {
      setSelectedSegmentId(null);
      setSelectedOriginId(null);
      reset();
      return;
    }

    if (open && activeSegmentation) {
      const initialSegment = activeSegmentation.segmentation.segments[segmentIndex];
      if (initialSegment) {
        // Find segment ID in studies by matching the label
        for (const study of Object.values(studies)) {
          if (!study.series) {
            continue;
          }

          for (const series of study.series) {
            if (!series.segmentations) {
              continue;
            }

            for (const seg of series.segmentations) {
              if (!seg.segments) {
                continue;
              }

              const matchingSegment = seg.segments.find(
                s => s.id === initialSegment.cachedStats.id
              );
              if (matchingSegment) {
                setSelectedSegmentId(matchingSegment.id);
                setValue('label', matchingSegment.label || defaultValues.label);
                setValue('affected_organs', matchingSegment.affected_organs || '');
                setValue(
                  'lession_type',
                  (matchingSegment.lession_type || defaultValues.lession_type) as
                    | 'Mass'
                    | 'Other'
                    | 'Lymph'
                );
                setValue(
                  'lession_classification',
                  (matchingSegment.lession_classification ||
                    defaultValues.lession_classification) as 'Target' | 'Non-Target' | 'New lession'
                );
                // Check for origins in lesion_segments
                if (matchingSegment.lesion_segments && matchingSegment.lesion_segments.length > 0) {
                  setSelectedOriginId(matchingSegment.lesion_segments[0]);
                  // Set temporary connection for display
                  setTemporaryConnection({
                    source: matchingSegment.lesion_segments[0],
                    target: matchingSegment.id,
                  });
                } else {
                  // If no lesion_segments, check if there are connections in the connection map
                  const connectionOrigin = getOriginFromConnectionMap(matchingSegment.id);
                  if (connectionOrigin) {
                    setSelectedOriginId(connectionOrigin);
                    setTemporaryConnection({
                      source: connectionOrigin,
                      target: matchingSegment.id,
                    });
                  } else {
                    // No connections found, this is truly a standalone lesion
                    setSelectedOriginId(null);
                    setTemporaryConnection({ source: null, target: null });
                  }
                }
                return;
              }
            }
          }
        }
      }
      // Reset to default values if no matching segment is found
      reset(defaultValues);
    }
  }, [open, activeSegmentation, segmentIndex, studies, reset, setValue, defaultValues]);

  // State to force re-render when segments are updated
  const [forceUpdate, setForceUpdate] = useState(0);

  // Listen for segment statistics updates to sync with brush/eraser edits
  useEffect(() => {
    if (!open) {
      console.log('[EditLesionDialog] Dialog not open, skipping event listener setup');
      return;
    }

    console.log(`[EditLesionDialog] Setting up event listener for segmentation ${activeSegmentationId}`);

    const handleStatsUpdate = (event: CustomEvent) => {
      console.log('[EditLesionDialog] Received segmentation-stats-updated event:', event.detail);
      const { segmentationId, segmentIndex: updatedSegmentIndex } = event.detail;
      
      // Always log the event for debugging
      console.log(`[EditLesionDialog] Stats update - segmentationId: ${segmentationId}, updatedSegmentIndex: ${updatedSegmentIndex}, activeSegmentationId: ${activeSegmentationId}`);
      
      // Update for any segment in the current segmentation (not just the current segment)
      if (segmentationId === activeSegmentationId) {
        console.log(`[EditLesionDialog] Segmentation matches, forcing re-render`);
        
        // Force component re-render to show updated values
        setForceUpdate(prev => prev + 1);
        
        // If the updated segment matches our current segment, log it
        if (updatedSegmentIndex === segmentIndex) {
          console.log(`[EditLesionDialog] Current segment ${segmentIndex} was updated`);
        }
      } else {
        console.log(`[EditLesionDialog] Segmentation mismatch, ignoring update`);
      }
    };

    // Listen for the same event that SegmentStats uses
    window.addEventListener('segmentation-stats-updated', handleStatsUpdate as EventListener);
    console.log('[EditLesionDialog] Event listener added for segmentation-stats-updated');

    return () => {
      console.log('[EditLesionDialog] Removing event listener');
      window.removeEventListener('segmentation-stats-updated', handleStatsUpdate as EventListener);
    };
  }, [open, activeSegmentationId, segmentIndex]);

  // Get current segment and its study data (include forceUpdate to refresh when segments change)
  const { currentSegment, segmentStudy } = React.useMemo(() => {
    let foundSegment = null;
    let foundStudy = null;

    // First try to get selected segment from studies
    if (selectedSegmentId) {
      for (const study of Object.values(studies)) {
        if (!study.series) {
          continue;
        }

        for (const series of study.series) {
          if (!series.segmentations) {
            continue;
          }

          for (const seg of series.segmentations) {
            if (!seg.segments) {
              continue;
            }

            const segment = seg.segments.find(s => s.id === selectedSegmentId);
            if (segment) {
              foundSegment = segment;
              foundStudy = study;
              break;
            }
          }
          if (foundSegment) {
            break;
          }
        }
        if (foundSegment) {
          break;
        }
      }
    }

    // If no selected segment or not found, try to find by label
    if (!foundSegment && activeSegmentation) {
      const initialSegment = activeSegmentation.segmentation.segments[segmentIndex];
      if (initialSegment) {
        const initialLabel = initialSegment.label;

        for (const study of Object.values(studies)) {
          if (!study.series) {
            continue;
          }

          for (const series of study.series) {
            if (!series.segmentations) {
              continue;
            }

            for (const seg of series.segmentations) {
              if (!seg.segments) {
                continue;
              }

              const segment = seg.segments.find(s => s.label === initialLabel);
              if (segment) {
                foundSegment = segment;
                foundStudy = study;
                break;
              }
            }
            if (foundSegment) {
              break;
            }
          }
          if (foundSegment) {
            break;
          }
        }
      }
    }

    return {
      currentSegment: foundSegment,
      segmentStudy: foundStudy,
    };
  }, [selectedSegmentId, studies, activeSegmentation, segmentIndex, forceUpdate]);

  // Get the direct previous study
  const directPreviousStudy = React.useMemo(
    () => getDirectPreviousStudy(segmentStudy, Object.values(studies)),
    [segmentStudy, studies]
  );

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setSelectedSegmentId(null);
      setSelectedOriginId(null);
      reset();
    };
  }, [reset]);

  // Handler for setting the origin ID
  const handleOriginSelect = (originId: string) => {
    setSelectedOriginId(originId);

    // Create a temporary connection for display purposes
    if (currentSegment) {
      setTemporaryConnection({
        source: originId,
        target: currentSegment.id,
      });
    }
  };

  // Handler for segment selection from the graph
  const handleSegmentSelect = (segmentId: string) => {
    console.log(`[EditLesionDialog] handleSegmentSelect called with segmentId: ${segmentId}`);
    
    // If this segment already selected, do nothing
    if (segmentId === selectedSegmentId) {
      console.log(`[EditLesionDialog] Segment ${segmentId} already selected, skipping`);
      return;
    }

    setSelectedSegmentId(segmentId);
    console.log(`[EditLesionDialog] Set selectedSegmentId to: ${segmentId}`);

    // Find segment data to populate form
    for (const study of Object.values(studies)) {
      if (!study.series) {
        continue;
      }

      for (const series of study.series) {
        if (!series.segmentations) {
          continue;
        }

        for (const seg of series.segmentations) {
          if (!seg.segments) {
            continue;
          }

          const segment = seg.segments.find(s => s.id === segmentId);
          if (segment) {
            console.log(`[EditLesionDialog] Found segment:`, {
              id: segment.id,
              label: segment.label,
              lesion_segments: segment.lesion_segments,
              study_id: study.study_id,
              study_date: study.study_date
            });
            
            // Update form values
            setValue('label', segment.label || `Segment ${segmentIndex + 1}`);
            setValue('affected_organs', segment.affected_organs || '');
            setValue(
              'lession_type',
              (segment.lession_type || 'Mass') as 'Mass' | 'Other' | 'Lymph'
            );
            setValue(
              'lession_classification',
              (segment.lession_classification || 'New lession') as
                | 'Target'
                | 'Non-Target'
                | 'New lession'
            );

            // Debug connection map
            console.log(`[EditLesionDialog] Connection map:`, connectionMap);
            console.log(`[EditLesionDialog] Looking for origins of segment: ${segment.id}`);
            
            // Update origin
            if (segment.lesion_segments && segment.lesion_segments.length > 0) {
              console.log(`[EditLesionDialog] Found lesion_segments:`, segment.lesion_segments);
              setSelectedOriginId(segment.lesion_segments[0]);

              // Also set temporary connection for display
              setTemporaryConnection({
                source: segment.lesion_segments[0],
                target: segment.id,
              });
            } else {
              console.log(`[EditLesionDialog] No lesion_segments found, checking connection map`);
              // If no lesion_segments, check if there are connections in the connection map
              const connectionOrigin = getOriginFromConnectionMap(segment.id);
              console.log(`[EditLesionDialog] Connection map origin result:`, connectionOrigin);
              
              if (connectionOrigin) {
                console.log(`[EditLesionDialog] Setting origin from connection map: ${connectionOrigin}`);
                setSelectedOriginId(connectionOrigin);
                setTemporaryConnection({
                  source: connectionOrigin,
                  target: segment.id,
                });
              } else {
                console.log(`[EditLesionDialog] No connections found, setting as standalone`);
                // No connections found, this is truly a standalone lesion
                setSelectedOriginId(null);
                setTemporaryConnection({ source: null, target: null });
              }
            }

            break;
          }
        }
      }
    }
  };

  // Update the form when selected segment changes
  useEffect(() => {
    if (!open) {
      return;
    }

    if (selectedSegmentId && currentSegment?.id !== selectedSegmentId) {
      handleSegmentSelect(selectedSegmentId);
    }
  }, [selectedSegmentId, open, currentSegment]);

  const onSubmit = async (data: FormValues) => {
    if (!currentSegment) {
      return;
    }

    const updatedSegment = {
      ...currentSegment,
      label: data.label,
      affected_organs: data.affected_organs,
      lession_type: data.lession_type,
      lession_classification: data.lession_classification,
      // Always set lesion_segments to an empty array when no origin is selected
      lesion_segments: selectedOriginId ? [selectedOriginId] : [],
    };

    try {
      // Update the store
      await updateSegment(updatedSegment);

      // Update the viewer if servicesManager is available
      if (servicesManager && activeSegmentationId) {
        const { segmentationService, cornerstoneViewportService, viewportGridService } =
          servicesManager.services;

        // Get the current segmentation to preserve existing data
        const currentSegmentation = segmentationService.getSegmentation(activeSegmentationId);

        if (currentSegmentation) {
          // Create the segments config for the update
          const segmentsConfig = {};

          // Update only the specific segment we're editing
          segmentsConfig[segmentIndex] = {
            label: updatedSegment.label,
            // Preserve other segment properties if they exist
            ...(currentSegmentation.segments[segmentIndex] && {
              active: currentSegmentation.segments[segmentIndex].active,
              locked: currentSegmentation.segments[segmentIndex].locked,
            }),
          };

          // Use the new API format for updating segmentation
          segmentationService.addOrUpdateSegmentation({
            segmentationId: activeSegmentationId,
            config: {
              segments: segmentsConfig,
            },
          });

          // Store the custom metadata in cachedStats
          const segmentation = segmentationService.getSegmentation(activeSegmentationId);
          if (segmentation && segmentation.segments[segmentIndex]) {
            segmentation.segments[segmentIndex].cachedStats = {
              ...segmentation.segments[segmentIndex].cachedStats,
              id: updatedSegment.id,
              affected_organs: updatedSegment.affected_organs,
              lession_type: updatedSegment.lession_type,
              lession_classification: updatedSegment.lession_classification,
              volume: updatedSegment.volume,
              diameter: updatedSegment.axial_diameter, // For backwards compatibility
              axial_diameter: updatedSegment.axial_diameter,
              coronal_diameter: updatedSegment.coronal_diameter,
              sagittal_diameter: updatedSegment.sagittal_diameter,
            };
          }

          // Trigger a re-render of the active viewport
          const activeViewportId = viewportGridService.getState().activeViewportId;
          if (activeViewportId) {
            const renderingEngine = cornerstoneViewportService.getRenderingEngine();
            if (renderingEngine) {
              renderingEngine.render();
            }
          }

          // Trigger segmentation modified event to update UI
          segmentationService._broadcastEvent(segmentationService.EVENTS.SEGMENTATION_MODIFIED, {
            segmentationId: activeSegmentationId,
          });
        }
      }

      // Reset temporary connection
      setTemporaryConnection({ source: null, target: null });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update segment:', error);
    }
  };

  const connectionMap = buildConnectionMap(Object.values(studies));
  const baseTrajectory = useLesionTrajectory(Object.values(studies), currentSegment?.id, connectionMap);
  
  // Global cache for updated segment stats that persists across study contexts
  const getGlobalSegmentStatsCache = () => {
    if (!(window as any).globalSegmentStatsCache) {
      (window as any).globalSegmentStatsCache = new Map();
    }
    return (window as any).globalSegmentStatsCache as Map<string, any>;
  };
  
  // Get fresh segment stats from multiple sources for real-time updates
  const getFreshSegmentStats = (segmentId: string) => {
    // First, check the global cache for persisted updates
    const globalCache = getGlobalSegmentStatsCache();
    const cachedStats = globalCache.get(segmentId);
    if (cachedStats) {
      console.log(`[EditLesionDialog] Found cached stats for ${segmentId}:`, cachedStats);
      return cachedStats;
    }
    
    // Then, check the active segmentation for fresh stats
    if (!activeSegmentationId) return null;
    
    try {
      const { segmentationService } = servicesManager?.services || {};
      if (!segmentationService) return null;
      
      const segmentation = segmentationService.getSegmentation(activeSegmentationId);
      if (!segmentation?.segments) return null;
      
      // Find segment by matching cached stats ID
      for (const [segmentIndex, segment] of Object.entries(segmentation.segments)) {
        const segmentAny = segment as any;
        if (segmentAny?.cachedStats?.id === segmentId && segmentAny.cachedStats) {
          const freshStats = {
            volume: segmentAny.cachedStats.volume,
            diameter: segmentAny.cachedStats.diameter || segmentAny.cachedStats.maxDiameter,
            axial_diameter: segmentAny.cachedStats.diameter || segmentAny.cachedStats.maxDiameter
          };
          
          console.log(`[EditLesionDialog] Found fresh stats for ${segmentId}:`, freshStats);
          
          // Cache the fresh stats globally for persistence across study contexts
          globalCache.set(segmentId, freshStats);
          
          return freshStats;
        }
      }
    } catch (error) {
      console.error('[EditLesionDialog] Error getting fresh segment stats:', error);
    }
    return null;
  };
  
  // Enhance trajectory with fresh stats for real-time updates
  const trajectory = baseTrajectory.map(studyGroup => ({
    ...studyGroup,
    segments: studyGroup.segments.map(segmentData => {
      const freshStats = getFreshSegmentStats(segmentData.segment.id);
      if (freshStats) {
        console.log(`[EditLesionDialog] Enhancing ${segmentData.segment.label} with fresh stats`);
        return {
          ...segmentData,
          segment: {
            ...segmentData.segment,
            volume: freshStats.volume,
            axial_diameter: freshStats.axial_diameter
          }
        };
      }
      return segmentData;
    })
  }));
  
  // Debug trajectory data for inconsistency tracking
  console.log(`[EditLesionDialog] Current study context:`, {
    segmentStudy: segmentStudy?.study_id,
    segmentDate: segmentStudy?.study_date,
    currentSegmentId: currentSegment?.id,
    trajectoryLength: trajectory.length
  });
  
  console.log(`[EditLesionDialog] Trajectory data:`, trajectory.map(t => ({
    study_id: t.study.study_id,
    study_date: t.study.study_date,
    segments: t.segments.map(s => ({
      id: s.segment.id,
      label: s.segment.label,
      volume: s.segment.volume,
      axial_diameter: s.segment.axial_diameter,
      coronal_diameter: s.segment.coronal_diameter,
      sagittal_diameter: s.segment.sagittal_diameter
    }))
  })));
  
  // Expand the trajectory data to see actual values
  trajectory.forEach((t, index) => {
    console.log(`[EditLesionDialog] Study ${index + 1} (${t.study.study_date}):`);
    t.segments.forEach(s => {
      console.log(`  - ${s.segment.label} (${s.segment.id}): Volume=${s.segment.volume}, Diameter=${s.segment.axial_diameter}`);
    });
  });

  const hasHistory = trajectory.length > 0;

  // Check if a segment has any origins in the connection map
  const getOriginFromConnectionMap = (segmentId: string) => {
    let origin = null;
    connectionMap.forEach((targets, sourceId) => {
      if (targets.has(segmentId)) {
        origin = sourceId;
      }
    });
    return origin;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-screen-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TooltipProvider>
            <DialogHeader>
              <DialogTitle className="text-primary-light">Lesion Information</DialogTitle>
              <DialogDescription>
                {currentSegment?.label} -{' '}
                {segmentStudy
                  ? new Date(segmentStudy.study_date).toLocaleDateString()
                  : 'Unknown date'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-8">
              {/* Left column - Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name:</Label>
                  <Input {...register('label')} />
                </div>

                <div className="space-y-2">
                  <Label>Affected Organ:</Label>
                  <div className="relative w-full">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between text-white hover:text-white',
                            !watch('affected_organs') && 'text-muted-foreground'
                          )}
                        >
                          {watch('affected_organs')
                            ? Object.entries(affectedOrgansLabels).find(
                                ([value]) => value === watch('affected_organs')
                              )?.[1]
                            : 'Select organ...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        sideOffset={4}
                      >
                        <Command className="w-full">
                          <CommandInput placeholder="Search organ..." className="h-9" />
                          <CommandList
                            className="max-h-[300px] overflow-y-auto"
                            onWheel={e => e.stopPropagation()}
                          >
                            <CommandEmpty>No organ found.</CommandEmpty>
                            <CommandGroup>
                              {Object.entries(affectedOrgansLabels)
                                .reduce(
                                  (unique, [value, label]) => {
                                    if (
                                      !unique.some(([_, existingLabel]) => existingLabel === label)
                                    ) {
                                      unique.push([value, label]);
                                    }
                                    return unique;
                                  },
                                  [] as [string, string][]
                                )
                                .sort((a, b) => a[1].localeCompare(b[1]))
                                .map(([value, label]) => (
                                  <CommandItem
                                    value={label}
                                    key={value}
                                    onSelect={() => {
                                      setValue('affected_organs', value, { shouldDirty: true });
                                    }}
                                    className="cursor-pointer"
                                  >
                                    {label}
                                    <Check
                                      className={cn(
                                        'ml-auto h-4 w-4',
                                        watch('affected_organs') === value
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type:</Label>
                  <Select
                    value={watch('lession_type')}
                    onValueChange={value =>
                      setValue('lession_type', value as 'Mass' | 'Other' | 'Lymph', {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(lesionTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Classification:</Label>
                  <Select
                    value={watch('lession_classification')}
                    onValueChange={value =>
                      setValue(
                        'lession_classification',
                        value as 'Target' | 'Non-Target' | 'New lession',
                        { shouldDirty: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(lesionClassificationLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Only show origin selection for non-basal studies */}
                {segmentStudy && !segmentStudy.is_basal && (
                  <div className="space-y-2">
                    <Label>Origin Lesion:</Label>
                    <div className="relative w-full">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between text-white hover:text-white',
                              !selectedOriginId && 'text-muted-foreground'
                            )}
                          >
                            {selectedOriginId ? (
                              <>
                                {Object.values(studies)
                                  .map(study => {
                                    if (!study.series) {
                                      return null;
                                    }
                                    for (const series of study.series) {
                                      if (!series.segmentations) {
                                        continue;
                                      }
                                      for (const seg of series.segmentations) {
                                        if (!seg.segments) {
                                          continue;
                                        }
                                        const segment = seg.segments.find(
                                          s => s.id === selectedOriginId
                                        );
                                        if (segment) {
                                          return `${segment.label} (${new Date(study.study_date).toLocaleDateString()})`;
                                        }
                                      }
                                    }
                                    return null;
                                  })
                                  .find(Boolean) || 'Select origin...'}
                              </>
                            ) : (
                              // When no origin is selected, explicitly label as standalone
                              'No origin (standalone lesion)'
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                        >
                          <Command className="w-full">
                            <CommandInput placeholder="Search lesion..." className="h-9" />
                            <CommandList
                              className="max-h-[300px] overflow-y-auto"
                              onWheel={e => e.stopPropagation()}
                            >
                              <CommandEmpty>No lesion found.</CommandEmpty>
                              <CommandGroup>
                                {/* Add No origin option */}
                                <CommandItem
                                  value="no-origin"
                                  onSelect={() => {
                                    setSelectedOriginId(null);
                                    setTemporaryConnection({ source: null, target: null });
                                  }}
                                  className="text-muted-foreground cursor-pointer font-medium"
                                >
                                  No origin (standalone lesion)
                                  <Check
                                    className={cn(
                                      'ml-auto h-4 w-4',
                                      selectedOriginId === null ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                </CommandItem>
                                {directPreviousStudy && (
                                  <React.Fragment key={directPreviousStudy.study_id}>
                                    <CommandItem
                                      value={`study-${directPreviousStudy.study_date}`}
                                      className="text-muted-foreground font-bold"
                                      disabled
                                    >
                                      {new Date(
                                        directPreviousStudy.study_date
                                      ).toLocaleDateString()}
                                    </CommandItem>
                                    {directPreviousStudy.series?.flatMap(
                                      series =>
                                        series.segmentations?.flatMap(seg =>
                                          seg.segments
                                            ?.filter(segment => segment.id !== currentSegment?.id)
                                            .map(segment => (
                                              <CommandItem
                                                value={segment.label}
                                                key={segment.id}
                                                onSelect={() => {
                                                  handleOriginSelect(segment.id);
                                                }}
                                                className="ml-2 cursor-pointer"
                                              >
                                                {segment.label}
                                                <Check
                                                  className={cn(
                                                    'ml-auto h-4 w-4',
                                                    selectedOriginId === segment.id
                                                      ? 'opacity-100'
                                                      : 'opacity-0'
                                                  )}
                                                />
                                              </CommandItem>
                                            ))
                                        ) || []
                                    ) || []}
                                  </React.Fragment>
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {selectedOriginId === null && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        This lesion will be treated as standalone with no connection to previous
                        studies.
                      </p>
                    )}
                  </div>
                )}

                {hasHistory ? (
                  <div className="space-y-2">
                    <Label>Measurements History:</Label>
                    <div className="overflow-hidden rounded border">
                      <div className="min-w-full divide-y divide-gray-200">
                        {/* Table header */}
                        <div className="bg-secondary-dark border-secondary-light">
                          <div className="text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold">
                            <div>Date</div>
                            <div>Segment</div>
                            <div>Volume (mm³)</div>
                            <div>Diameter (mm)</div>
                          </div>
                        </div>

                        {/* Table body */}
                        <div className="divide-y divide-gray-200">
                          {trajectory.map(({ study, segments, totalVolume }) => (
                            <StudyGroupRows
                              key={study.study_id}
                              study={study}
                              segments={segments}
                              totalVolume={totalVolume}
                              onSegmentSelect={handleSegmentSelect}
                              selectedSegmentId={selectedSegmentId}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Measurements History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        This lesion doesn&apos;t have any measurements history yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right column - Graph */}
              <div className="space-y-2 border-l pl-4">
                <Label>Lesion Relationships:</Label>
                {hasHistory ? (
                  <div className="border-input rounded-lg border">
                    <LesionFlowGraph
                      studies={Object.values(studies)}
                      currentStudyId={segmentStudy?.study_id || ''}
                      selectedSegmentId={currentSegment?.id}
                      onSegmentSelect={handleSegmentSelect}
                      baselineStudyId={Object.values(studies)[0]?.study_id}
                      temporaryConnection={temporaryConnection}
                    />
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Relationships</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        This lesion doesn&apos;t have any relationships with other lesions yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} variant="outline" size="lg" type="button">
                Cancel
              </Button>
              <Button variant="default" size="lg" type="submit" disabled={!isDirty}>
                Save Changes
              </Button>
            </DialogFooter>
          </TooltipProvider>
        </form>
      </DialogContent>
    </Dialog>
  );
}
