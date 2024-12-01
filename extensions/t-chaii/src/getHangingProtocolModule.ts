import { id } from './id';

const defaultProtocol = {
  id: 'tchaii',
  name: 'T-CHAII',
  locked: true,
  createdDate: '2024-03-14T16:30:42.239Z',
  modifiedDate: '2024-03-14T16:30:42.239Z',
  availableTo: {},
  editableBy: {},
  toolGroupIds: ['default'],
  numberOfPriorsReferenced: -1,
  imageLoadStrategy: 'interleaveTopToBottom',
  protocolMatchingRules: [
    {
      id: 'CTStudyMatch',
      attribute: 'ModalitiesInStudy',
      constraint: {
        contains: ['CT'],
      },
      required: true,
      weight: 1,
    },
  ],
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
      allowUnmatchedView: true,
      syncGroups: [
        {
          type: 'cameraPosition',
          id: 'ctSync',
          source: true,
          target: true,
        },
      ],
    },
    displaySets: [
      {
        id: 'ctDisplaySet',
        matchedDisplaySetsIndex: -1,
      },
    ],
  },
  displaySetSelectors: {
    ctDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'Modality',
          constraint: {
            equals: 'CT',
          },
          required: true,
          weight: 1,
        },
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: { value: 0 },
          },
          required: true,
          weight: 10,
        },
      ],
    },
    segDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'Modality',
          constraint: {
            equals: 'SEG',
          },
          required: false,
          weight: 1,
        },
      ],
    },
  },
  stages: [
    {
      id: 'ctStage',
      name: 'CT Stage',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 1,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            orientation: 'axial',
            toolGroupId: 'default',
            initialImageOptions: {
              preset: 'middle',
            },
            syncGroups: [
              {
                type: 'cameraPosition',
                id: 'ctSync',
                source: true,
                target: false,
              },
            ],
          },
          displaySets: [
            {
              id: 'ctDisplaySet',
            },
          ],
        },
        // {
        //   viewportOptions: {
        //     viewportType: 'stack',
        //     orientation: 'axial',
        //     toolGroupId: 'default',
        //     initialImageOptions: {
        //       preset: 'middle',
        //     },
        //     syncGroups: [
        //       {
        //         type: 'cameraPosition',
        //         id: 'ctSync',
        //         source: false,
        //         target: true,
        //       },
        //       {
        //         type: 'hydrateseg',
        //         id: 'sameFORId',
        //         source: true,
        //         target: true,
        //         options: {
        //           matchingRules: ['sameFOR'],
        //         },
        //       },
        //     ],
        //   },
        //   displaySets: [
        //     {
        //       id: 'ctDisplaySet',
        //     },
        //     {
        //       id: 'segDisplaySet',
        //     },
        //   ],
        // },
      ],
    },
  ],
};

export default function getHangingProtocolModule() {
  return [
    {
      id: `${id}.hangingProtocolModule.default`,
      name: `${id}.hangingProtocolModule.default`,
      protocol: defaultProtocol,
    },
  ];
}
