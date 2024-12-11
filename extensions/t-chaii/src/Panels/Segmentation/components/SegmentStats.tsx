import React from 'react';
import { SegmentStats as SegmentStatsType } from '../types';

type SegmentStatsProps = {
  stats: SegmentStatsType;
  showChangeValues?: boolean;
};

export function SegmentStats({ stats, showChangeValues = true }: SegmentStatsProps) {
  const segmentAdditionalStats = {
    volume: {
      label: 'Volume',
      unit: 'mm³',
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

  const renderChangeValue = (change: number) => {
    if (!showChangeValues) return null;

    if (change > 0) {
      return <span className="ml-2 text-red-500">(+{change}%)</span>;
    } else if (change < 0) {
      return <span className="ml-2 text-green-500">({change}%)</span>;
    } else if (change === 0) {
      return <span className="ml-2 text-gray-500">({change}%)</span>;
    }
    return null;
  };

  return (
    <div className="ml-7 flex flex-col px-2 py-2">
      {Object.entries(segmentAdditionalStats).map(([key, value]) => (
        <div
          key={key}
          className="text-secondary-foreground flex h-full items-center justify-between text-base leading-normal"
        >
          <span className="flex-1">{value.label}:</span>
          <span className="flex-1 font-bold">
            {stats[key]} {value.unit}
            {stats[`${key}_change`] && renderChangeValue(stats[`${key}_change`] as number)}
          </span>
        </div>
      ))}
    </div>
  );
}
