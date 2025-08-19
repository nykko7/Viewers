import React, { useState, ReactNode, useMemo } from 'react';
import { ScrollArea } from '@ohif/ui-next';
import { useSegmentationTableContext } from '@ohif/ui-next';
import { EditLesionDialog } from './EditLesionDialog';
import { SegmentGroup } from './SegmentGroup';
import { useSegmentGroups } from '../hooks/useSegmentGroups';
import { cn } from '@ohif/ui-next/lib/utils';
import { CircleDashedIcon, CircleIcon, CrosshairIcon, HelpCircleIcon, BanIcon } from 'lucide-react';
import { Types } from '@ohif/core';
import { optionalClassifications } from '../../../types';

type SegmentationType = {
  segmentationId: string;
  label: string;
  segments: Record<string, any>;
  [key: string]: any;
};

type RepresentationType = {
  type: string;
  segments: Record<string, any>;
  [key: string]: any;
};

type CustomSegmentationSegmentsProps = {
  segmentation?: SegmentationType;
  representation?: RepresentationType;
  servicesManager?: Types.Extensions.ExtensionParams['servicesManager'];
};

export function CustomSegmentationSegments({
  segmentation: initialSegmentation,
  representation: initialRepresentation,
  servicesManager,
}: CustomSegmentationSegmentsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);

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

  const groupedSegments = useSegmentGroups(
    initialRepresentation?.segments || {},
    initialSegmentation?.segments || {}
  );

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

  const handleEditInfo = (segmentationId: string, segmentIndex: number) => {
    setSelectedSegmentIndex(segmentIndex);
    setEditDialogOpen(true);
  };

  const height = mode === 'collapsed' ? 'h-[600px]' : `h-[560px]`;

  // Check if any segments have the specified classification
  const hasClassification = (classification: string): boolean => {
    if (!segmentationToUse || !segmentationToUse.segments) return false;
    
    return Object.values(segmentationToUse.segments).some(
      segment => (segment as any)?.cachedStats?.lession_classification === classification
    );
  };

  // Check which optional classifications are present in the current segmentation
  const visibleOptionalClassifications = useMemo(() => {
    return optionalClassifications.filter(classification => hasClassification(classification));
  }, [segmentationToUse]);

  const NewLesionsTitle: ReactNode = (
    <div className="flex items-center gap-2">
      <CircleDashedIcon className="h-4 w-4" />
      <span>New Lesions</span>
    </div>
  );

  const TargetLesionsTitle: ReactNode = (
    <div className="flex items-center gap-2">
      <CrosshairIcon className="h-4 w-4" />
      <span>Target Lesions</span>
    </div>
  );

  const NonTargetLesionsTitle: ReactNode = (
    <div className="flex items-center gap-2">
      <CircleIcon className="h-4 w-4" />
      <span>Non-Target Lesions</span>
    </div>
  );
  
  const NonMeasurableTitle: ReactNode = (
    <div className="flex items-center gap-2">
      <BanIcon className="h-4 w-4" />
      <span>Non-Measurable Lesions</span>
    </div>
  );
  
  const UnknownTitle: ReactNode = (
    <div className="flex items-center gap-2">
      <HelpCircleIcon className="h-4 w-4" />
      <span>Unknown Lesions</span>
    </div>
  );

  return (
    <>
      <ScrollArea
        className={cn(`ohif-scrollbar invisible-scrollbar bg-bkg-low space-y-px ${height}`)}
        showArrows={true}
      >
        {/* If there are new lesions, show them first, otherwise display at the bottom */}
        {groupedSegments['New Lesion'] && groupedSegments['New Lesion'].length > 0 && (
          <>
            <SegmentGroup
              title={NewLesionsTitle}
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
          </>
        )}
        <>
          <SegmentGroup
            title={TargetLesionsTitle}
            segments={groupedSegments['Target'] || []}
            segmentationId={segmentationIdToUse}
            disableEditing={disableEditing}
            representationType={representationToUse.type}
            servicesManager={servicesManager}
            onEditInfo={handleEditInfo}
            onSegmentColorClick={onSegmentColorClick}
            onToggleVisibility={onToggleSegmentVisibility}
            onToggleLock={onToggleSegmentLock}
            onSelect={onSegmentClick}
            onRename={onSegmentEdit}
            onDelete={onSegmentDelete}
          />
          <SegmentGroup
            title={NonTargetLesionsTitle}
            segments={groupedSegments['Non-Target'] || []}
            segmentationId={segmentationIdToUse}
            disableEditing={disableEditing}
            representationType={representationToUse.type}
            servicesManager={servicesManager}
            onEditInfo={handleEditInfo}
            onSegmentColorClick={onSegmentColorClick}
            onToggleVisibility={onToggleSegmentVisibility}
            onToggleLock={onToggleSegmentLock}
            onSelect={onSegmentClick}
            onRename={onSegmentEdit}
            onDelete={onSegmentDelete}
          />
          
          {/* Conditionally render Non-Measurable classification if it exists in the segmentation */}
          {visibleOptionalClassifications.includes('Non-Measurable') && (
            <SegmentGroup
              title={NonMeasurableTitle}
              segments={groupedSegments['Non-Measurable'] || []}
              segmentationId={segmentationIdToUse}
              disableEditing={disableEditing}
              representationType={representationToUse.type}
              servicesManager={servicesManager}
              onEditInfo={handleEditInfo}
              onSegmentColorClick={onSegmentColorClick}
              onToggleVisibility={onToggleSegmentVisibility}
              onToggleLock={onToggleSegmentLock}
              onSelect={onSegmentClick}
              onRename={onSegmentEdit}
              onDelete={onSegmentDelete}
            />
          )}
          
          {/* Conditionally render Unknown classification if it exists in the segmentation */}
          {visibleOptionalClassifications.includes('Unknown') && (
            <SegmentGroup
              title={UnknownTitle}
              segments={groupedSegments['Unknown'] || []}
              segmentationId={segmentationIdToUse}
              disableEditing={disableEditing}
              representationType={representationToUse.type}
              servicesManager={servicesManager}
              onEditInfo={handleEditInfo}
              onSegmentColorClick={onSegmentColorClick}
              onToggleVisibility={onToggleSegmentVisibility}
              onToggleLock={onToggleSegmentLock}
              onSelect={onSegmentClick}
              onRename={onSegmentEdit}
              onDelete={onSegmentDelete}
            />
          )}
          
          {(!groupedSegments['New Lesion'] || groupedSegments['New Lesion'].length <= 0) && (
            <SegmentGroup
              title={NewLesionsTitle}
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
          )}
        </>
      </ScrollArea>

      {selectedSegmentIndex !== null && (
        <EditLesionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          segmentIndex={selectedSegmentIndex}
          servicesManager={servicesManager}
        />
      )}
    </>
  );
}
