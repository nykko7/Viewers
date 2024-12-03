import React from 'react';
import {
  PanelSegmentation,
  useActiveViewportSegmentationRepresentations,
} from '@ohif/extension-cornerstone';
import { Button, Icons } from '@ohif/ui-next';

function CustomSegmentationHeader({ segmentation }) {
  const totalVolume = Object.values(segmentation.segments || {}).reduce(
    (sum, segment: any) => sum + (segment.cachedStats?.volume || 0),
    0
  );
  const maxDiameter = Math.max(
    ...Object.values(segmentation.segments || {}).map(
      (segment: any) => segment.cachedStats?.diameter || 0
    )
  );

  return (
    <div className="flex flex-col p-2 text-white">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-bold">Segmentación</span>
        <span className="text-sm text-gray-500">
          Total Vol: {typeof totalVolume === 'number' ? totalVolume.toFixed(2) : '0.00'}mm³
        </span>
        <span className="text-sm text-gray-500">
          Max Diam: {typeof maxDiameter === 'number' ? maxDiameter.toFixed(2) : '0.00'}mm
        </span>
      </div>
    </div>
  );
}

function CustomSegmentRow({ segment, segmentIndex }) {
  const lesionTypes = [
    { value: 'target', label: 'Target', color: 'red' },
    { value: 'nonTarget', label: 'Non-Target', color: 'blue' },
    { value: 'new', label: 'New', color: 'purple' },
  ];

  const type = segment.metadata?.lesionType || 'target';
  const typeColor = lesionTypes.find(t => t.value === type)?.color || 'gray';

  return (
    <div className="flex flex-col border-b border-gray-800 p-2 text-white">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <div className={`h-3 w-3 rounded-full bg-${typeColor}-500 mr-2`} />
          <span className="font-medium">{segment.label || `Segment ${segmentIndex + 1}`}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="text-gray-400">Volume:</label>
          <div className="text-right">{segment.cachedStats?.volume?.toFixed(2) || 0} mm³</div>
        </div>
        <div>
          <label className="text-gray-400">Diameter:</label>
          <div className="text-right">{segment.cachedStats?.diameter?.toFixed(2) || 0} mm</div>
        </div>
      </div>
    </div>
  );
}

function SegmentationList({ servicesManager, commandsManager }) {
  const { segmentationsWithRepresentations: representations } =
    useActiveViewportSegmentationRepresentations({ servicesManager });

  const segmentations = representations.map(representation => representation.segmentation);

  if (!segmentations.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-gray-500">No segmentations available</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {segmentations.map(segmentation => (
        <div key={segmentation.label} className="mb-4">
          <CustomSegmentationHeader segmentation={segmentation} />
          <div className="divide-y divide-gray-800">
            {Object.entries(segmentation.segments || {}).map(([key, segment]) => (
              <CustomSegmentRow key={key} segment={segment} segmentIndex={parseInt(key)} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 px-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            // TODO: Implement save functionality
            console.log('Saving segmentation changes...');
          }}
        >
          Subir cambios
        </Button>
      </div>
    </div>
  );
}

export default function SegmentationPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  configuration,
}: withAppTypes) {
  return (
    <>
      <PanelSegmentation
        servicesManager={servicesManager}
        commandsManager={commandsManager}
        extensionManager={extensionManager}
        configuration={configuration}
      >
        <SegmentationList servicesManager={servicesManager} commandsManager={commandsManager} />
      </PanelSegmentation>
    </>
  );
}
