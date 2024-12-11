import { Types } from '@ohif/core';
import DicomTagBrowser from '@ohif/extension-default/src/DicomTagBrowser/DicomTagBrowser';
import { updateSegmentationInfo } from './utils/updateSegmentationInfo';

const commandsModule = ({
  servicesManager,
  commandsManager,
}: Types.Extensions.ExtensionParams): Types.Extensions.CommandsModule => {
  const {
    customizationService,
    measurementService,
    hangingProtocolService,
    uiNotificationService,
    viewportGridService,
    displaySetService,
    segmentationService,
  } = servicesManager.services;

  const actions = {
    // You can add specific actions here if needed
    openDICOMTagViewer({ displaySetInstanceUID }: { displaySetInstanceUID?: string }) {
      const { activeViewportId, viewports } = viewportGridService.getState();
      const activeViewportSpecificData = viewports.get(activeViewportId);
      const { displaySetInstanceUIDs } = activeViewportSpecificData;

      const displaySets = displaySetService.activeDisplaySets;
      const { UIModalService } = servicesManager.services;

      const defaultDisplaySetInstanceUID = displaySetInstanceUID || displaySetInstanceUIDs[0];
      UIModalService.show({
        content: DicomTagBrowser,
        contentProps: {
          displaySets,
          displaySetInstanceUID: defaultDisplaySetInstanceUID,
          onClose: UIModalService.hide,
        },
        containerDimensions: 'w-[70%] max-w-[900px]',
        title: 'DICOM Tag Browser',
      });
    },

    updateSegmentationInfo({ segmentationId }: { segmentationId: string }) {
      return updateSegmentationInfo({
        segmentationId,
        commandsManager,
        segmentationService,
        servicesManager,
      });
    },
  };

  const definitions = {
    // You can add command definitions here if needed
    openDICOMTagViewer: {
      commandFn: actions.openDICOMTagViewer,
    },
    updateSegmentationInfo: {
      commandFn: actions.updateSegmentationInfo,
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'VIEWER',
  };
};

export default commandsModule;
