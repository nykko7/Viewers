// Re-export types from mode
export type { Study, Segment, Segmentation, SegmentationsResponse } from 'mode-t-chaii/api';

// Local extension types
export type SegmentStatsType = {
  volume: number;
  diameter: number;
  affected_organs: string;
  volume_change?: number;
  diameter_change?: number;
};

export const affectedOrgansLabels: Record<string, string> = {
  'Right lung': 'Right Lung',
  'Left lung': 'Left Lung',
  Liver: 'Liver',
  Brain: 'Brain',
};
