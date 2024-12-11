import { hotkeys } from '@ohif/core';
// import { triggerEvent } from '@cornerstonejs/core';
import { Segment, Segmentation } from '@cornerstonejs/tools/types';
import { getRenderingEngine } from '@cornerstonejs/core';
import toolbarButtons from './toolbarButtons';
import segmentationButtons from './segmentationButtons';
import initToolGroups from './initToolGroups';
import { id } from './id';
import api from '../api';
import { SegmentationRepresentations } from '@cornerstonejs/tools/enums';

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  thumbnailList: '@ohif/extension-default.panelModule.seriesList',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
  panelTool: '@ohif/extension-cornerstone.panelModule.panelSegmentationWithTools',
};

const segmentation = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
};

const tchaii = {
  hangingProtocol: 'extension-t-chaii.hangingProtocolModule.default',
  segmentation: 'extension-t-chaii.panelModule.segmentation',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  'extension-t-chaii': '^0.0.1',
};

const unsubscriptions: Array<() => void> = [];

function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 't-chaii',
    displayName: 'T-CHAII Mode',

    onModeEnter: async ({ servicesManager, extensionManager, commandsManager }: withAppTypes) => {
      const {
        measurementService,
        toolbarService,
        toolGroupService,
        displaySetService,
        segmentationService,
        cornerstoneViewportService,
        customizationService,
        viewportGridService,
        hangingProtocolService,
      } = servicesManager.services;

      // Clear previous state
      measurementService.clearMeasurements();

      // Init Default and SR ToolGroups
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      // Reset the tool state
      toolbarService.addButtons(toolbarButtons);
      toolbarService.addButtons(segmentationButtons);

      // Add toolbar buttons
      toolbarService.createButtonSection('primary', [
        'WindowLevel',
        'Pan',
        'Zoom',
        'TrackballRotate',
        'Capture',
        'Layout',
        'Crosshairs',
        'MoreTools',
      ]);

      toolbarService.createButtonSection('segmentationToolbox', ['BrushTools', 'Shapes']);

      // Handle viewport changes
      const handleViewportChange = async ({ viewportData, viewportId }) => {
        if (!viewportData || !viewportId) return;

        try {
          const displaySet = displaySetService.getDisplaySetByUID(
            viewportData.data[0].displaySetInstanceUID
          );

          if (!displaySet) return;

          // If it's a SEG displaySet, ensure we have the referenced CT loaded first
          if (displaySet.Modality === 'SEG') {
            const referencedDisplaySet = displaySetService.getDisplaySetByUID(
              displaySet.referencedDisplaySetInstanceUID
            );

            // If we don't have the referenced CT, load it first
            if (!referencedDisplaySet) {
              // Find the CT display set in the same study
              const ctDisplaySets = displaySetService
                .getDisplaySets()
                .filter(
                  ds => ds.Modality === 'CT' && ds.StudyInstanceUID === displaySet.StudyInstanceUID
                );

              if (ctDisplaySets.length > 0) {
                // Load the CT first
                await viewportGridService.setDisplaySetsForViewport({
                  viewportId,
                  displaySetInstanceUIDs: [
                    ctDisplaySets[0].displaySetInstanceUID,
                    displaySet.displaySetInstanceUID,
                  ],
                });
                return; // The viewport change event will fire again with both display sets
              }
            }

            // Ensure viewport is ready
            const renderingEngine = getRenderingEngine('cornerstone');
            if (!renderingEngine || !renderingEngine.getViewport(viewportId)) {
              await commandsManager.run('initializeViewport', { viewportId });
            }

            // Load segmentation data
            const { segmentations_data } = await api.getSegmentations(displaySet.StudyInstanceUID);

            // Convert API segments to cornerstone format
            for (const segData of segmentations_data) {
              const segmentation = segmentationService.getSegmentation(segData.id);
              if (segmentation) {
                // Convert array of segments to object format
                const segmentsObject = segData.segments.reduce((acc, segment, index) => {
                  acc[index] = {
                    segmentIndex: index,
                    label: segment.label || `Segment ${index + 1}`,
                    locked: false,
                    active: false,
                    cachedStats: {
                      volume: segment.volume,
                      axialDiameter: segment.axial_diameter,
                      affected_organs: segment.affected_organs,
                      classification: segment.classification,
                    },
                  };
                  return acc;
                }, {});

                segmentationService.addOrUpdateSegmentation({
                  ...segmentation,
                  id: segData.id,
                  label: segData.name,
                  segments: segmentsObject,
                });
              }
            }
          }
        } catch (error) {
          console.warn('Error handling viewport change:', error);
        }
      };

      // Subscribe to viewport changes
      const unsubscribeViewportChange = cornerstoneViewportService.subscribe(
        cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        handleViewportChange
      );

      unsubscriptions.push(unsubscribeViewportChange.unsubscribe);

      // Add customizations
      customizationService.addModeCustomizations([
        {
          id: 'PanelSegmentation.tableMode',
          mode: 'expanded',
        },
      ]);
    },

    onModeExit: ({ servicesManager }: withAppTypes) => {
      const {
        toolGroupService,
        syncGroupService,
        segmentationService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      unsubscriptions.forEach(unsubscribe => unsubscribe());
      uiDialogService.dismissAll();
      uiModalService.hide();
      toolGroupService.destroy();
      syncGroupService.destroy();
      segmentationService.destroy();
      cornerstoneViewportService.destroy();
    },

    validationTags: {
      study: [],
      series: [],
    },

    isValidMode: ({ modalities }) => {
      const modalities_list = modalities.split('\\');
      return {
        valid: modalities_list.includes('CT'),
        description: 'T-CHAII mode only supports the CT modality',
      };
    },

    routes: [
      {
        path: 'template',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ohif.thumbnailList],
              rightPanels: [tchaii.segmentation],
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: segmentation.viewport,
                  displaySetsToDisplay: [segmentation.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],
    defaultContext: ['VIEWER'],
    hangingProtocol: tchaii.hangingProtocol,
    sopClassHandlers: [ohif.sopClassHandler, segmentation.sopClassHandler],
    extensions: extensionDependencies,
    hotkeys: [...hotkeys.defaults.hotkeyBindings],
    ...modeConfiguration,
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
