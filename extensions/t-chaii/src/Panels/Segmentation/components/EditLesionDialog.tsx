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

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
};

export function EditLesionDialog({ open, onOpenChange, segmentIndex }: EditLesionDialogProps) {
  const { data, activeSegmentationId } = useSegmentationTableContext('SegmentationTable.Segments');
  const studies = useSegmentationsStore(state => state.getStudies());
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Get active segmentation
  const activeSegmentation = data.find(
    item => item.segmentation.segmentationId === activeSegmentationId
  );

  console.log('activeSegmentation', activeSegmentation);

  // Get initial segment when dialog opens and find its study
  useEffect(() => {
    if (open && activeSegmentation) {
      const initialSegment = activeSegmentation.segmentation.segments[segmentIndex];
      if (initialSegment) {
        // Find segment ID in studies by matching the label
        for (const study of Object.values(studies)) {
          for (const series of study.series) {
            for (const seg of series.segmentations) {
              const matchingSegment = seg.segments.find(s => s.label === initialSegment.label);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
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
                    <div className="bg-secondary-dark border-secondary-light">
                      <div className="text-secondary-foreground grid grid-cols-5 gap-4 px-4 py-3 text-sm font-semibold">
                        <div>Date</div>
                        <div>Volume (mm³)</div>
                        <div>Axial Diameter (mm)</div>
                        <div>Coronal Diameter (mm)</div>
                        <div>Sagittal Diameter (mm)</div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {Object.values(studies)
                        .sort(
                          (a, b) =>
                            new Date(a.study_date).getTime() - new Date(b.study_date).getTime()
                        )
                        .map(study => {
                          // Find all related segments in this study
                          const segments = study.series
                            .flatMap(s =>
                              s.segmentations.flatMap(seg =>
                                seg.segments.filter(s => {
                                  // Include the current segment
                                  if (s.id === currentSegment?.id) {
                                    return true;
                                  }
                                  // Include only direct relationships
                                  if (currentSegment?.lesion_segments?.includes(s.id)) {
                                    return true;
                                  }
                                  // Include segments that directly point to this segment
                                  if (s.lesion_segments?.includes(currentSegment?.id || '')) {
                                    return true;
                                  }
                                  return false;
                                })
                              )
                            )
                            .filter(Boolean);

                          if (segments.length === 0) {
                            return null;
                          }

                          const isSelectedStudy = segments.some(s => s.id === selectedSegmentId);
                          const isCurrentStudy = study.study_id === segmentStudy?.study_id;

                          // Calculate totals
                          const totalVolume = segments.reduce(
                            (sum, seg) => sum + (seg.volume || 0),
                            0
                          );
                          const individualVolumes = segments.map(s => s.volume).filter(Boolean);

                          const volumeDisplay =
                            segments.length > 1
                              ? `${totalVolume} (${individualVolumes.join(' + ')})`
                              : totalVolume;

                          return (
                            <div
                              key={study.study_id}
                              className={`text-secondary-foreground grid grid-cols-5 gap-4 px-4 py-3 text-sm ${
                                isSelectedStudy
                                  ? 'border-l-4 !border-l-[#2563eb] bg-[#2563eb]/10'
                                  : isCurrentStudy
                                    ? 'bg-blue-50/30'
                                    : ''
                              }`}
                            >
                              <div className="font-medium">
                                {new Date(study.study_date).toLocaleDateString()}
                              </div>
                              <div>{volumeDisplay}</div>
                              <div>
                                {segments
                                  .map(s => s.axial_diameter)
                                  .filter(Boolean)
                                  .join(' + ') || '--'}
                              </div>
                              <div>
                                {segments
                                  .map(s => s.coronal_diameter)
                                  .filter(Boolean)
                                  .join(' + ') || '--'}
                              </div>
                              <div>
                                {segments
                                  .map(s => s.sagittal_diameter)
                                  .filter(Boolean)
                                  .join(' + ') || '--'}
                              </div>
                            </div>
                          );
                        })}
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
