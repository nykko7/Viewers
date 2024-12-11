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
  // Default viewport is used to define the viewport when
  // additional viewports are added using the layout tool
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
      allowUnmatchedView: true,
      syncGroups: [
        {
          type: 'hydrateseg',
          id: 'sameFORId',
          source: true,
          target: true,
          // options: {
          //   matchingRules: ['sameFOR'],
          // },
        },
      ],
    },
    displaySets: [
      {
        id: 'segDisplaySetId',
        matchedDisplaySetsIndex: -1,
      },
    ],
  },
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
            allowUnmatchedView: true,
            syncGroups: [
              {
                type: 'hydrateseg',
                id: 'sameFORId',
                source: true,
                target: true,
                // options: {
                //   matchingRules: ['sameFOR'],
                // },
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
