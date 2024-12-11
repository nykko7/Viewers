import { hotkeys } from '@ohif/core';
// import { triggerEvent } from '@cornerstonejs/core';
import { Segment, Segmentation } from '@cornerstonejs/tools/types';
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
      } = servicesManager.services;

      measurementService.clearMeasurements();

      // // Init Default and SR ToolGroups
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

      // Handle display sets added
      const onViewportChanged = async ({ viewportData, viewportId }) => {
        console.log('onDisplaySetsAdded', viewportData);

        const displaySet = displaySetService.getDisplaySetByUID(
          viewportData.data[0].displaySetInstanceUID
        );

        if (!displaySet) return;

        if (displaySet.Modality !== 'SEG') return;

        console.log('viewportId', viewportId);
        console.log('displaySet', displaySet);
        console.log(
          'displaySet.referencedDisplaySetInstanceUID',
          displaySet.referencedDisplaySetInstanceUID
        );

        const { segmentations_data } = await api.getSegmentations(displaySet.StudyInstanceUID);
        console.log('segmentations_data', segmentations_data);

        const segmentationsList = segmentationService.getSegmentations();
        console.log('segmentationsList', segmentationsList);

        const activeSegmentation = segmentationService.getActiveSegmentation(viewportId);
        console.log('activeSegmentation', activeSegmentation);

        const labelmaps = segmentationService.getSegmentationRepresentations(viewportId, {
          type: SegmentationRepresentations.Labelmap,
        });

        console.log('labelmaps', labelmaps);

        // const segmentationId = segmentations_data.find(segmetation => segmentation.segmentation_id === activeSegmentation.segmentationId)
        const segmentationId = '3e3c9031-0eaf-602a-5459-1f3e541a3a1a';

        const segmentation = segmentationService.getSegmentation(segmentationId);
        if (!segmentation) return;

        for (const [segmentIndex, segment] of Object.entries(segmentation.segments)) {
          const additionalStats = {
            diameter: 50, // mm
            volume: 50, // mL
            affectedOrgan: 'Unknown',
          };

          // Update the segment's cached stats
          const updatedSegment: Segment = {
            ...segment,
            cachedStats: {
              ...segment.cachedStats,
              ...additionalStats,
            },
          };

          segmentation.segments[segmentIndex] = updatedSegment;
        }

        // Update the segmentation object
        const updatedSegmentation: Segmentation = {
          ...segmentation,
          segments: {
            ...segmentation.segments,
          },
        };

        // Update the segmentation in the service
        segmentationService.addOrUpdateSegmentation(updatedSegmentation);
      };

      // Subscribe to display sets added event

      const displaySetsAddedUnsubscribe = cornerstoneViewportService.subscribe(
        cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        onViewportChanged
      );

      // Add to unsubscriptions for cleanup
      unsubscriptions.push(displaySetsAddedUnsubscribe.unsubscribe);

      // const displaySetsAddedUnsubscribe = displaySetService.subscribe(
      //   displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      //   onDisplaySetsAdded
      // );

      // Add to unsubscriptions for cleanup
      // unsubscriptions.push(displaySetsAddedUnsubscribe.unsubscribe);

      customizationService.addModeCustomizations([
        {
          id: 'PanelSegmentation.tableMode',
          mode: 'expanded',
        },
        // {
        //   id: 'PanelSegmentation.onSegmentationAdd',
        //   onSegmentationAdd: () => {
        //     commandsManager.run('createNewLabelmapFromPT');
        //   },
        // },
        // {
        //   id: 'PanelSegmentation.readableText',
        //   // remove following if you are not interested in that stats
        //   // readableText: {
        //   //   diameter: 'Diameter',
        //   //   volume: 'Volume',
        //   //   affectedOrgan: 'Affected Organ',
        //   // },
        // },
      ]);

      // const viewportId = cornerstone.viewport;
      // const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(viewportId);
      // const displaySets = displaySetUIDs.map(uid => displaySetService.getDisplaySetByUID(uid));

      // viewportGridService.setDisplaySetsForViewport({
      //   viewportId,
      //   displaySetInstanceUIDs: displaySets.map(ds => ds.displaySetInstanceUID),
      // });

      // const displaySet = displaySetService.getDisplaySetByUID(
      //   viewportGridService.getActiveViewportId()
      // );
      // const currentStudy = displaySet.referencedStudyInstanceUID;

      // const segmentationsAdditionalData = await api.getSegmentations(currentStudy);

      // console.log('segmentationsAdditionalData', segmentationsAdditionalData);
      // segmentationService.addSegmentations(segmentationsAdditionalData.segmentations);
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
