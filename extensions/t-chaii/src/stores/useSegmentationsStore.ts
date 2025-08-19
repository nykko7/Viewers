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

  /**
   * Updates a segment's data
   */
  updateSegment: (updatedSegment: Segment) => void;
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
          // API provides volume in mm³, convert to mL (divide by 1000)
          volume: segmentInfo.volume / 1000,
          diameter: segmentInfo.major_axis_mm || segmentInfo.axial_diameter, // Use major_axis_mm as primary diameter
          majorAxisMm: segmentInfo.major_axis_mm,
          minorAxisMm: segmentInfo.minor_axis_mm,
          axial_diameter: segmentInfo.axial_diameter,
          coronal_diameter: segmentInfo.coronal_diameter,
          sagittal_diameter: segmentInfo.sagittal_diameter,
          affected_organs: segmentInfo.affected_organs,
          lession_classification: segmentInfo.lession_classification,
          lession_type: segmentInfo.lession_type,
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

  updateSegment: (updatedSegment: Segment) => {
    set(
      state => {
        const studyMap = { ...state.studiesInfo.studyMap };
        const segmentInfoBySeriesAndLabel = { ...state.studiesInfo.segmentInfoBySeriesAndLabel };

        // Find and update the segment in the study map
        for (const study of Object.values(studyMap)) {
          const typedStudy = study as Study;
          if (!typedStudy.series) {
            continue;
          }

          for (const series of typedStudy.series) {
            if (!series.segmentations) {
              continue;
            }

            for (const segmentation of series.segmentations) {
              if (!segmentation.segments) {
                continue;
              }

              const segments = segmentation.segments as Segment[];
              const segmentIndex = segments.findIndex(s => s.id === updatedSegment.id);

              if (segmentIndex !== -1) {
                // Update the segment in the segmentation
                segments[segmentIndex] = updatedSegment;
                segmentation.segments = segments;

                // Update the segment in the segmentInfoBySeriesAndLabel
                if (segmentInfoBySeriesAndLabel[series.series_instance_uid]) {
                  const segmentMap = segmentInfoBySeriesAndLabel[series.series_instance_uid];
                  segmentMap[updatedSegment.label] = updatedSegment;
                }
                break;
              }
            }
          }
        }

        return {
          studiesInfo: {
            ...state.studiesInfo,
            studyMap,
            segmentInfoBySeriesAndLabel,
          },
        };
      },
      false,
      'updateSegment'
    );
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
