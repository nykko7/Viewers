import React, { useState } from 'react';
import { ScrollArea } from '@ohif/ui-next';
import { useSegmentationTableContext } from '@ohif/ui-next';
import { EditLesionDialog } from './EditLesionDialog';
import { SegmentGroup } from './SegmentGroup';
import { useSegmentGroups } from '../hooks/useSegmentGroups';
import { SegmentRow } from './SegmentRow';

type CustomSegmentationSegmentsProps = {
  segmentation?: any;
  representation?: any;
};

export function CustomSegmentationSegments({
  segmentation: initialSegmentation,
  representation: initialRepresentation,
}: CustomSegmentationSegmentsProps) {
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

  let segmentationToUse = initialSegmentation;
  let representationToUse = initialRepresentation;
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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);

  const handleEditInfo = (segmentationId: string, segmentIndex: number) => {
    setSelectedSegmentIndex(segmentIndex);
    setEditDialogOpen(true);
  };

  const segmentCount = Object.keys(representationToUse.segments || {}).length;
  const height = mode === 'collapsed' ? 'h-[600px]' : `h-[${segmentCount * 200}px]`;

  const groupedSegments = useSegmentGroups(
    representationToUse.segments || {},
    segmentationToUse.segments || {}
  );

  return (
    <>
      <ScrollArea
        className={`ohif-scrollbar invisible-scrollbar bg-bkg-low space-y-px ${height}`}
        showArrows={true}
      >
        <SegmentGroup
          title="Target Lesions"
          segments={groupedSegments['Target'] || []}
          segmentationId={segmentationIdToUse}
          disableEditing={disableEditing}
          representationType={representationToUse.type}
          onEditInfo={handleEditInfo}
          onSegmentColorClick={onSegmentColorClick}
          onToggleVisibility={onToggleSegmentVisibility}
          onToggleLock={onToggleSegmentLock}
          onSelect={onSegmentClick}
          onRename={onSegmentEdit}
          onDelete={onSegmentDelete}
        />
        <SegmentGroup
          title="Non-Target Lesions"
          segments={groupedSegments['Non-Target'] || []}
          segmentationId={segmentationIdToUse}
          disableEditing={disableEditing}
          representationType={representationToUse.type}
          onEditInfo={handleEditInfo}
          onSegmentColorClick={onSegmentColorClick}
          onToggleVisibility={onToggleSegmentVisibility}
          onToggleLock={onToggleSegmentLock}
          onSelect={onSegmentClick}
          onRename={onSegmentEdit}
          onDelete={onSegmentDelete}
        />
        <SegmentGroup
          title="New Lesions"
          segments={groupedSegments['New Lesion'] || []}
          segmentationId={segmentationIdToUse}
          disableEditing={disableEditing}
          representationType={representationToUse.type}
          onEditInfo={handleEditInfo}
          onSegmentColorClick={onSegmentColorClick}
          onToggleVisibility={onToggleSegmentVisibility}
          onToggleLock={onToggleSegmentLock}
          onSelect={onSegmentClick}
          onRename={onSegmentEdit}
          onDelete={onSegmentDelete}
        />
      </ScrollArea>

      {selectedSegmentIndex !== null && (
        <EditLesionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          segmentIndex={selectedSegmentIndex}
        />
      )}
    </>
  );
}
