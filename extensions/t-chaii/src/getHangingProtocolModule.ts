import { id } from './id';

const defaultProtocol: AppTypes.HangingProtocol.Protocol = {
  id: 'tchaii',
  name: 'T-CHAII',
  locked: true,
  createdDate: '2021-02-23T19:22:08.894Z',
  modifiedDate: '2023-04-01',
  availableTo: {},
  editableBy: {},
  protocolMatchingRules: [],
  toolGroupIds: ['default'],
  numberOfPriorsReferenced: 0,
  displaySetSelectors: {
    segDisplaySetId: {
      seriesMatchingRules: [
        {
          weight: 100,
          attribute: 'Modality',
          constraint: {
            equals: 'SEG',
          },
        },
      ],
    },
    defaultDisplaySetId: {
      seriesMatchingRules: [
        {
          weight: 10,
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: { value: 0 },
          },
        },
        {
          attribute: 'isDisplaySetFromUrl',
          weight: 10,
          constraint: {
            equals: true,
          },
        },
      ],
    },
  },
  stages: [
    {
      name: 'default',
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
            viewportId: 'default',
            toolGroupId: 'default',
            allowUnmatchedView: true,
            syncGroups: [
              {
                type: 'cameraPosition',
                id: 'positionSync',
                source: true,
                target: true,
              },
              {
                type: 'voi',
                id: 'voiSync',
                source: true,
                target: true,
              },
            ],
          },
          displaySets: [
            {
              id: 'segDisplaySetId',
            },
          ],
        },
      ],
      createdDate: '2021-02-23T18:32:42.850Z',
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
