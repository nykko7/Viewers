import { hotkeys } from '@ohif/core';
import toolbarButtons from './toolbarButtons';
import segmentationButtons from './segmentationButtons';
import initToolGroups from './initToolGroups';
import { id } from './id';
import api from '../api';
import { useSegmentationsStore } from 'extension-t-chaii/src/stores/useSegmentationsStore';

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
    routeName: 'ai-segmentations',
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

      // Get StudyInstanceUID from the URL
      const searchParams = new URLSearchParams(window.location.search);
      const studyInstanceUIDs = searchParams.get('StudyInstanceUIDs');

      if (studyInstanceUIDs) {
        try {
          // Fetch segmentations for the study
          const { studies } = await api.getStudySegmentations(studyInstanceUIDs);
          useSegmentationsStore.getState().setStudies(studies);
        } catch (error) {
          console.warn('Error fetching segmentations:', error);
        }
      }

      const baselineStudy = useSegmentationsStore.getState().getBaselineStudy();

      customizationService.addModeCustomizations([
        {
          id: 'PanelStudyBrowser.baselineStudy',
          value: baselineStudy,
        },
      ]);

      // Handle viewport changes
      const onViewportChanged = async ({ viewportData, viewportId }) => {
        if (!viewportData?.data?.length) {
          return;
        }

        console.log('Viewport data:', viewportData);

        console.log(
          'displaySets:',
          displaySetService.getDisplaySetByUID(viewportData.data[0].displaySetInstanceUID)
        );

        const displaySets = viewportData.data.map(data =>
          displaySetService.getDisplaySetByUID(data.displaySetInstanceUID)
        );

        const segDisplaySet = displaySets.find(displaySet => displaySet?.Modality === 'SEG');

        if (!segDisplaySet) {
          return;
        }

        const activeSegmentation = segmentationService.getActiveSegmentation(viewportId);
        if (!activeSegmentation) {
          return;
        }

        const segmentation = segmentationService.getSegmentation(activeSegmentation.segmentationId);
        if (!segmentation) {
          return;
        }

        segmentation.cachedStats = {
          ...segmentation.cachedStats,
          studies: useSegmentationsStore.getState().getStudies(),
        };

        // Update segments with info from store
        const updatedSegments = { ...segmentation.segments };

        for (const [segmentIndex, segment] of Object.entries(segmentation.segments)) {
          const segmentInfo = useSegmentationsStore
            .getState()
            .getSegmentInfoBySeriesAndLabel(
              segDisplaySet.referencedSeriesInstanceUID,
              segment.label
            );
          console.log(segmentInfo);

          if (segmentInfo) {
            updatedSegments[segmentIndex] = {
              ...segment,
              cachedStats: {
                ...segment.cachedStats,
                id: segmentInfo.id,
                volume: segmentInfo.volume,
                diameter: segmentInfo.axial_diameter,
                affected_organs: segmentInfo.affected_organs,
              },
            };
          }
        }

        // Update the segmentation with new segment data
        const updatedSegmentation = {
          ...segmentation,
          segments: updatedSegments,
        };

        segmentationService.addOrUpdateSegmentation(updatedSegmentation);
      };

      // Subscribe to viewport changes
      const displaySetsAddedUnsubscribe = cornerstoneViewportService.subscribe(
        cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        onViewportChanged
      );

      // Add to unsubscriptions for cleanup
      unsubscriptions.push(displaySetsAddedUnsubscribe.unsubscribe);

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

      // Clear the segmentations store
      useSegmentationsStore.getState().clearStore();
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
