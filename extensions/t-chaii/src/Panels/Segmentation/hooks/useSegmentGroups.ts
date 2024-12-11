import { useMemo } from 'react';

type Segment = {
  segmentIndex: number;
  color: [number, number, number];
  visible: boolean;
  classification?: string;
};

type SegmentFromSegmentation = {
  locked: boolean;
  active: boolean;
  label: string;
  displayText: string;
  cachedStats: any;
  classification?: string;
};

export function useSegmentGroups(
  segments: Record<string, Segment>,
  segmentations: Record<string, SegmentFromSegmentation>
) {
  return useMemo(() => {
    return Object.values(segments).reduce(
      (acc, segment) => {
        if (!segment) return acc;

        const segmentFromSegmentation = segmentations[segment.segmentIndex];
        if (!segmentFromSegmentation) return acc;

        // Default to 'Non-Target' if classification is not set
        const classification = segmentFromSegmentation.classification || 'Target';

        if (!acc[classification]) {
          acc[classification] = [];
        }

        acc[classification].push({ segment, segmentFromSegmentation });
        return acc;
      },
      {} as Record<
        string,
        Array<{ segment: Segment; segmentFromSegmentation: SegmentFromSegmentation }>
      >
    );
  }, [segments, segmentations]);
}
