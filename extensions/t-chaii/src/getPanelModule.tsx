import React from 'react';
import { SegmentationPanel } from './Panels';
import { Toolbox } from '@ohif/ui';

function getPanelModule({ commandsManager, extensionManager, servicesManager }) {
  const WrappedSegmentationPanel = () => {
    return (
      <div>
        <Toolbox
          commandsManager={commandsManager}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          buttonSectionId="segmentationToolbox"
          title="Segmentation Tools"
        />
        <SegmentationPanel commandsManager={commandsManager} servicesManager={servicesManager} />
      </div>
    );
  };

  return [
    {
      name: 'tchaii-segmentation',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      component: WrappedSegmentationPanel,
    },
  ];
}

export default getPanelModule;
