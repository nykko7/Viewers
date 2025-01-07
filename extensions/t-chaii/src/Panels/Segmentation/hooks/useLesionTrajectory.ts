import { useMemo } from 'react';
import { Study, Segment } from '../../../types';

type SegmentWithStudy = {
  segment: Segment;
  study: Study;
  isSplit?: boolean;
  isMerge?: boolean;
  isSelected?: boolean;
};

type StudyGroup = {
  study: Study;
  segments: SegmentWithStudy[];
  totalVolume: number;
  hasSplit: boolean;
  hasMerge: boolean;
};

export function useLesionTrajectory(
  studies: Study[],
  selectedSegmentId: string | undefined,
  connectionMap: Map<string, Set<string>>
) {
  return useMemo(() => {
    if (!selectedSegmentId) {
      return [];
    }

    const sortedStudies = [...studies].sort(
      (a, b) => new Date(a.study_date).getTime() - new Date(b.study_date).getTime()
    );

    // Find baseline by traversing up to root
    const findBaseline = (segmentId: string, visited = new Set<string>()): string => {
      if (visited.has(segmentId)) {
        return segmentId;
      }
      visited.add(segmentId);

      let isRoot = true;
      let rootId = segmentId;

      connectionMap.forEach((children, parentId) => {
        if (children.has(segmentId) && !visited.has(parentId)) {
          isRoot = false;
          rootId = findBaseline(parentId, visited);
        }
      });

      return isRoot ? segmentId : rootId;
    };

    // Get all descendants from a segment
    const getDescendants = (
      segmentId: string,
      visited = new Set<string>()
    ): Map<string, Set<string>> => {
      const descendants = new Map<string, Set<string>>();
      if (visited.has(segmentId)) {
        return descendants;
      }
      visited.add(segmentId);

      const children = connectionMap.get(segmentId);
      if (children) {
        children.forEach(childId => {
          if (!descendants.has(segmentId)) {
            descendants.set(segmentId, new Set());
          }
          descendants.get(segmentId)!.add(childId);

          // Recursively get descendants of children
          const childDescendants = getDescendants(childId, visited);
          childDescendants.forEach((grandchildren, parentId) => {
            if (!descendants.has(parentId)) {
              descendants.set(parentId, new Set());
            }
            grandchildren.forEach(grandchildId => {
              descendants.get(parentId)!.add(grandchildId);
            });
          });
        });
      }

      return descendants;
    };

    // Find baseline segment
    const baselineId = findBaseline(selectedSegmentId);

    // Get all descendants from baseline
    const descendantsMap = getDescendants(baselineId);

    // Build the full trajectory
    const trajectory: StudyGroup[] = [];
    const processedSegments = new Set<string>();

    sortedStudies.forEach(study => {
      const studySegments: SegmentWithStudy[] = [];
      let totalVolume = 0;
      let hasSplit = false;
      let hasMerge = false;

      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          segmentation.segments.forEach(segment => {
            // Check if this segment is part of our trajectory
            const isInTrajectory =
              segment.id === baselineId ||
              Array.from(descendantsMap.values()).some(children => children.has(segment.id));

            if (isInTrajectory && !processedSegments.has(segment.id)) {
              processedSegments.add(segment.id);

              // Determine if this segment is part of a split or merge
              const parentCount = Array.from(descendantsMap.entries()).filter(([_, children]) =>
                children.has(segment.id)
              ).length;
              const childCount = descendantsMap.get(segment.id)?.size || 0;

              studySegments.push({
                segment,
                study,
                isSplit: childCount > 1,
                isMerge: parentCount > 1,
                isSelected: segment.id === selectedSegmentId,
              });

              totalVolume += segment.volume || 0;
              hasSplit = hasSplit || childCount > 1;
              hasMerge = hasMerge || parentCount > 1;
            }
          });
        });
      });

      if (studySegments.length > 0) {
        trajectory.push({
          study,
          segments: studySegments,
          totalVolume,
          hasSplit,
          hasMerge,
        });
      }
    });

    return trajectory;
  }, [studies, selectedSegmentId, connectionMap]);
}
