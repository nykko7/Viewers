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

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
};

type Segmentation = {
  segmentationId: string;
  segments: Array<{
    label: string;
    cachedStats: {
      id: string;
    };
  }>;
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
            'text-secondary-foreground grid grid-cols-6 gap-4 px-4 py-3 text-sm',
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
          <div>{formatValue(segmentData.segment.axial_diameter)}</div>
          <div>{formatValue(segmentData.segment.coronal_diameter)}</div>
          <div>{formatValue(segmentData.segment.sagittal_diameter)}</div>
        </div>
      ))}
      {segments.length > 1 && (
        <div className="text-secondary-foreground grid grid-cols-6 gap-4 bg-gray-50/10 px-4 py-2 text-sm font-semibold">
          <div></div>
          <div>Total</div>
          <div>{formatValue(totalVolume)}</div>
          <div>-</div>
          <div>-</div>
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

export function EditLesionDialog({ open, onOpenChange, segmentIndex }: EditLesionDialogProps) {
  const { data, activeSegmentationId } = useSegmentationTableContext('SegmentationTable.Segments');
  const studies = useSegmentationsStore(state => state.getStudies());
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Get active segmentation
  const activeSegmentation = data.find(
    item => item.segmentation.segmentationId === activeSegmentationId
  );

  const defaultValues = React.useMemo(
    () => ({
      label: `Segment ${segmentIndex + 1}`,
      affected_organs: '',
      lession_type: 'Mass' as const,
      lession_classification: 'New Lesion' as const,
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

  // Get current segment and its study data
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
      const initialLabel = activeSegmentation.segmentation.segments[segmentIndex]?.label;

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

    return {
      currentSegment: foundSegment,
      segmentStudy: foundStudy,
    };
  }, [selectedSegmentId, studies, activeSegmentation, segmentIndex]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setSelectedSegmentId(null);
      reset();
    };
  }, [reset]);

  const onSubmit = (data: FormValues) => {
    console.log('Form submitted:', {
      ...data,
      lession_type: data.lession_type as 'Mass' | 'Other' | 'Lymph',
      lession_classification: data.lession_classification as
        | 'Target'
        | 'Non-Target'
        | 'New lession',
    });
    // TODO: Implement save functionality
    onOpenChange(false);
  };

  const connectionMap = buildConnectionMap(Object.values(studies));
  const trajectory = useLesionTrajectory(Object.values(studies), currentSegment?.id, connectionMap);

  const hasHistory = trajectory.length > 0;

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

                {hasHistory ? (
                  <div className="space-y-2">
                    <Label>Measurements History:</Label>
                    <div className="overflow-hidden rounded border">
                      <div className="min-w-full divide-y divide-gray-200">
                        {/* Table header */}
                        <div className="bg-secondary-dark border-secondary-light">
                          <div className="text-secondary-foreground grid grid-cols-6 gap-4 px-4 py-3 text-sm font-semibold">
                            <div>Date</div>
                            <div>Segment</div>
                            <div>Volume (mm³)</div>
                            <div>Axial Diameter (mm)</div>
                            <div>Coronal Diameter (mm)</div>
                            <div>Sagittal Diameter (mm)</div>
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
                              onSegmentSelect={setSelectedSegmentId}
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
                      onSegmentSelect={setSelectedSegmentId}
                      baselineStudyId={Object.values(studies)[0]?.study_id}
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
