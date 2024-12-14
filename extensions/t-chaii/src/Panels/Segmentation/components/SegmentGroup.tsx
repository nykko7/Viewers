import React from 'react';
import { SegmentRow } from './SegmentRow';
import { cn } from '@ohif/ui-next/lib/utils';

type SegmentGroupProps = {
  title: string;
  segments: Array<{
    segment: any;
    segmentFromSegmentation: any;
  }>;
  className?: string;
  segmentationId: string;
  disableEditing: boolean;
  representationType: string;
  onEditInfo: (segmentationId: string, segmentIndex: number) => void;
  onSegmentColorClick: (segmentationId: string, segmentIndex: number) => void;
  onToggleVisibility: (segmentationId: string, segmentIndex: number, type: string) => void;
  onToggleLock: (segmentationId: string, segmentIndex: number) => void;
  onSelect: (segmentationId: string, segmentIndex: number) => void;
  onRename: (segmentationId: string, segmentIndex: number) => void;
  onDelete: (segmentationId: string, segmentIndex: number) => void;
};

export function SegmentGroup({
  title,
  segments,
  segmentationId,
  disableEditing,
  representationType,
  onEditInfo,
  onSegmentColorClick,
  onToggleVisibility,
  onToggleLock,
  onSelect,
  onRename,
  onDelete,
  className,
}: SegmentGroupProps) {
  return (
    <div className={cn('mb-4', className)}>
      <h3 className="text-primary-light p-2 text-lg font-semibold">{title}:</h3>
      {segments &&
        segments.length >= 0 &&
        segments.map(({ segment, segmentFromSegmentation }) => {
          const { segmentIndex, color, visible } = segment;
          const { locked, active, label, displayText, cachedStats } = segmentFromSegmentation;

          return (
            <SegmentRow
              key={segmentIndex}
              segmentationId={segmentationId}
              segmentIndex={segmentIndex}
              label={label}
              displayText={displayText}
              color={color}
              visible={visible}
              locked={locked}
              active={active}
              disableEditing={disableEditing}
              cachedStats={cachedStats}
              representationType={representationType}
              onEditInfo={onEditInfo}
              onSegmentColorClick={onSegmentColorClick}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          );
        })}
    </div>
  );
}
