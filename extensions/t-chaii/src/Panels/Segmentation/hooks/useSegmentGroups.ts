import { useMemo } from 'react';

type Segment = {
  segmentIndex: number;
  color: [number, number, number];
  visible: boolean;
  lesion_segments?: string[]; // Parent IDs
};

type SegmentFromSegmentation = {
  id: string;
  locked: boolean;
  active: boolean;
  label: string;
  displayText: string;
  cachedStats: any;
  lesion_segments?: string[]; // Parent IDs
  lession_classification: string;
  lession_type: string;
};

export function useSegmentGroups(
  segments: Record<string, Segment>,
  segmentations: Record<string, SegmentFromSegmentation>
) {
  return useMemo(() => {
    // First, build a child -> parent map
    const parentMap = new Map<string, Set<string>>();

    // Build parent-child relationships
    Object.values(segmentations).forEach(segment => {
      if (segment.lesion_segments?.length) {
        segment.lesion_segments.forEach(parentId => {
          if (!parentMap.has(segment.id)) {
            parentMap.set(segment.id, new Set());
          }
          parentMap.get(segment.id)!.add(parentId);
        });
      }
    });

    // Function to get all ancestors of a segment
    const getAncestors = (segmentId: string, visited = new Set<string>()): Set<string> => {
      const ancestors = new Set<string>();
      if (visited.has(segmentId)) {
        return ancestors;
      }

      visited.add(segmentId);
      const parents = parentMap.get(segmentId);
      if (parents) {
        parents.forEach(parentId => {
          ancestors.add(parentId);
          getAncestors(parentId, visited).forEach(id => ancestors.add(id));
        });
      }
      return ancestors;
    };

    // Group segments by classification and track relationships

    console.log('segmentations', segmentations);
    return Object.values(segments).reduce(
      (acc, segment) => {
        if (!segment) {
          return acc;
        }

        const segmentFromSegmentation = segmentations[segment.segmentIndex];
        if (!segmentFromSegmentation) {
          return acc;
        }

        // Default to 'New Lesion' if classification is not set
        const classification =
          segmentFromSegmentation.cachedStats.lession_classification || 'New Lesion';
        const type = segmentFromSegmentation.cachedStats.lession_type || 'Mass';

        if (!acc[classification]) {
          acc[classification] = [];
        }

        if (!acc[type]) {
          acc[type] = [];
        }

        // Get all ancestors for this segment
        const ancestors = getAncestors(segmentFromSegmentation.id);

        acc[classification].push({
          segment,
          segmentFromSegmentation,
          ancestors: Array.from(ancestors),
        });

        acc[type].push({
          segment,
          segmentFromSegmentation,
          ancestors: Array.from(ancestors),
        });

        return acc;
      },
      {} as Record<
        string,
        Array<{
          segment: Segment;
          segmentFromSegmentation: SegmentFromSegmentation;
          ancestors: string[];
        }>
      >
    );
  }, [segments, segmentations]);
}
