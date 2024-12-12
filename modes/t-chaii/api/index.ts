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
      id: 'dc58bced-995f-4ef8-bc13-bfff1c05606f',
      created_at: '2024-12-04T22:37:09.172700Z',
      updated_at: '2024-12-04T22:37:09.172716Z',
      is_deleted: false,
      name: 'test',
      segmentation_id: null,
      orthanc_id: '7c10181e-e506c38b-76f227ef-45328eaf-5e4be833',
      status: 'FINISHED',
      series: '38cc8c1c-aa3f-42f7-94da-3d0fcdba8163',
      segments: [
        {
          id: 'cc679843-ad12-4ccd-9851-426664318e3c',
          created_at: '2024-12-04T22:37:09.174416Z',
          updated_at: '2024-12-04T22:37:09.174425Z',
          is_deleted: false,
          name: 'Segment #1',
          label: 'Segment #1',
          tracking_id: '1.2.826.0.1.3680043.8.498.11105252268930645618441703623246770449',
          affected_organs: 'test',
          volume: 32318.0,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: 'dc58bced-995f-4ef8-bc13-bfff1c05606f',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: [],
        },
        {
          id: '8aa7907d-703e-44cc-9efb-c7cc7703e8b0',
          created_at: '2024-12-04T22:37:09.176353Z',
          updated_at: '2024-12-04T22:37:09.176362Z',
          is_deleted: false,
          name: 'Segment #2',
          label: 'Segment #2',
          tracking_id: '1.2.826.0.1.3680043.8.498.12187923523073502176779813617747360192',
          affected_organs: 'test',
          volume: 300334.0,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: 'dc58bced-995f-4ef8-bc13-bfff1c05606f',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: [],
        },
        {
          id: 'cba59ee0-80d7-453a-a16d-264bac5dc522',
          created_at: '2024-12-04T22:37:09.177894Z',
          updated_at: '2024-12-04T22:37:09.177903Z',
          is_deleted: false,
          name: 'Segment #3',
          label: 'Segment #3',
          tracking_id: '1.2.826.0.1.3680043.8.498.13230215384917429116554563969980160699',
          affected_organs: 'test',
          volume: 215813.0,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: 'dc58bced-995f-4ef8-bc13-bfff1c05606f',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: [],
        },
      ],
      study_date: '2023-10-16T00:00:00Z',
    },
    {
      id: 'cdb7e7ae-222c-443d-a05b-50bf15d9fc48',
      created_at: '2024-12-04T22:39:27.047253Z',
      updated_at: '2024-12-04T22:39:27.047263Z',
      is_deleted: false,
      name: 'test',
      segmentation_id: null,
      orthanc_id: 'ab89b09a-a3b5aa40-4afccdef-2c102335-1fd020df',
      status: 'FINISHED',
      series: 'c20a2508-b3fe-4203-a4be-e5ab433b1f20',
      segments: [
        {
          id: '789453f3-e433-4ee8-a619-7a3f68af20e3',
          created_at: '2024-12-04T22:39:27.049034Z',
          updated_at: '2024-12-04T22:39:27.049041Z',
          is_deleted: false,
          name: 'Segment #1',
          label: 'Segment #1',
          tracking_id: '1.2.826.0.1.3680043.8.498.12589743509522659746329052362277933345',
          affected_organs: 'test',
          volume: 212572.0,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: 'cdb7e7ae-222c-443d-a05b-50bf15d9fc48',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: [],
        },
        {
          id: '11d44d33-ed98-4df7-8416-eedac863f1f2',
          created_at: '2024-12-04T22:39:27.051787Z',
          updated_at: '2024-12-04T22:39:27.051794Z',
          is_deleted: false,
          name: 'Segment #2',
          label: 'Segment #2',
          tracking_id: '1.2.826.0.1.3680043.8.498.14480479045670969767017487887829543474',
          affected_organs: 'test',
          volume: 319857.0,
          axial_diameter: null,
          coronal_diameter: null,
          sagittal_diameter: null,
          is_target_lession: true,
          classification: null,
          segmentation_type: "('automatic', 'Automatic')",
          window_width: null,
          window_level: null,
          status: 'FINISHED',
          lesion_segmentation: 'cdb7e7ae-222c-443d-a05b-50bf15d9fc48',
          user: null,
          reviewed_by: null,
          model: null,
          lesion_segments: ['cc679843-ad12-4ccd-9851-426664318e3c'],
        },
      ],
      study_date: '2023-10-16T00:00:00Z',
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
