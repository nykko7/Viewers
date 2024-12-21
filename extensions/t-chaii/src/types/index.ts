export type LesionBehavior = 'maintained' | 'joined' | 'separated';

export type LesionClassification = 'Target' | 'Non-Target' | 'New Lesion';

export type LesionType = 'Lymph node' | 'Tumor' | 'Mass' | 'Nodule';

export type AffectedOrgan = 'Right lung' | 'Left lung' | 'Liver' | 'Brain';

export type StudySegments = {
  created_at: string;
  updated_at: string;
  name: string;
  axial_diameter: number;
  coronal_diameter: number;
  sagittal_diameter: number;
  volume: number;
  is_target_lession: boolean;
  classification: LesionClassification;
  lesion_segments: string[];
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
  studySegments: StudySegments[];
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

export const affectedOrgansLabels = {
  right_lung: 'Right lung',
  left_lung: 'Left lung',
  liver: 'Liver',
  brain: 'Brain',
  test: 'Test',
  other: 'Other',
};
