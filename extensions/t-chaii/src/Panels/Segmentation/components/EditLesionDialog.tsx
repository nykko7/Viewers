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
} from '@ohif/ui-next';
import {
  LesionInfo,
  LesionControl,
  AffectedOrgan,
  LesionType,
  LesionClassification,
} from '../types';
import { LesionFlowGraph } from './LesionFlowGraph';

type EditLesionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
  initialData?: Partial<LesionInfo>;
  onSave?: (data: LesionInfo) => void;
};

const DEFAULT_CONTROLS: LesionControl[] = [
  {
    control: 'Control 1',
    date: '01/08/2024',
    volume: 2,
    axialDiameter: 5,
    majorDiameter: 8,
  },
  {
    control: 'Control 2',
    date: '01/08/2024',
    volume: 2,
    axialDiameter: 5,
    majorDiameter: 8,
  },
  {
    control: 'Control 3',
    date: '01/08/2024',
    volume: 2,
    axialDiameter: 5,
    majorDiameter: 8,
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
    controls: initialData?.controls ?? DEFAULT_CONTROLS,
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

            <div className="mt-4">
              <Label>Select Lesion:</Label>
              <Select value={selectedLesionId} onValueChange={setSelectedLesionId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">Lesion 1</SelectItem>
                  <SelectItem value="L2">Lesion 2</SelectItem>
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
                <Label>Control Follow-up:</Label>
                <div className="overflow-hidden rounded border">
                  <div className="min-w-full divide-y divide-gray-200">
                    <div className="bg-secondary-dark border-secondary-light">
                      <div className="text-secondary-foreground grid grid-cols-5 gap-4 px-4 py-3 text-sm font-semibold">
                        <div>Control</div>
                        <div>Date</div>
                        <div>
                          Volume (cm<sup>3</sup>)
                        </div>
                        <div>Major Axial Diameter (mm)</div>
                        <div>Major Diameter (mm)</div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {formData.controls.map((control, index) => (
                        <div
                          key={index}
                          className="text-secondary-foreground grid grid-cols-5 gap-4 px-4 py-3 text-sm"
                        >
                          <div>{control.control}</div>
                          <div>{control.date}</div>
                          <div>{control.volume}</div>
                          <div>{control.axialDiameter}</div>
                          <div>{control.majorDiameter}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-l pl-4">
              <Label>Lesion Follow-up Graph:</Label>
              <LesionFlowGraph
                type="maintained"
                currentControl={2}
                selectedLesionId={selectedLesionId}
                onLesionSelect={setSelectedLesionId}
                lesionInfo={formData}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleConfirm} variant="default">
              Confirm
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
