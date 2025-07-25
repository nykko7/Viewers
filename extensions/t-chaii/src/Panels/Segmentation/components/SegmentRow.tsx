import React from 'react';
import { DataRow } from '@ohif/ui-next';
import { Button } from '@ohif/ui-next';
import { SegmentStats } from './SegmentStats';

type SegmentRowProps = {
  segmentationId: string;
  segmentIndex: number;
  label: string;
  displayText: string;
  color: [number, number, number];
  visible: boolean;
  locked: boolean;
  active: boolean;
  disableEditing: boolean;
  cachedStats: any;
  representationType: string;
  onEditInfo: (segmentationId: string, segmentIndex: number) => void;
  onSegmentColorClick: (segmentationId: string, segmentIndex: number) => void;
  onToggleVisibility: (segmentationId: string, segmentIndex: number, type: string) => void;
  onToggleLock: (segmentationId: string, segmentIndex: number) => void;
  onSelect: (segmentationId: string, segmentIndex: number) => void;
  onRename: (segmentationId: string, segmentIndex: number) => void;
  onDelete: (segmentationId: string, segmentIndex: number) => void;
};

export function SegmentRow({
  segmentationId,
  segmentIndex,
  label,
  displayText,
  color,
  visible,
  locked,
  active,
  disableEditing,
  cachedStats,
  representationType,
  onEditInfo,
  onSegmentColorClick,
  onToggleVisibility,
  onToggleLock,
  onSelect,
  onRename,
  onDelete,
}: SegmentRowProps) {
  const cssColor = `rgb(${color[0]},${color[1]},${color[2]})`;

  return (
    <div className="flex flex-col">
      <DataRow
        number={segmentIndex}
        title={label}
        description={displayText}
        colorHex={cssColor}
        isSelected={active}
        isVisible={visible}
        isLocked={locked}
        disableEditing={disableEditing}
        onColor={() => onSegmentColorClick(segmentationId, segmentIndex)}
        onToggleVisibility={() =>
          onToggleVisibility(segmentationId, segmentIndex, representationType)
        }
        onToggleLocked={() => onToggleLock(segmentationId, segmentIndex)}
        onSelect={() => onSelect(segmentationId, segmentIndex)}
        onRename={() => onRename(segmentationId, segmentIndex)}
        onDelete={() => onDelete(segmentationId, segmentIndex)}
      />

      <SegmentStats
        stats={cachedStats}
        showChangeValues={false}
        isCalculating={(cachedStats as any)?.isCalculating || false}
        segmentationId={segmentationId}
        segmentIndex={segmentIndex}
      />

      <Button
        variant="outline"
        size="sm"
        className="ml-8 mb-2 mr-2"
        onClick={() => onEditInfo(segmentationId, segmentIndex)}
      >
        Details
      </Button>
    </div>
  );
}
