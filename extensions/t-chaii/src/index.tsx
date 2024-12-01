import { id } from './id';
import getHangingProtocolModule from './getHangingProtocolModule';
import getPanelModule from './getPanelModule';
import commandsModule from './commandsModule';

const tchaiExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  preRegistration({ servicesManager, commandsManager, extensionManager, configuration = {} }) {},

  getPanelModule,
  getHangingProtocolModule,
  getCommandsModule({ servicesManager, commandsManager, extensionManager }) {
    return commandsModule({
      servicesManager,
      commandsManager,
      extensionManager,
    });
  },
};

export default tchaiExtension;
