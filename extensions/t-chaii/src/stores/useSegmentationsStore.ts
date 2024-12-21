import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Study, Segment, Segmentation } from 'mode-t-chaii/api';

/**
 * Flag to enable or disable debug mode for the store.
 * Set to `true` to enable zustand devtools.
 */
const DEBUG_STORE = false;

type StudiesInfo = {
  studyMap: Record<string, Study>;
  segmentInfoBySeriesAndLabel: Record<string, Record<string, Segment>>;
  baselineStudy: Study | null;
};

/**
 * Represents the state and actions for managing segmentations data.
 */
type SegmentationsState = {
  /**
   * Stores all studies and their segmentation data
   */
  studiesInfo: StudiesInfo;

  /**
   * Sets the segmentations data from API response
   * @param studies - Array of studies from API response
   */
  setStudies: (studies: Study[]) => void;

  /**
   * Updates segment information with matching segmentation data
   */
  updateSegmentInfo: (studyId: string, seriesId: string, segmentation: Segmentation) => void;

  /**
   * Gets segment info by series and label
   */
  getSegmentInfoBySeriesAndLabel: (seriesId: string, label: string) => Segment | undefined;

  /**
   * Gets a study by ID
   */
  getStudy: (studyId: string) => Study | undefined;

  /**
   * Clears all data from the store
   */
  clearStore: () => void;

  /**
   * Gets all studies
   */
  getStudies: () => Record<string, Study>;

  /**
   * Gets the baseline study
   */
  getBaselineStudy: () => Study | null;
};

/**
 * Creates the Segmentations store.
 */
const createSegmentationsStore = (set, get) => ({
  studiesInfo: {
    studyMap: {},
    segmentInfoBySeriesAndLabel: {},
    baselineStudy: null,
  },

  setStudies: (studies: Study[]) =>
    set(
      state => {
        const studyMap = { ...state.studiesInfo.studyMap };
        const segmentInfoBySeriesAndLabel = { ...state.studiesInfo.segmentInfoBySeriesAndLabel };

        // Process all studies from the API response
        studies.forEach(study => {
          const isBaselineStudy = study.is_basal;

          if (isBaselineStudy) {
            state.studiesInfo.baselineStudy = study;
          }

          // Store study in map
          studyMap[study.study_id] = study;

          // Process all series and their segments
          study.series.forEach(series => {
            const seriesId = series.series_instance_uid;
            segmentInfoBySeriesAndLabel[seriesId] = {};

            series.segmentations.forEach(segmentation => {
              segmentation.segments.forEach(segment => {
                segmentInfoBySeriesAndLabel[seriesId][segment.label] = segment;
              });
            });
          });
        });

        return {
          studiesInfo: {
            studyMap,
            baselineStudy: state.studiesInfo.baselineStudy,
            segmentInfoBySeriesAndLabel,
          },
        };
      },
      false,
      'setStudies'
    ),

  updateSegmentInfo: (studyId: string, seriesId: string, segmentation) => {
    const state = get();
    const seriesSegments = state.studiesInfo.segmentInfoBySeriesAndLabel[seriesId];

    if (!seriesSegments) {
      return;
    }

    // Update segment info based on matching labels
    Object.values(segmentation.segments).forEach(segment => {
      const segmentInfo = seriesSegments[segment.label];
      if (segmentInfo) {
        // Update the cornerstone segment with additional info
        segment.cachedStats = {
          ...segment.cachedStats,
          volume: segmentInfo.volume,
          diameter: segmentInfo.axial_diameter,
          affected_organs: segmentInfo.affected_organs,
        };
      }
    });
  },

  getSegmentInfoBySeriesAndLabel: (seriesId: string, label: string) => {
    const state = get();
    return state.studiesInfo.segmentInfoBySeriesAndLabel[seriesId]?.[label];
  },

  getStudy: (studyId: string) => {
    return get().studiesInfo.studyMap[studyId];
  },

  getBaselineStudy: () => {
    return get().studiesInfo.baselineStudy;
  },

  clearStore: () =>
    set(
      {
        studiesInfo: {
          studyMap: {},
          segmentInfoBySeriesAndLabel: {},
        },
      },
      false,
      'clearStore'
    ),

  getStudies: () => {
    return get().studiesInfo.studyMap;
  },
});

/**
 * Zustand store for managing segmentations data.
 * Applies devtools middleware when DEBUG_STORE is enabled.
 */
export const useSegmentationsStore = create<SegmentationsState>()(
  DEBUG_STORE
    ? devtools(createSegmentationsStore, { name: 'SegmentationsStore' })
    : createSegmentationsStore
);
