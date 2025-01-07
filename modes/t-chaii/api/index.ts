type BaseEntity = {
  id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

type Segment = BaseEntity & {
  name: string;
  label: string;
  tracking_id: string;
  affected_organs: string;
  volume: number;
  axial_diameter: number | null;
  coronal_diameter: number | null;
  sagittal_diameter: number | null;
  lession_classification: 'Target' | 'Non-Target' | 'New lession';
  lession_type: 'Mass' | 'Other';
  segmentation_type: string;
  window_width: number | null;
  window_level: number | null;
  status: string;
  lesion_segmentation: string;
  user: string | null;
  reviewed_by: string | null;
  model: string | null;
  lesion_segments: string[];
};

type Segmentation = BaseEntity & {
  name: string;
  segmentation_id: string | null;
  orthanc_id: string;
  status: string;
  series_instance_uid: string;
  series: string;
  segments: Segment[];
};

type Series = {
  series_instance_uid: string;
  segmentations: Segmentation[];
};

type Study = {
  study_id: string;
  study_date: string;
  is_basal: boolean;
  series: Series[];
};

type SegmentationsResponse = {
  studies: Study[];
};

const getStudySegmentations = async (studyId: string): Promise<SegmentationsResponse> => {
  const response = await fetch(
    `https://segmai.scian.cl/gateway_api/core/pipeline/api/v1/studies/segmentations/?study=${studyId}`
  );
  return response.json();
};

const api = {
  getStudySegmentations,
};

export default api;

export type { SegmentationsResponse, Study, Series, Segmentation, Segment };
