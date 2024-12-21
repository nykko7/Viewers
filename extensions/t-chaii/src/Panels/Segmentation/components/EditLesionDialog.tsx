import React, { useState } from 'react';
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

import {
  LesionInfo,
  StudySegments,
  AffectedOrgan,
  LesionType,
  LesionClassification,
} from '../../../types';
import { LesionFlowGraph } from './LesionFlowGraph';

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
  initialData?: Partial<LesionInfo>;
  onSave?: (data: LesionInfo) => void;
};

const DEFAULT_STUDY_SEGMENTS: StudySegments[] = [
  {
    created_at: '01/08/2024',
    updated_at: '01/08/2024',
    volume: 100,
    name: 'Study 1',
    axial_diameter: 5,
    coronal_diameter: 8,
    sagittal_diameter: 8,
    is_target_lession: true,
    classification: 'Target',
    lesion_segments: ['L1', 'L2', 'L3'],
  },
  {
    created_at: '01/08/2024',
    updated_at: '01/08/2024',
    volume: 100,
    name: 'Study 2',
    axial_diameter: 5,
    coronal_diameter: 8,
    sagittal_diameter: 8,
    is_target_lession: true,
    classification: 'Target',
    lesion_segments: ['L1', 'L2', 'L3'],
  },
  {
    created_at: '01/08/2024',
    updated_at: '01/08/2024',
    volume: 100,
    name: 'Study 3',
    axial_diameter: 5,
    coronal_diameter: 8,
    sagittal_diameter: 8,
    is_target_lession: true,
    classification: 'Target',
    lesion_segments: ['L1', 'L2', 'L3'],
  },
  // ... add more default controls if needed
];

export function EditLesionDialog({
  open,
  onOpenChange,
  segmentIndex,
  initialData,
  onSave,
}: EditLesionDialogProps) {
  const [formData, setFormData] = useState<LesionInfo>({
    name: initialData?.name ?? `Lesion ${segmentIndex + 1}`,
    organ: initialData?.organ ?? 'Right lung',
    type: initialData?.type ?? 'Lymph node',
    classification: initialData?.classification ?? 'Target',
    studySegments: initialData?.studySegments ?? DEFAULT_STUDY_SEGMENTS,
  });

  const [selectedLesionId, setSelectedLesionId] = useState('L1');

  const handleConfirm = () => {
    onSave?.(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle className="text-primary-light">Lesion Information</DialogTitle>
            <DialogDescription>
              Select the lesion to edit and update the information below.
            </DialogDescription>
            <div className="mt-4">
              <Label>Select Lesion:</Label>
              <Select value={selectedLesionId} onValueChange={setSelectedLesionId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">Lesion 1</SelectItem>
                  <SelectItem value="L2">Lesion 2</SelectItem>
                  <SelectItem value="L3">Lesion 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name:</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Affected Organ:</Label>
                <Select
                  value={formData.organ}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, organ: value as AffectedOrgan }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Right lung">Right lung</SelectItem>
                      <SelectItem value="Left lung">Left lung</SelectItem>
                      <SelectItem value="Liver">Liver</SelectItem>
                      <SelectItem value="Brain">Brain</SelectItem>
                      <SelectItem value="test">test</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type:</Label>
                <Select
                  value={formData.type}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, type: value as LesionType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Lymph node">Lymph node</SelectItem>
                      <SelectItem value="Tumor">Tumor</SelectItem>
                      <SelectItem value="Mass">Mass</SelectItem>
                      <SelectItem value="Nodule">Nodule</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Classification:</Label>
                <Select
                  value={formData.classification}
                  onValueChange={value =>
                    setFormData(prev => ({
                      ...prev,
                      classification: value as LesionClassification,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Target">Target</SelectItem>
                      <SelectItem value="Non-Target">Non-Target</SelectItem>
                      <SelectItem value="New Lesion">New Lesion</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lesion Follow-up:</Label>
                <div className="overflow-hidden rounded border">
                  <div className="min-w-full divide-y divide-gray-200">
                    <div className="bg-secondary-dark border-secondary-light">
                      <div className="text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold">
                        <div>Study Date</div>
                        <div>
                          Volume (cm<sup>3</sup>)
                        </div>
                        <div>Major Axial Diameter (mm)</div>
                        <div>Major Diameter (mm)</div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {formData.studySegments.map((studySegment, index) => (
                        <div
                          key={index}
                          className="text-secondary-foreground grid grid-cols-4 gap-4 px-4 py-3 text-sm"
                        >
                          <div>{studySegment.created_at}</div>
                          <div>{studySegment.volume}</div>
                          <div>{studySegment.axial_diameter}</div>
                          <div>
                            {Math.max(
                              studySegment.coronal_diameter,
                              studySegment.sagittal_diameter
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-l pl-4">
              <Label>Lesion Follow-up Graph:</Label>
              <div className="border-input rounded-lg border">
                <LesionFlowGraph
                  type="separated"
                  currentControl={2}
                  selectedLesionId={selectedLesionId}
                  onLesionSelect={setSelectedLesionId}
                  lesionInfo={formData}
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
