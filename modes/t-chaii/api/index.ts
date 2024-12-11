interface Segment {
  id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  name: string;
  label: string;
  tracking_id: string;
  affected_organs: string;
  volume: number;
  axial_diameter: number | null;
  coronal_diameter: number | null;
  sagittal_diameter: number | null;
  is_target_lession: boolean;
  classification: string | null;
  segmentation_type: string;
  window_width: number | null;
  window_level: number | null;
  status: string;
  lesion_segmentation: string;
  user: string | null;
  reviewed_by: string | null;
  model: string | null;
  lesion_segments: string[];
}

interface SegmentationData {
  id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  name: string;
  segmentation_id: string | null;
  orthanc_id: string;
  status: string;
  series: string;
  segments: Segment[];
  study_date: string;
}

interface SegmentationsResponse {
  study_id_basal: string;
  segmentations_data: SegmentationData[];
}

const exampleResponse: SegmentationsResponse = {
  study_id_basal: '1.3.51.0.1.1.172.19.3.128.2882759.2882698',
  segmentations_data: [
    {
      id: '5a4c6a00-54c4-498f-a3ce-e1ab50e087fe',
      created_at: '2024-12-04T22:08:45.757904Z',
      updated_at: '2024-12-04T22:08:45.757920Z',
      is_deleted: false,
      name: 'test',
      segmentation_id: null,
      orthanc_id: '9eff04cf-7f707cac-15af5361-05aab92c-5f4f6d61',
      status: 'FINISHED',
      series: '07283568-2fef-44ed-ab1e-775b0a9bbe19',
      segments: [
        {
          id: 'e5e80482-17ae-4665-806e-3648329beed8',
          created_at: '2024-12-04T22:08:45.759550Z',
          updated_at: '2024-12-04T22:08:45.759560Z',
          is_deleted: false,
          name: 'Segment #1',
          label: 'Segment #1',
          tracking_id: '1.2.826.0.1.3680043.8.498.11045074678704744806625249133471594766',
          affected_organs: 'test',
          volume: 117175.05025182795,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: '5a4c6a00-54c4-498f-a3ce-e1ab50e087fe',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: [],
        },
      ],
      study_date: '2021-07-29T00:00:00Z',
    },
    {
      id: '3e4c9054-f104-4f76-bd5b-228d61931867',
      created_at: '2024-12-04T22:10:10.702750Z',
      updated_at: '2024-12-04T22:10:10.702764Z',
      is_deleted: false,
      name: 'test',
      segmentation_id: null,
      orthanc_id: '3ed7526e-9ce05117-09eb435b-9048a72f-0dd90b6d',
      status: 'FINISHED',
      series: 'dea0c6d7-25e6-4130-9e8b-3b1e9e369b1c',
      segments: [
        {
          id: 'cb05600b-1e62-40dc-8071-1e10e081e7c3',
          created_at: '2024-12-04T22:10:10.705973Z',
          updated_at: '2024-12-04T22:10:10.705982Z',
          is_deleted: false,
          name: 'Segment #1',
          label: 'Segment #1',
          tracking_id: '1.2.826.0.1.3680043.8.498.13935198505946804703449012140531614211',
          affected_organs: 'test',
          volume: 17771.77720830598,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: '3e4c9054-f104-4f76-bd5b-228d61931867',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: ['e5e80482-17ae-4665-806e-3648329beed8'],
        },
      ],
      study_date: '2021-07-29T00:00:00Z',
    },
  ],
};

const getSegmentations = async (studyId: string): Promise<SegmentationsResponse> => {
  // console.log('studyId:', studyId);
  // const response = await fetch(
  //   'https://segmai.scian.cl/gateway_api/core/pipeline/api/v1/studies/segmentations/',
  //   {
  //     method: 'GET',
  //     body: JSON.stringify({
  //       study_id: studyId,
  //     }),
  //   }
  // );
  // console.log('response:', response);

  // if (!response.ok) {
  //   throw new Error(`Failed to fetch segmentations: ${response.statusText}`);
  // }

  // return response.json();

  return exampleResponse;
};

const api = {
  getSegmentations,
};

export default api;

export type { SegmentationsResponse, SegmentationData, Segment };
