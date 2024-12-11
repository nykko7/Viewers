import { id } from './id';

const defaultProtocol = {
  id: 'tchaii',
  name: 'T-CHAII',
  locked: true,
  hasUpdatedPriorsInformation: false,
  protocolMatchingRules: [],
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
            viewportType: 'stack',
            toolGroupId: 'default',
            allowUnmatchedView: true,
            syncGroups: [
              {
                type: 'image',
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
            {
              id: 'segDisplaySet',
              matchedDisplaySetsIndex: -1,
              options: {
                visibility: true,
                renderOutline: true,
              },
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
