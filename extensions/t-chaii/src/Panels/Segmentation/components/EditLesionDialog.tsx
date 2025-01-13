import React, { useState, useEffect } from 'react';
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
} from '@ohif/ui-next';
import { LesionFlowGraph } from './LesionFlowGraph';
import { useSegmentationTableContext } from '@ohif/ui-next';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { formatValue } from '../../../utils/formatValue';
import { useLesionTrajectory } from '../hooks/useLesionTrajectory';
import { cn } from '@ohif/ui-next/lib/utils';
import { buildConnectionMap } from '../utils/buildConnectionMap';

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
};

// Add this type to help with measurement grouping
type MeasurementGroup = {
  segments: Segment[];
  parentSegment?: Segment;
  isSelected: boolean;
};

// Add a helper component for the study group
type StudyGroupRowsProps = {
  study: Study;
  segments: SegmentWithStudy[];
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

export function EditLesionDialog({ open, onOpenChange, segmentIndex }: EditLesionDialogProps) {
  const { data, activeSegmentationId } = useSegmentationTableContext('SegmentationTable.Segments');
  const studies = useSegmentationsStore(state => state.getStudies());
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Get active segmentation
  const activeSegmentation = data.find(
    item => item.segmentation.segmentationId === activeSegmentationId
  );

  console.log('activeSegmentation', activeSegmentation);
  console.log('studies', studies);

  // Get initial segment when dialog opens and find its study
  useEffect(() => {
    if (open && activeSegmentation) {
      const initialSegment = activeSegmentation.segmentation.segments[segmentIndex];
      if (initialSegment) {
        // Find segment ID in studies by matching the label
        for (const study of Object.values(studies)) {
          for (const series of study.series) {
            for (const seg of series.segmentations) {
              const matchingSegment = seg.segments.find(
                s => s.id === initialSegment.cachedStats.id
              );
              if (matchingSegment) {
                setSelectedSegmentId(matchingSegment.id);
                return;
              }
            }
          }
        }
      }
    }
  }, [open, segmentIndex, activeSegmentation, studies]);

  // Get current segment and its study data
  const { currentSegment, segmentStudy } = React.useMemo(() => {
    let foundSegment = null;
    let foundStudy = null;

    // First try to get selected segment from studies
    if (selectedSegmentId) {
      for (const study of Object.values(studies)) {
        for (const series of study.series) {
          for (const seg of series.segmentations) {
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
        for (const series of study.series) {
          for (const seg of series.segmentations) {
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

  // Handle form changes
  const handleInputChange = (field: string, value: string) => {
    // TODO: Implement save functionality
    console.log('Field changed:', field, value);
  };

  // Update the segment filtering logic to properly handle relationships
  const getRelatedSegments = (currentSegment: Segment | null, study: Study): MeasurementGroup[] => {
    if (!currentSegment) {
      return [];
    }

    const groups: MeasurementGroup[] = [];
    const processedSegments = new Set<string>();

    study.series.forEach(series => {
      series.segmentations.forEach(segmentation => {
        // Find segments that are related to current segment
        const relatedSegments = segmentation.segments.filter(s => {
          // Direct relationship (current segment points to this one or vice versa)
          const isDirectlyRelated =
            s.id === currentSegment.id ||
            s.lesion_segments?.includes(currentSegment.id) ||
            currentSegment.lesion_segments?.includes(s.id);

          // Sibling relationship (share same parent)
          const isSibling = segmentation.segments.some(
            parentSegment =>
              parentSegment.lesion_segments?.includes(s.id) &&
              parentSegment.lesion_segments?.includes(currentSegment.id)
          );

          return isDirectlyRelated || isSibling;
        });

        if (relatedSegments.length > 0) {
          groups.push({
            segments: relatedSegments,
            isSelected: relatedSegments.some(s => s.id === currentSegment.id),
          });
        }
      });
    });

    return groups;
  };

  const connectionMap = buildConnectionMap(Object.values(studies));
  const trajectory = useLesionTrajectory(Object.values(studies), currentSegment?.id, connectionMap);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-screen-xl">
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
                <Input
                  value={currentSegment?.label || ''}
                  onChange={e => handleInputChange('label', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Affected Organ:</Label>
                <Select
                  value={currentSegment?.affected_organs || 'other'}
                  onValueChange={value => handleInputChange('affected_organs', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="right_lung">Right lung</SelectItem>
                      <SelectItem value="left_lung">Left lung</SelectItem>
                      <SelectItem value="liver">Liver</SelectItem>
                      <SelectItem value="brain">Brain</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type:</Label>
                <Select
                  value={currentSegment?.lession_type?.toLowerCase() || 'mass'}
                  onValueChange={value => handleInputChange('lession_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="mass">Mass</SelectItem>
                      <SelectItem value="lymph_node">Lymph Node</SelectItem>
                      <SelectItem value="metastasis">Metastasis</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Classification:</Label>
                <Select
                  value={currentSegment?.lession_classification?.toLowerCase() || 'target'}
                  onValueChange={value => handleInputChange('lession_classification', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="target">Target</SelectItem>
                      <SelectItem value="non-target">Non-Target</SelectItem>
                      <SelectItem value="new-lesion">New Lesion</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

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
            </div>

            {/* Right column - Graph */}
            <div className="space-y-2 border-l pl-4">
              <Label>Lesion Relationships:</Label>
              <div className="border-input rounded-lg border">
                <LesionFlowGraph
                  studies={Object.values(studies)}
                  currentStudyId={segmentStudy?.study_id || ''}
                  selectedSegmentId={currentSegment?.id}
                  onSegmentSelect={setSelectedSegmentId}
                  baselineStudyId={Object.values(studies)[0]?.study_id}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">
              Cancel
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="default" size="lg">
              Confirm
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
