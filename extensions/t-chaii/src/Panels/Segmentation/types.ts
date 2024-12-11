export type LesionBehavior = 'maintained' | 'joined' | 'separated';

export type LesionClassification = 'Target' | 'Non-Target' | 'New Lesion';

export type LesionType = 'Lymph node' | 'Tumor' | 'Mass' | 'Nodule';

export type AffectedOrgan = 'Right lung' | 'Left lung' | 'Liver' | 'Brain';

export type LesionControl = {
  control: string;
  date: string;
  volume: number;
  axialDiameter: number;
  majorDiameter: number;
  volumeChange?: number;
  axialDiameterChange?: number;
  majorDiameterChange?: number;
};

export type LesionStats = {
  volume: number;
  diameter: number;
  affected_organs: AffectedOrgan;
  volume_change?: number;
  diameter_change?: number;
};

export type LesionInfo = {
  name: string;
  organ: AffectedOrgan;
  type: LesionType;
  classification: LesionClassification;
  behavior?: LesionBehavior;
  currentControl?: number;
  controls: LesionControl[];
  stats?: LesionStats;
  metadata?: {
    createdAt: string;
    updatedAt: string;
    userId: string;
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
  };
  relationships?: {
    parentId?: string;
    childrenIds?: string[];
    relatedLesionIds?: string[];
  };
};

export type SegmentStatsType = {
  volume: number;
  diameter: number;
  affected_organs: AffectedOrgan;
  volume_change?: number;
  diameter_change?: number;
  [key: string]: number | string | undefined;
};
