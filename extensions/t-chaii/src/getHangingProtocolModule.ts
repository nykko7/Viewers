import { id } from './id';

const defaultProtocol = {
  id: 'tchaii',
  name: 'T-CHAII',
  locked: true,
  hasUpdatedPriorsInformation: false,
  protocolMatchingRules: [
    // {
    //   attribute: 'ModalitiesInStudy',
    //   constraint: {
    //     contains: ['SEG'],
    //   },
    // },
  ],
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
        id: 'segDisplaySet',
        matchedDisplaySetsIndex: -1,
      },
    ],
  },
  toolGroupIds: ['default'],
  displaySetSelectors: {
    ctDisplaySet: {
      seriesMatchingRules: [
        {
          weight: 1,
          attribute: 'Modality',
          constraint: {
            equals: 'CT',
          },
        },
      ],
    },
    segDisplaySet: {
      seriesMatchingRules: [
        {
          weight: 1,
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
      id: 'ctSeg',
      name: 'CT + SEG',
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
            // viewportType: 'stack',
            // toolGroupId: 'default',
            allowUnmatchedView: true,
            // syncGroups: [
            //   {
            //     type: 'image',
            //     id: 'ctSync',
            //     source: true,
            //     target: true,
            //   },
            // ],
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
              id: 'ctDisplaySet',
            },
            {
              id: 'segDisplaySet',
            },
          ],
        },
      ],
    },
  ],

  numberOfPriorsReferenced: 0,
};

function getHangingProtocolModule() {
  return [
    {
      id: `${id}.hangingProtocolModule.default`,
      name: `${id}.hangingProtocolModule.default`,
      protocol: defaultProtocol,
    },
  ];
}

export default getHangingProtocolModule;
