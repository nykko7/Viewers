import React from 'react';
import { id } from './id';
import getHangingProtocolModule from './getHangingProtocolModule';
import getPanelModule from './getPanelModule';
import commandsModule from './commandsModule';
import getCommandsModule from './commandsModule';
import { Types } from '@ohif/core';
// import getCommandsModule from '@ohif/extension-default/src/commandsModule';

const tchaiExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  preRegistration({ servicesManager, commandsManager, extensionManager, configuration = {} }) {},

  getPanelModule,
  getHangingProtocolModule,
  getCommandsModule,
  // getCommandsModule({
  //   servicesManager,
  //   commandsManager,
  //   extensionManager,
  //   hotkeysManager,
  //   configuration,
  //   appConfig,
  //   serviceProvidersManager,
  //   peerImport,
  // }) {
  //   return commandsModule({
  //     servicesManager,
  //     commandsManager,
  //     extensionManager,
  //     hotkeysManager,
  //     serviceProvidersManager,
  //     appConfig,
  //     configuration,
  //     peerImport,
  //   });
  // },
};

export default tchaiExtension;
