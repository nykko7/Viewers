import { id } from './id';
import getHangingProtocolModule from './getHangingProtocolModule';
import getPanelModule from './getPanelModule';
import commandsModule from './commandsModule';
import { Types } from '@ohif/core';
import getCommandsModule from '@ohif/extension-default/src/commandsModule';

const tchaiExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  preRegistration({ servicesManager, commandsManager, extensionManager, configuration = {} }) {},

  getPanelModule,
  getHangingProtocolModule,
  getCommandsModule,
};

export default tchaiExtension;
