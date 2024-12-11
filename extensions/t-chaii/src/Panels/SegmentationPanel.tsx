import React, { useEffect } from 'react';
import { PanelSegmentation } from '@ohif/extension-cornerstone';

export default function SegmentationPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  configuration,
}: withAppTypes) {
  const { segmentationService } = servicesManager.services;

  useEffect(() => {
    // Subscribe to segmentation changes
    const subscription = segmentationService.subscribe(
      segmentationService.EVENTS.SEGMENTATION_ADDED,
      ({ segmentationId }) => {
        // Update the segmentation info when a new segmentation is added
        commandsManager.run('updateSegmentationInfo', { segmentationId });
      }
    );

    // Subscribe to segmentation data modifications
    const dataModifiedSubscription = segmentationService.subscribe(
      segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED,
      ({ segmentationId }) => {
        // Update the segmentation info when data is modified
        commandsManager.run('updateSegmentationInfo', { segmentationId });
      }
    );

    // Initial update for existing segmentations
    const segmentations = segmentationService.getSegmentations();
    segmentations.length &&
      segmentations.forEach(segmentation => {
        commandsManager.run('updateSegmentationInfo', {
          segmentationId: segmentation.segmentationId,
        });
      });

    return () => {
      // Cleanup subscriptions
      subscription.unsubscribe();
      dataModifiedSubscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <PanelSegmentation
        servicesManager={servicesManager}
        commandsManager={commandsManager}
        extensionManager={extensionManager}
        configuration={configuration}
      />
    </>
  );
}
