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
import type { Study, Segment } from '../../../types';

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
};

export function EditLesionDialog({ open, onOpenChange, segmentIndex }: EditLesionDialogProps) {
  const { data, activeSegmentationId } = useSegmentationTableContext('SegmentationTable.Segments');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const activeSegmentation = data.find(
    item => item.segmentation.segmentationId === activeSegmentationId
  );
  const currentSegment = activeSegmentation?.segmentation.segments[segmentIndex];

  // Transform studies object into array
  const studies = React.useMemo(() => {
    const studiesObj = activeSegmentation?.segmentation.cachedStats?.studies;
    if (!studiesObj || typeof studiesObj !== 'object') {
      return [];
    }

    return Object.entries(studiesObj).map(([studyInstanceUID, study]) => ({
      study_id: studyInstanceUID,
      ...study,
    }));
  }, [activeSegmentation?.segmentation.cachedStats?.studies]);

  console.log('Transformed studies:', {
    rawStudies: activeSegmentation?.segmentation.cachedStats?.studies,
    transformedStudies: studies,
  });

  useEffect(() => {
    if (currentSegment) {
      setSelectedSegmentId(currentSegment.id);
    }
  }, [currentSegment]);

  const handleConfirm = () => {
    onOpenChange(false);
  };

  if (!currentSegment || !activeSegmentation) {
    return null;
  }

  const currentStudyId =
    studies.length > 0
      ? studies.find(study =>
          study.series?.some(series =>
            series.segmentations?.some(seg => seg.segmentation_id === activeSegmentationId)
          )
        )?.study_id
      : undefined;

  console.log({
    studies,
    currentStudyId,
    cachedStats: activeSegmentation?.segmentation.cachedStats,
    currentSegment,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle className="text-primary-light">Lesion Information</DialogTitle>
            <DialogDescription>
              View and edit lesion information and relationships
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name:</Label>
                <Input value={currentSegment.label || ''} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Affected Organ:</Label>
                <Select value={currentSegment.cachedStats.affected_organs || 'other'}>
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
                <Select value={currentSegment.cachedStats.lesion_type || 'mass'}>
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
                <Select value={currentSegment.cachedStats.lesion_classification || 'target'}>
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
                <Label>Measurements:</Label>
                <div className="overflow-hidden rounded border">
                  <div className="min-w-full divide-y divide-gray-200">
                    <div className="bg-secondary-dark border-secondary-light">
                      <div className="text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold">
                        <div>Volume (mm³)</div>
                        <div>Axial Diameter (mm)</div>
                        <div>Coronal Diameter (mm)</div>
                        <div>Sagittal Diameter (mm)</div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      <div className="text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm">
                        <div>{currentSegment.cachedStats.volume || '--'}</div>
                        <div>{currentSegment.cachedStats.axial_diameter || '--'}</div>
                        <div>{currentSegment.cachedStats.coronal_diameter || '--'}</div>
                        <div>{currentSegment.cachedStats.sagittal_diameter || '--'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-l pl-4">
              <Label>Lesion Relationships:</Label>
              <div className="border-input rounded-lg border">
                <LesionFlowGraph
                  studies={studies}
                  currentStudyId={currentStudyId || ''}
                  selectedSegmentId={selectedSegmentId}
                  onSegmentSelect={setSelectedSegmentId}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">
              Cancel
            </Button>
            <Button onClick={handleConfirm} variant="default" size="lg">
              Confirm
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
