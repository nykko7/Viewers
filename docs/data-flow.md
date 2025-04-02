# T-CHAII Data Flow Documentation

## Overview

This document describes how data flows between DICOM segmentations and API data in the T-CHAII application, focusing on how lesion information is managed and displayed.

## Data Sources

### 1. DICOM Segmentations
- Source: DICOM SEG files loaded through OHIF viewer
- Contains: Raw segmentation data, including:
  - Segment contours
  - Basic segment metadata (label, color)
  - Reference to original image series

### 2. API Data
- Source: T-CHAII backend API
- Contains: Enhanced segmentation metadata, including:
  - Lesion measurements (volume, diameters)
  - Clinical classifications
  - Relationships between lesions
  - Study information
  - Baseline study identification

## API Response Structure

### Study Object
```typescript
type Study = {
  study_id: string;
  study_date: string;
  is_basal: boolean;
  series: Series[];
};
```

The API response contains an array of studies, each with:
- `study_id`: Unique identifier for the study
- `study_date`: Date when the study was performed
- `is_basal`: Boolean indicating if this is a baseline study
- `series`: Array of series in the study

### Series and Segmentations
```typescript
type Series = {
  series_instance_uid: string;
  segmentations: Segmentation[];
};

type Segmentation = {
  id: string;
  name: string;
  status: string;
  segments: Segment[];
};
```

Each series contains:
- `series_instance_uid`: DICOM Series Instance UID
- `segmentations`: Array of segmentation objects containing segments

### Segment Object
```typescript
type Segment = {
  id: string;
  label: string;
  affected_organs: string;
  volume: number;
  axial_diameter: number | null;
  coronal_diameter: number | null;
  sagittal_diameter: number | null;
  lession_classification: 'Target' | 'Non-Target' | 'New lession';
  lession_type: 'Mass' | 'Other' | 'Lymph';
  lesion_segments: string[]; // References to related segments in other studies
};
```

## Segment Relationships

### How Segments are Related

1. **Direct References**
   - Each segment has a `lesion_segments` array containing IDs of related segments from other studies
   - These references create a directed graph of segment relationships
   - Example:
     ```json
     {
       "id": "e2f4b6a8-7a86-4b78-b9cf-e25482e7cb94",
       "lesion_segments": ["c012ad48-59e1-434d-986a-94a334ed5355"]
     }
     ```

2. **Relationship Types**
   - **Follow-up**: When a segment in a newer study refers to a segment in an older study
   - **Split**: When multiple segments in a newer study refer to the same segment in an older study
   - **Merge**: When a segment in a newer study refers to multiple segments in an older study

### Visualization in LesionFlowGraph

The `LesionFlowGraph` component visualizes these relationships:

1. **Node Creation**
   ```typescript
   type LesionNodeData = {
     label: string;
     segmentId: string;
     studyDate: string;
     volume: number;
     classification: string;
     isBaseline: boolean;
     isRelated: boolean;
   };
   ```

2. **Edge Creation**
   - Edges are created based on `lesion_segments` references
   - Direction flows from older to newer studies
   - Visual attributes:
     - Animated edges for selected segment's relationships
     - Different colors for baseline, selected, and related segments
     - Tooltips showing detailed segment information

3. **Connection Map**
   ```typescript
   // Connection map structure (parent -> children)
   Map<string, Set<string>>
   ```
   Example:
   ```typescript
   {
     "segment1": Set(["segment2", "segment3"]), // Split case
     "segment4": Set(["segment5"]),            // Follow-up case
   }
   ```

### EditLesionDialog Integration

The `EditLesionDialog` component uses these relationships to:

1. **Display History**
   - Shows measurements history for related segments
   - Groups segments by study date
   - Calculates total volumes for split/merged segments

2. **Trajectory Tracking**
   ```typescript
   type LesionTrajectory = {
     study: Study;
     segments: Array<{
       segment: Segment;
       isSplit?: boolean;
       isMerge?: boolean;
     }>;
     totalVolume: number;
   }[];
   ```

3. **State Management**
   - Uses `useSegmentationsStore` to access and update segment data
   - Maintains selection state for the current segment
   - Updates form values based on selected segment data

## State Management

### Segmentations Store (`useSegmentationsStore`)

The central state management solution using Zustand with the following structure:

```typescript
type StudiesInfo = {
  studyMap: Record<string, Study>;
  segmentInfoBySeriesAndLabel: Record<string, Record<string, Segment>>;
  baselineStudy: Study | null;
};
```

Key functions:
- `setStudies`: Initializes study data from API
- `updateSegmentInfo`: Updates segment information with API data
- `getSegmentInfoBySeriesAndLabel`: Retrieves segment info by series and label
- `getStudy`: Gets study by ID
- `getBaselineStudy`: Gets the baseline study
- `clearStore`: Clears all data
- `getStudies`: Gets all studies

## Data Flow Process

1. **Initial Load**
   ```mermaid
   graph TD
   A[URL with StudyInstanceUID] --> B[Mode Enter]
   B --> C[Fetch API Data]
   C --> D[Initialize Store]
   D --> E[Set Studies Info]
   ```

2. **Viewport Change**
   ```mermaid
   graph TD
   A[Viewport Change] --> B[Wait for Viewport Ready]
   B --> C[Get Display Sets]
   C --> D[Find SEG Display Set]
   D --> E[Get Active Segmentation]
   E --> F[Update with API Data]
   F --> G[Update UI]
   ```

3. **Segmentation Update Process**
   ```mermaid
   graph TD
   A[DICOM SEG Load] --> B[Create Segmentation]
   B --> C[Match with API Data]
   C --> D[Combine Data]
   D --> E[Update Store]
   E --> F[Update UI Components]
   ```

## Key Components Interaction

### 1. Mode Initialization
- Loads when entering T-CHAII mode
- Fetches initial API data
- Sets up toolbar and tools
- Initializes store with study data

### 2. Viewport Management
- Handles viewport changes
- Matches DICOM segments with API data
- Updates segmentation display
- Manages segment selection

### 3. UI Components
- EditLesionDialog: Displays and edits lesion metadata
- LesionFlowGraph: Visualizes lesion relationships
- SegmentationPanel: Manages segment list and tools

## Data Synchronization

1. **DICOM to API Matching**
   - Segments are matched by series UID and label
   - API data enhances DICOM segments with additional metadata

2. **State Updates**
   - Store updates trigger UI updates
   - Components react to store changes
   - Bidirectional sync between DICOM and API data

3. **Error Handling**
   - Graceful degradation when API data is unavailable
   - Maintains DICOM functionality without API data
   - Logs warnings for debugging

## Best Practices

1. **Data Access**
   - Always access API data through the store
   - Use selectors for specific data needs
   - Keep DICOM and API data synchronized

2. **State Management**
   - Minimize direct store mutations
   - Use provided store actions
   - Handle async operations properly

3. **Component Design**
   - Keep components focused on specific tasks
   - Use proper typing for data structures
   - Implement error boundaries

## Future Considerations

1. **Performance Optimization**
   - Consider caching strategies
   - Optimize store updates
   - Implement lazy loading

2. **Error Recovery**
   - Implement retry mechanisms
   - Add fallback UI states
   - Improve error reporting

3. **Data Validation**
   - Add schema validation
   - Implement data integrity checks
   - Add migration strategies

## Debugging Tips

1. **Store Debugging**
   - Enable DEBUG_STORE flag
   - Use Redux DevTools
   - Monitor state changes

2. **Data Flow Issues**
   - Check API responses
   - Verify DICOM segment matching
   - Monitor store updates

3. **Component Issues**
   - Check prop types
   - Verify data presence
   - Monitor component lifecycle
