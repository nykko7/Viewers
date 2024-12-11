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

  const formatDetails = () => {
    const primary = [];
    const secondary = [];

    if (cachedStats?.volume) {
      primary.push(`Volume: ${cachedStats.volume} ml`);
    }
    if (cachedStats?.diameter) {
      primary.push(`Diameter: ${cachedStats.diameter} mm`);
    }
    if (cachedStats?.affected_organs) {
      secondary.push(`Organ: ${cachedStats.affected_organs}`);
    }
    if (displayText) {
      secondary.push(displayText);
    }

    return {
      primary,
      secondary,
    };
  };

  return (
    <div className="flex flex-col">
      <DataRow
        number={segmentIndex}
        title={label}
        description={displayText}
        details={formatDetails()}
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

      <SegmentStats stats={cachedStats} />

      <Button
        variant="outline"
        size="sm"
        className="ml-8 mb-2"
        onClick={() => onEditInfo(segmentationId, segmentIndex)}
      >
        Edit info
      </Button>
    </div>
  );
}
