import React, { useEffect, useMemo } from 'react';
import { Button, SegmentationTable } from '@ohif/ui-next';
import { useActiveViewportSegmentationRepresentations } from '@ohif/extension-cornerstone';
import { getRenderingEngine, getEnabledElement } from '@cornerstonejs/core';
import { CustomSegmentationSegments } from './CustomSegmentationSegments';
import { useSegmentHandlers } from '../hooks/useSegmentHandlers';
import { useSegmentationDataSync } from '../hooks/useSegmentationDataSync';
import { metaData } from '@cornerstonejs/core';
import { Types } from '@ohif/core';
import { formatValue } from '../../../utils/formatValue';

type CustomPanelSegmentationProps = {
  servicesManager: Types.Extensions.ExtensionParams['servicesManager'];
  commandsManager: Types.Extensions.ExtensionParams['commandsManager'];
  children?: React.ReactNode;
};

export function CustomPanelSegmentation({
  servicesManager,
  commandsManager,
  children,
}: CustomPanelSegmentationProps) {
  const { viewportGridService, customizationService, displaySetService } = servicesManager.services;

  const { segmentationsWithRepresentations, disabled } =
    useActiveViewportSegmentationRepresentations({
      servicesManager,
      subscribeToDataModified: true,
      debounceTime: 50, // Reduced from 300ms to 50ms for more responsive updates
    });

  const handlers = useSegmentHandlers({ servicesManager, commandsManager });

  // Get the active segmentation ID
  const activeSegmentationId =
    segmentationsWithRepresentations[0]?.segmentation?.segmentationId ||
    segmentationsWithRepresentations[0]?.segmentation?.id;

  console.log('[CustomPanelSegmentation] Active segmentation ID:', activeSegmentationId);
  console.log('[CustomPanelSegmentation] Segmentations:', segmentationsWithRepresentations);

  // Sync segmentation data modifications with the store
  useSegmentationDataSync({
    servicesManager,
    subscribeToDataModified: true,
    obbDebounceMs: 300,
  });

  const { mode: SegmentationTableMode } = customizationService.getCustomization(
    'PanelSegmentation.tableMode',
    {
      id: 'default.segmentationTable.mode',
      mode: 'collapsed',
    }
  );

  // custom onSegmentationAdd if provided
  const { onSegmentationAdd } = customizationService.getCustomization(
    'PanelSegmentation.onSegmentationAdd',
    {
      id: 'segmentation.onSegmentationAdd',
      onSegmentationAdd: handlers.onSegmentationAdd,
    }
  );

  const { disableEditing } = customizationService.getCustomization(
    'PanelSegmentation.disableEditing',
    {
      id: 'default.disableEditing',
      disableEditing: false,
    }
  );

  const { showAddSegment } = customizationService.getCustomization(
    'PanelSegmentation.showAddSegment',
    {
      id: 'default.showAddSegment',
      showAddSegment: true,
    }
  );

  const exportOptions = segmentationsWithRepresentations.map(({ segmentation }) => {
    const { representationData, segmentationId } = segmentation;
    const { Labelmap } = representationData;

    if (!Labelmap) {
      return {
        segmentationId,
        isExportable: true,
      };
    }

    const referencedImageIds = Labelmap.referencedImageIds;
    const firstImageId = referencedImageIds[0];

    const instance = metaData.get('instance', firstImageId);
    const { SOPInstanceUID, SeriesInstanceUID } = instance;

    const displaySet = displaySetService.getDisplaySetForSOPInstanceUID(
      SOPInstanceUID,
      SeriesInstanceUID
    );

    return {
      segmentationId,
      isExportable: displaySet?.isReconstructable ?? false,
    };
  });

  // Calculate total volume and diameter
  const { totalVolume, maxDiameter } = useMemo(() => {
    let volume = 0;
    let maxDiam = 0;

    segmentationsWithRepresentations.forEach(({ segmentation }) => {
      Object.values(segmentation.segments).forEach(segment => {
        if (segment && typeof segment.cachedStats?.volume === 'number') {
          volume += segment.cachedStats.volume;
        }
        // Check for axial_diameter first, then fall back to diameter for backwards compatibility
        const diameter = segment.cachedStats?.axial_diameter ?? segment.cachedStats?.diameter;
        if (segment && typeof diameter === 'number') {
          maxDiam = Math.max(maxDiam, diameter);
        }
      });
    });

    return {
      totalVolume: volume,
      maxDiameter: maxDiam,
    };
  }, [segmentationsWithRepresentations]);

  const handleSaveChanges = () => {
    console.log('save changes');
  };

  return (
    <SegmentationTable
      disabled={disabled}
      data={segmentationsWithRepresentations}
      mode={SegmentationTableMode}
      title="Segmentations"
      exportOptions={exportOptions}
      disableEditing={disableEditing}
      onSegmentationAdd={onSegmentationAdd}
      onSegmentationClick={handlers.onSegmentationClick}
      onSegmentationDelete={handlers.onSegmentationDelete}
      showAddSegment={showAddSegment}
      onSegmentAdd={handlers.onSegmentAdd}
      onSegmentClick={handlers.onSegmentClick}
      onSegmentEdit={handlers.onSegmentEdit}
      onSegmentationEdit={handlers.onSegmentationEdit}
      onSegmentColorClick={handlers.onSegmentColorClick}
      onSegmentDelete={handlers.onSegmentDelete}
      onToggleSegmentVisibility={handlers.onToggleSegmentVisibility}
      onToggleSegmentLock={handlers.onToggleSegmentLock}
      onToggleSegmentationRepresentationVisibility={
        handlers.onToggleSegmentationRepresentationVisibility
      }
      onSegmentationDownload={handlers.onSegmentationDownload}
      storeSegmentation={handlers.storeSegmentation}
      onSegmentationDownloadRTSS={handlers.onSegmentationDownloadRTSS}
      setStyle={handlers.setStyle}
      toggleRenderInactiveSegmentations={handlers.toggleRenderInactiveSegmentations}
      onSegmentationRemoveFromViewport={handlers.onSegmentationRemoveFromViewport}
      setFillAlpha={handlers.setFillAlpha}
      setOutlineWidth={handlers.setOutlineWidth}
      setRenderFill={handlers.setRenderFill}
      setRenderOutline={handlers.setRenderOutline}
      setFillAlphaInactive={handlers.setFillAlphaInactive}
      renderInactiveSegmentations={handlers.getRenderInactiveSegmentations()}
    >
      {children}
      <SegmentationTable.Config />
      {/* <SegmentationTable.AddSegmentationRow /> */}

      {SegmentationTableMode === 'collapsed' ? (
        <SegmentationTable.Collapsed>
          <SegmentationTable.SelectorHeader />
          <SegmentationTable.AddSegmentRow />
          {/* <SegmentationTable.Segments /> */}
          <CustomSegmentationSegments servicesManager={servicesManager} />
        </SegmentationTable.Collapsed>
      ) : (
        <SegmentationTable.Expanded>
          <SegmentationTable.Header />
          <SegmentationTable.AddSegmentRow />
          {/* <SegmentationTable.Segments /> */}
          <CustomSegmentationSegments servicesManager={servicesManager} />
        </SegmentationTable.Expanded>
      )}
      {segmentationsWithRepresentations.length > 0 && (
        <div className="flex flex-col gap-2 p-2">
          <div className="bg-secondary-dark text-secondary-foreground grid grid-cols-2 gap-2 p-2">
            <span>Total volume:</span>
            <span className="text-right font-bold">
              {formatValue(totalVolume)} mm<sup>3</sup>
            </span>
            <span>Total diameter:</span>
            <span className="text-right font-bold">{formatValue(maxDiameter)} mm</span>
          </div>

          <Button
            onClick={handleSaveChanges}
            className="w-full"
            variant="default"
            size="lg"
            disabled
          >
            Save Changes
          </Button>
        </div>
      )}
    </SegmentationTable>
  );
}
