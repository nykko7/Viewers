import { Study } from '../../../types';

/**
 * Builds a map of parent-child relationships between segments
 * @param studies Array of studies containing segments
 * @returns Map where keys are parent segment IDs and values are Sets of child segment IDs
 */
export function buildConnectionMap(studies: Study[]): Map<string, Set<string>> {
  const connectionMap = new Map<string, Set<string>>();

  // Helper to add a parent->child connection
  const addConnection = (parentId: string, childId: string) => {
    if (!connectionMap.has(parentId)) {
      connectionMap.set(parentId, new Set());
    }
    connectionMap.get(parentId)!.add(childId);
  };

  // First pass: build direct parent->child connections
  studies.forEach(study => {
    study.series.forEach(series => {
      series.segmentations.forEach(segmentation => {
        segmentation.segments.forEach(segment => {
          // If segment has parents, create parent->child connections
          segment.lesion_segments?.forEach(parentId => {
            addConnection(parentId, segment.id);
          });
        });
      });
    });
  });

  return connectionMap;
}
