import React, { useState } from 'react';
import { ScrollArea, DataRow } from '@ohif/ui-next';
import { useSegmentationTableContext } from '@ohif/ui-next';
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
} from '@ohif/ui-next';

type LesionControl = {
  control: string;
  date: string;
  volume: number;
  axialDiameter: number;
  majorDiameter: number;
};

type EditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentIndex: number;
};

const EditDialog: React.FC<EditDialogProps> = ({ open, onOpenChange, segmentIndex }) => {
  const [name, setName] = useState(`Lesion ${segmentIndex + 1}`);
  const [organ, setOrgan] = useState('Right lung');
  const [type, setType] = useState('Lymph node');
  const [classification, setClassification] = useState('Target');
  const [controls] = useState<LesionControl[]>([
    {
      control: 'Control 1',
      date: '01/08/2024',
      volume: 2,
      axialDiameter: 5,
      majorDiameter: 8,
    },
    {
      control: 'Control 2',
      date: '02/12/2024',
      volume: 3,
      axialDiameter: 2,
      majorDiameter: 8,
    },
    {
      control: 'Control 3',
      date: '03/06/2024',
      volume: 4,
      axialDiameter: 3,
      majorDiameter: 8,
    },
    {
      control: 'Control 4',
      date: '04/18/2024',
      volume: 3,
      axialDiameter: 4,
      majorDiameter: 8,
    },
    {
      control: 'Control 5',
      date: '05/24/2024',
      volume: 2,
      axialDiameter: 3,
      majorDiameter: 8,
    },
  ]);

  const handleConfirm = () => {
    // TODO: Handle saving the changes
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary-light">Lesion Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name:</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Affected Organ:</Label>
            <Select value={organ} onValueChange={setOrgan}>
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
            <Select value={type} onValueChange={setType}>
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
            <Select value={classification} onValueChange={setClassification}>
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
                    <div>Volume (cm3)</div>
                    <div>Major Axial Diameter (mm)</div>
                    <div>Major Diameter (mm)</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {controls.map((control, index) => (
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

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="default">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const CustomSegmentationSegments: React.FC<{
  segmentation?: unknown;
  representation?: unknown;
}> = ({ segmentation, representation }) => {
  const {
    activeSegmentationId,
    disableEditing,
    onSegmentColorClick,
    onToggleSegmentVisibility,
    onToggleSegmentLock,
    onSegmentClick,
    mode,
    onSegmentEdit,
    onSegmentDelete,
    data,
  } = useSegmentationTableContext('SegmentationTable.Segments');

  let segmentationToUse = segmentation;
  let representationToUse = representation;
  let segmentationIdToUse = activeSegmentationId;
  if (!segmentationToUse || !representationToUse) {
    const entry = data.find(seg => seg.segmentation.segmentationId === activeSegmentationId);
    segmentationToUse = entry?.segmentation;
    representationToUse = entry?.representation;
    segmentationIdToUse = entry?.segmentation.segmentationId;
  }

  if (!representationToUse || !segmentationToUse) {
    return null;
  }

  const segmentCount = Object.keys(representationToUse.segments).length;
  const height = mode === 'collapsed' ? 'h-[600px]' : `h-[${segmentCount * 200}px]`;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);

  const handleEditInfo = (segmentationId: string, segmentIndex: number) => {
    setSelectedSegmentIndex(segmentIndex);
    setEditDialogOpen(true);
  };

  const renderChangeValue = change => {
    if (change > 0) {
      return <span className="ml-2 text-red-500">(+{change}%)</span>;
    } else if (change < 0) {
      return <span className="ml-2 text-green-500">({change}%)</span>;
    } else if (change === 0) {
      return <span className="ml-2 text-gray-500">({change}%)</span>;
    }
    return null;
  };

  const segmentAdditionalStats = {
    volume: {
      label: 'Volume',
      unit: 'ml',
    },
    diameter: {
      label: 'Diameter',
      unit: 'mm',
    },
    affected_organs: {
      label: 'Organ',
      unit: null,
    },
  };

  // Group segments by classification
  const groupedSegments = Object.values(representationToUse.segments).reduce(
    (acc, segment) => {
      if (!segment) return acc;

      const segmentFromSegmentation = segmentationToUse.segments[segment.segmentIndex];
      if (!segmentFromSegmentation) return acc;

      // Default to 'Non-Target' if classification is not set
      const classification = segmentFromSegmentation.classification || 'Target';

      if (!acc[classification]) {
        acc[classification] = [];
      }

      acc[classification].push({ segment, segmentFromSegmentation });
      return acc;
    },
    {} as Record<string, Array<{ segment: any; segmentFromSegmentation: any }>>
  );

  const renderSegmentGroup = (title: string, segments: Array<any>) => {
    if (!segments || segments.length === 0) return null;

    return (
      <div className="mb-4">
        <h3 className="text-primary-light p-2 text-lg font-semibold">{title}:</h3>
        {segments.map(({ segment, segmentFromSegmentation }) => {
          const { segmentIndex, color, visible } = segment;
          const { locked, active, label, displayText, cachedStats } = segmentFromSegmentation;
          const cssColor = `rgb(${color[0]},${color[1]},${color[2]})`;

          return (
            <div key={segmentIndex} className="flex flex-col">
              <DataRow
                number={segmentIndex}
                title={label}
                details={displayText}
                colorHex={cssColor}
                isSelected={active}
                isVisible={visible}
                isLocked={locked}
                disableEditing={disableEditing}
                onColor={() => onSegmentColorClick(segmentationIdToUse, segmentIndex)}
                onToggleVisibility={() =>
                  onToggleSegmentVisibility(
                    segmentationIdToUse,
                    segmentIndex,
                    representationToUse.type
                  )
                }
                onToggleLocked={() => onToggleSegmentLock(segmentationIdToUse, segmentIndex)}
                onSelect={() => onSegmentClick(segmentationIdToUse, segmentIndex)}
                onRename={() => onSegmentEdit(segmentationIdToUse, segmentIndex)}
                onDelete={() => onSegmentDelete(segmentationIdToUse, segmentIndex)}
              />

              <div className="ml-7 flex flex-col px-2 py-2">
                {Object.entries(segmentAdditionalStats).map(([key, value]) => (
                  <div
                    key={key}
                    className="text-secondary-foreground flex h-full items-center justify-between text-base leading-normal"
                  >
                    <span className="flex-1">{value.label}:</span>
                    <span className="flex-1 font-bold">
                      {cachedStats[key]} {value.unit}
                      {cachedStats[`${key}_change`] &&
                        renderChangeValue(cachedStats[`${key}_change`])}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-8 mb-2"
                onClick={() => handleEditInfo(segmentationIdToUse, segmentIndex)}
              >
                Edit info
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <ScrollArea
        className={`ohif-scrollbar invisible-scrollbar bg-bkg-low space-y-px ${height}`}
        showArrows={true}
      >
        {renderSegmentGroup('Target Lesions', groupedSegments['Target'])}
        {renderSegmentGroup('Non-Target Lesions', groupedSegments['Non-Target'])}
        {renderSegmentGroup('New Lesions', groupedSegments['New Lesion'])}
      </ScrollArea>

      {selectedSegmentIndex !== null && (
        <EditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          segmentIndex={selectedSegmentIndex}
        />
      )}
    </>
  );
};
