import React from 'react';
import { Toolbox } from '@ohif/ui-next';
import { CustomPanelSegmentation } from './Panels/Segmentation/components/CustomPanelSegmentation';

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
        <CustomPanelSegmentation
          servicesManager={servicesManager}
          commandsManager={commandsManager}
        />
      </div>
    );
  };

  return [
    {
      name: 'segmentation',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      component: WrappedSegmentationPanel,
    },
  ];
}

export default getPanelModule;
