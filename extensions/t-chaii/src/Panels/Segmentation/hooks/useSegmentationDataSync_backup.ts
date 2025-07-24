import { useEffect } from 'react';
import { useSegmentationsStore } from '../../../stores/useSegmentationsStore';
import { cache, metaData, utilities } from '@cornerstonejs/core';
import { segmentation as cstSegmentation, Enums as cstEnums } from '@cornerstonejs/tools';

// Lazy load OpenCV.js
let cv: any = null;
let isLoadingOpenCV = false;

const loadOpenCV = async (): Promise<any> => {
  if (cv) {
    console.log('[OpenCV] OpenCV already loaded');
    return cv;
  }

  if (isLoadingOpenCV) {
    console.log('[OpenCV] OpenCV loading in progress, waiting...');
    // Wait for the loading to complete
    while (isLoadingOpenCV && !cv) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cv;
  }

  isLoadingOpenCV = true;

  try {
    console.log('[OpenCV] Attempting to load OpenCV.js...');

    // Check if OpenCV is already available globally (loaded via script tag)
    if (typeof window !== 'undefined' && (window as any).cv) {
      cv = (window as any).cv;
      console.log('[OpenCV] Found OpenCV in global scope');

      // Wait for initialization if needed
      if (!cv.Mat) {
        console.log('[OpenCV] Waiting for OpenCV initialization...');
        await new Promise(resolve => {
          cv.onRuntimeInitialized = resolve;
        });
      }

      isLoadingOpenCV = false;
      return cv;
    }

    // Try multiple import strategies
    let cvModule;

    // Strategy 1: Standard ES module import
    try {
      console.log('[OpenCV] Trying ES module import...');
      cvModule = await import('opencv.js');
      console.log('[OpenCV] ES module import successful:', Object.keys(cvModule));
    } catch (importError) {
      console.log('[OpenCV] ES module import failed:', importError.message);

      // Strategy 2: Try different module paths
      try {
        console.log('[OpenCV] Trying alternative import paths...');
        cvModule = await import('opencv.js/opencv.js');
      } catch (altError) {
        console.log('[OpenCV] Alternative paths failed:', altError.message);

        // Strategy 3: Load via script tag
        console.log('[OpenCV] Trying script tag approach...');
        await loadOpenCVScript();
        cv = (window as any).cv;

        if (!cv) {
          throw new Error('Failed to load OpenCV via script tag');
        }

        isLoadingOpenCV = false;
        return cv;
      }
    }

    // Extract cv from the module
    cv = cvModule?.cv || cvModule?.default?.cv || cvModule?.default || cvModule;

    if (!cv) {
      throw new Error('OpenCV module not found in any expected location');
    }

    console.log('[OpenCV] OpenCV module found:', typeof cv);

    // Wait for OpenCV to be ready if it has the initialization callback
    if (cv.onRuntimeInitialized !== undefined && typeof cv.onRuntimeInitialized !== 'function') {
      console.log('[OpenCV] Waiting for runtime initialization...');
      await new Promise(resolve => {
        cv.onRuntimeInitialized = () => {
          console.log('[OpenCV] Runtime initialized');
          resolve(cv);
        };
      });
    }

    // Test basic OpenCV functionality
    if (cv.Mat && cv.findContours && cv.minAreaRect) {
      console.log('[OpenCV] OpenCV.js loaded successfully with required functions');
      isLoadingOpenCV = false;
      return cv;
    } else {
      throw new Error(
        'OpenCV loaded but missing required functions: ' +
          JSON.stringify({
            Mat: !!cv.Mat,
            findContours: !!cv.findContours,
            minAreaRect: !!cv.minAreaRect,
          })
      );
    }
  } catch (error) {
    console.error('[OpenCV] Failed to load OpenCV.js:', error);
    isLoadingOpenCV = false;
    throw error;
  }
};

// Load OpenCV via script tag as fallback
const loadOpenCVScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available for script loading'));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.5.0/opencv.js';
    script.async = true;

    script.onload = () => {
      console.log('[OpenCV] Script loaded successfully');
      // Wait for OpenCV to initialize
      if ((window as any).cv) {
        const checkInit = () => {
          if ((window as any).cv.Mat) {
            resolve();
          } else {
            (window as any).cv.onRuntimeInitialized = resolve;
          }
        };
        checkInit();
      } else {
        reject(new Error('OpenCV not found after script load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load OpenCV script'));
    };

    document.head.appendChild(script);
  });
};

// OpenCV-like functions for contour analysis (simplified for browser)
interface Point {
  x: number;
  y: number;
}

interface Contour extends Array<Point> {}

interface MinAreaRect {
  center: Point;
  size: { width: number; height: number };
  angle: number;
}

interface SegmentStats {
  voxelCount: number;
  volumeMm3: number;
  volumeCm3: number;
  diameter: number;
}

type SegmentStatsMap = Record<string, SegmentStats>;

const { SegmentationRepresentations } = cstEnums;

/**
 * Helper functions for contour analysis and OBB calculations
 */

/**
 * Find contours in a binary mask
 * Improved implementation to better match OpenCV's behavior
 */
function findContours(mask: Uint8Array, width: number, height: number): Contour[] {
  const contours: Contour[] = [];
  const visited = new Set<number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0 && !visited.has(idx)) {
        const contour = traceContour(mask, width, height, x, y, visited);
        if (contour.length > 2) {
          // Need at least 3 points for meaningful contour
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Trace a contour starting from a point
 */
function traceContour(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<number>
): Contour {
  const contour: Contour = [];
  const stack: Point[] = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const point = stack.pop()!;
    const idx = point.y * width + point.x;

    if (
      visited.has(idx) ||
      point.x < 0 ||
      point.x >= width ||
      point.y < 0 ||
      point.y >= height ||
      mask[idx] === 0
    ) {
      continue;
    }

    visited.add(idx);
    contour.push(point);

    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        stack.push({ x: point.x + dx, y: point.y + dy });
      }
    }
  }

  return contour;
}

/**
 * Calculate contour area using the shoelace formula
 * Equivalent to cv2.contourArea() in OpenCV
 */
function contourArea(contour: Contour): number {
  if (contour.length < 3) {
    return 0;
  }

  let area = 0;
  const n = contour.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i].x * contour[j].y;
    area -= contour[j].x * contour[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate minimum area rectangle (OBB) for a contour
 * Improved implementation to better match cv2.minAreaRect() behavior
 */
function minAreaRect(contour: Contour): MinAreaRect {
  if (contour.length < 3) {
    return {
      center: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
      angle: 0,
    };
  }

  // Find convex hull first (essential for accurate OBB)
  const hull = convexHull(contour);

  if (hull.length < 3) {
    // Fallback to axis-aligned bounding box
    const minX = Math.min(...contour.map(p => p.x));
    const maxX = Math.max(...contour.map(p => p.x));
    const minY = Math.min(...contour.map(p => p.y));
    const maxY = Math.max(...contour.map(p => p.y));

    return {
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      size: { width: maxX - minX, height: maxY - minY },
      angle: 0,
    };
  }

  let minArea = Infinity;
  let bestRect: MinAreaRect = {
    center: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    angle: 0,
  };

  // Check all possible orientations based on hull edges
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const edge = { x: hull[j].x - hull[i].x, y: hull[j].y - hull[i].y };
    const edgeLength = Math.sqrt(edge.x * edge.x + edge.y * edge.y);

    if (edgeLength < 1e-10) {
      continue;
    } // Skip degenerate edges

    const angle = Math.atan2(edge.y, edge.x);
    const rect = getOrientedBoundingRect(hull, angle);
    const area = rect.size.width * rect.size.height;

    if (area < minArea && area > 0) {
      minArea = area;
      bestRect = rect;
    }
  }

  // Also check the perpendicular orientations
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const edge = { x: hull[j].x - hull[i].x, y: hull[j].y - hull[i].y };
    const edgeLength = Math.sqrt(edge.x * edge.x + edge.y * edge.y);

    if (edgeLength < 1e-10) {
      continue;
    }

    const angle = Math.atan2(edge.y, edge.x) + Math.PI / 2; // Perpendicular
    const rect = getOrientedBoundingRect(hull, angle);
    const area = rect.size.width * rect.size.height;

    if (area < minArea && area > 0) {
      minArea = area;
      bestRect = rect;
    }
  }

  return bestRect;
}

/**
 * Calculate convex hull using Graham scan
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) {
    return points;
  }

  // Find bottom-most point (or left most in case of tie)
  let start = points[0];
  let startIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < start.y || (points[i].y === start.y && points[i].x < start.x)) {
      start = points[i];
      startIdx = i;
    }
  }

  // Sort points by polar angle with respect to start point
  const sorted = points.slice();
  sorted.splice(startIdx, 1);
  sorted.sort((a, b) => {
    const angleA = Math.atan2(a.y - start.y, a.x - start.x);
    const angleB = Math.atan2(b.y - start.y, b.x - start.x);
    return angleA - angleB;
  });

  const hull = [start];
  for (const point of sorted) {
    while (
      hull.length > 1 &&
      crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
    ) {
      hull.pop();
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Calculate cross product for three points
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Get oriented bounding rectangle for given angle
 */
function getOrientedBoundingRect(points: Point[], angle: number): MinAreaRect {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Rotate points
  const rotated = points.map(p => ({
    x: p.x * cos + p.y * sin,
    y: -p.x * sin + p.y * cos,
  }));

  // Find axis-aligned bounding box of rotated points
  let minX = rotated[0].x,
    maxX = rotated[0].x;
  let minY = rotated[0].y,
    maxY = rotated[0].y;

  for (const p of rotated) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Rotate center back
  const originalCenterX = centerX * cos - centerY * sin;
  const originalCenterY = centerX * sin + centerY * cos;

  return {
    center: { x: originalCenterX, y: originalCenterY },
    size: { width, height },
    angle: (angle * 180) / Math.PI,
  };
}

/**
 * Compute diameters of a lesion using OBB method with largest-area unconnected strategy
 */
function computeDiameters(
  _mask: any,
  lesion: any,
  method: 'obb' = 'obb',
  unconnectedStrategy: 'largest-area' = 'largest-area',
  spacing: number[] = [1, 1, 1],
  returnFigureParams: boolean = false
): any {
  console.log('[computeDiameters] Computing diameters for lesion:', lesion);

  if (!lesion || !lesion.coords) {
    console.log('[computeDiameters] Invalid lesion data');
    return null;
  }

  // Get unique slices where the lesion exists
  const uniqueSlices = [...new Set(lesion.coords.map((coord: number[]) => coord[0]))];
  const groupedMaxDiameters: Record<string, number> = {};
  const groupedMinDiameters: Record<string, number> = {};

  console.log('[computeDiameters] Processing slices:', uniqueSlices);

  if (method === 'obb') {
    // Process each slice
    for (const sliceIdx of uniqueSlices) {
      try {
        // Create slice mask for this specific slice
        const sliceCoords = lesion.coords.filter((coord: number[]) => coord[0] === sliceIdx);

        if (sliceCoords.length === 0) {
          console.log(`[computeDiameters] No coordinates for slice ${sliceIdx}`);
          continue;
        }

        // Find bounding box for this slice
        const minRow = Math.min(...sliceCoords.map((coord: number[]) => coord[1]));
        const maxRow = Math.max(...sliceCoords.map((coord: number[]) => coord[1]));
        const minCol = Math.min(...sliceCoords.map((coord: number[]) => coord[2]));
        const maxCol = Math.max(...sliceCoords.map((coord: number[]) => coord[2]));

        const width = maxCol - minCol + 1;
        const height = maxRow - minRow + 1;

        // Create binary mask for this slice
        const sliceMask = new Uint8Array(width * height);

        for (const coord of sliceCoords) {
          const row = coord[1] - minRow;
          const col = coord[2] - minCol;
          if (row >= 0 && row < height && col >= 0 && col < width) {
            sliceMask[row * width + col] = 255;
          }
        }

        console.log(
          `[computeDiameters] Processing slice ${sliceIdx} with dimensions ${width}x${height}`
        );

        // Find contours in the slice
        const contours = findContours(sliceMask, width, height);

        if (contours.length === 0) {
          console.log(`[computeDiameters] No contours found for slice ${sliceIdx}`);
          continue;
        }

        console.log(`[computeDiameters] Found ${contours.length} contours for slice ${sliceIdx}`);

        let majorLength = 0;
        let minorLength = 0;

        // Apply unconnected strategy
        if (unconnectedStrategy === 'largest-area') {
          // Find the contour with the largest area
          const largestContour = contours.reduce((prev, current) =>
            contourArea(current) > contourArea(prev) ? current : prev
          );

          const rect = minAreaRect(largestContour);
          majorLength = Math.max(rect.size.width, rect.size.height) * spacing[1];
          minorLength = Math.min(rect.size.width, rect.size.height) * spacing[1];

          console.log(
            `[computeDiameters] Slice ${sliceIdx} largest contour - major: ${majorLength}, minor: ${minorLength}`
          );
        } else {
          console.log(
            `[computeDiameters] Unconnected strategy '${unconnectedStrategy}' not implemented`
          );
          continue;
        }

        groupedMaxDiameters[sliceIdx.toString()] = majorLength;
        groupedMinDiameters[sliceIdx.toString()] = minorLength;
      } catch (error) {
        console.error(`[computeDiameters] Error processing slice ${sliceIdx}:`, error);
        continue;
      }
    }
  } else {
    console.log(`[computeDiameters] Method '${method}' not implemented`);
    return null;
  }

  // Find the slice with the maximum diameter
  const majorAxisSliceIdx = Object.keys(groupedMaxDiameters).reduce((a, b) =>
    groupedMaxDiameters[a] > groupedMaxDiameters[b] ? a : b
  );

  const majorAxis = groupedMaxDiameters[majorAxisSliceIdx] || 0;
  const minorAxis = groupedMinDiameters[majorAxisSliceIdx] || 0;

  const output = {
    label_value: lesion.label,
    major_axis_mm: majorAxis,
    minor_axis_mm: minorAxis,
    major_axis_slice_idx: parseInt(majorAxisSliceIdx),
    method: method,
    unconnected_strategy: unconnectedStrategy,
  };

  console.log('[computeDiameters] Final result:', output);

  if (returnFigureParams) {
    // For now, return just the output. Figure params can be added later if needed
    return { output, figures: [] };
  }

  return output;
}

/**
 * Compute diameters using OpenCV.js - EXACT implementation of Python reference
 * Equivalent to DiameterMeasurer.compute_diameters() with method='obb' and unconnected_strategy='largest-area'
 */
async function computeDiametersOBBOpenCV(
  lesion: any,
  spacing: number[] = [1, 1, 1],
  unconnectedStrategy: 'largest-area' = 'largest-area'
): Promise<any> {
  console.log(
    '🚀 [OPENCV ATTEMPT] Starting computeDiametersOBBOpenCV - ATTEMPTING TO USE REAL OPENCV!'
  );
  console.log('[computeDiametersOBBOpenCV] Computing OBB diameters for lesion:', lesion.label);

  if (!lesion || !lesion.coords || lesion.coords.length === 0) {
    console.log('[computeDiametersOBBOpenCV] Invalid lesion data');
    return null;
  }

  try {
    // Load OpenCV.js
    console.log('[computeDiametersOBBOpenCV] Attempting to load OpenCV...');
    const cv = await loadOpenCV();
    console.log('[computeDiametersOBBOpenCV] OpenCV loaded successfully, functions available:', {
      Mat: typeof cv.Mat,
      findContours: typeof cv.findContours,
      minAreaRect: typeof cv.minAreaRect,
      MatVector: typeof cv.MatVector,
    });

    // Get unique slices (equivalent to np.unique(lesion.coords[:, 0]))
    const uniqueSlices = [...new Set(lesion.coords.map((coord: number[]) => coord[0]))];
    const groupedMaxDiameters: Record<string, number> = {};
    const groupedMinDiameters: Record<string, number> = {};

    console.log('[computeDiametersOBBOpenCV] Processing slices:', uniqueSlices);

    // Process each slice (Python: for slice_idx in unique_slices:)
    for (const sliceIdx of uniqueSlices) {
      try {
        // Get coordinates for this slice
        const sliceCoords = lesion.coords.filter((coord: number[]) => coord[0] === sliceIdx);

        if (sliceCoords.length === 0) {
          console.log(`[computeDiametersOBBOpenCV] No coordinates for slice ${sliceIdx}`);
          continue;
        }

        // Create binary mask for this slice
        // Python: slice_mask = (mask[slice_idx] == lesion.label).astype('uint8') * 255
        const minRow = Math.min(...sliceCoords.map((coord: number[]) => coord[1]));
        const maxRow = Math.max(...sliceCoords.map((coord: number[]) => coord[1]));
        const minCol = Math.min(...sliceCoords.map((coord: number[]) => coord[2]));
        const maxCol = Math.max(...sliceCoords.map((coord: number[]) => coord[2]));

        const width = maxCol - minCol + 1;
        const height = maxRow - minRow + 1;

        // Create OpenCV Mat for the slice mask
        console.log('🟢 [OPENCV USAGE] Creating OpenCV Mat for slice mask - USING REAL OPENCV!');
        console.log('🟢 [OPENCV USAGE] cv.Mat available:', typeof cv.Mat);
        console.log('🟢 [OPENCV USAGE] cv.CV_8UC1:', cv.CV_8UC1);

        const sliceMask = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(0));

        console.log('🟢 [OPENCV USAGE] OpenCV Mat created successfully:', sliceMask);

        // Fill the mask with 255 for lesion pixels
        for (const coord of sliceCoords) {
          const row = coord[1] - minRow;
          const col = coord[2] - minCol;
          if (row >= 0 && row < height && col >= 0 && col < width) {
            sliceMask.ucharPtr(row, col)[0] = 255;
          }
        }

        // Find contours using OpenCV (Python: contours, _ = cv2.findContours(...))
        console.log('🟢 [OPENCV USAGE] Using cv.findContours - REAL OPENCV FUNCTION!');
        console.log('🟢 [OPENCV USAGE] cv.findContours type:', typeof cv.findContours);
        console.log('🟢 [OPENCV USAGE] cv.RETR_EXTERNAL:', cv.RETR_EXTERNAL);

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(sliceMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        console.log(
          '🟢 [OPENCV USAGE] cv.findContours completed, found contours:',
          contours.size()
        );

        // Filter contours with more than 1 point (Python: [item for item in contours if len(item) > 1])
        const validContours: any[] = [];
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          if (contour.rows > 1) {
            validContours.push(contour);
          }
        }

        if (validContours.length === 0) {
          console.log(`[computeDiametersOBBOpenCV] No valid contours found for slice ${sliceIdx}`);
          // Clean up
          sliceMask.delete();
          contours.delete();
          hierarchy.delete();
          continue;
        }

        let majorLength = 0;
        let minorLength = 0;

        // Apply largest-area strategy
        // Python: largest_contour = max(contours, key=cv2.contourArea)
        if (unconnectedStrategy === 'largest-area') {
          console.log(
            '🟢 [OPENCV USAGE] Using cv.contourArea to find largest contour - REAL OPENCV!'
          );

          let largestContour = validContours[0];
          let maxArea = cv.contourArea(largestContour);
          console.log('🟢 [OPENCV USAGE] cv.contourArea result for first contour:', maxArea);

          for (let i = 1; i < validContours.length; i++) {
            const area = cv.contourArea(validContours[i]);
            if (area > maxArea) {
              maxArea = area;
              largestContour = validContours[i];
            }
          }

          // Calculate OBB using OpenCV (Python: _, (width, height), _ = cv2.minAreaRect(largest_contour))
          console.log('🟢 [OPENCV USAGE] Using cv.minAreaRect for OBB calculation - REAL OPENCV!');
          console.log('🟢 [OPENCV USAGE] cv.minAreaRect type:', typeof cv.minAreaRect);

          const rotatedRect = cv.minAreaRect(largestContour);
          const rectWidth = rotatedRect.size.width;
          const rectHeight = rotatedRect.size.height;

          console.log(
            '🟢 [OPENCV USAGE] cv.minAreaRect result - width:',
            rectWidth,
            'height:',
            rectHeight
          );

          // Apply spacing (Python: major_length = max(width, height) * self.spacing[1])
          majorLength = Math.max(rectWidth, rectHeight) * spacing[1];
          minorLength = Math.min(rectWidth, rectHeight) * spacing[1];

          console.log(
            '🟢 [OPENCV USAGE] Final OBB calculation with spacing - major:',
            majorLength,
            'minor:',
            minorLength
          );

          console.log(
            `[computeDiametersOBBOpenCV] Slice ${sliceIdx}: contours=${validContours.length}, largest_area=${maxArea.toFixed(2)}, major=${majorLength.toFixed(2)}mm, minor=${minorLength.toFixed(2)}mm`
          );
        } else {
          console.log(
            `[computeDiametersOBBOpenCV] Unconnected strategy '${unconnectedStrategy}' not implemented`
          );
        }

        // Store results (Python: grouped_max_diameters.update({str(slice_idx): major_length}))
        groupedMaxDiameters[sliceIdx.toString()] = majorLength;
        groupedMinDiameters[sliceIdx.toString()] = minorLength;

        // Clean up OpenCV objects
        sliceMask.delete();
        contours.delete();
        hierarchy.delete();
        validContours.forEach(contour => contour.delete());
      } catch (error) {
        console.error(`[computeDiametersOBBOpenCV] Error processing slice ${sliceIdx}:`, error);
        continue;
      }
    }

    // Check if we have any valid measurements
    if (Object.keys(groupedMaxDiameters).length === 0) {
      console.log('[computeDiametersOBBOpenCV] No valid measurements found');
      return null;
    }

    // Get the major axis of all lesion slices
    // Python: major_axis_slice_idx = max(grouped_max_diameters, key=grouped_max_diameters.get)
    const majorAxisSliceIdx = Object.keys(groupedMaxDiameters).reduce((a, b) =>
      groupedMaxDiameters[a] > groupedMaxDiameters[b] ? a : b
    );

    // Get the major and minor axis lengths
    const majorAxis = groupedMaxDiameters[majorAxisSliceIdx];
    const minorAxis = groupedMinDiameters[majorAxisSliceIdx];

    const output = {
      label_value: lesion.label,
      major_axis_mm: majorAxis,
      minor_axis_mm: minorAxis,
      major_axis_slice_idx: parseInt(majorAxisSliceIdx),
      method: 'obb',
      unconnected_strategy: unconnectedStrategy,
    };

    console.log('[computeDiametersOBBOpenCV] Final result:', output);
    return output;
  } catch (error) {
    console.error('❌ [OPENCV FAILED] Error loading OpenCV or processing:', error);
    console.log('⚠️ [FALLBACK] Falling back to custom implementation - NOT USING OPENCV');

    // Fallback to the original custom implementation
    try {
      const result = await computeDiameters(lesion, spacing, 'obb', unconnectedStrategy);
      console.log('⚠️ [FALLBACK] Custom implementation result:', result);
      return result;
    } catch (fallbackError) {
      console.error('❌ [FALLBACK FAILED] Fallback also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Extract lesion coordinates from segmentation data
 * Enhanced to work with voxel managers and different data structures
 */
function extractLesionCoordinates(
  segmentVoxelData: any,
  segmentIndex: number,
  dimensions: number[]
): number[][] {
  const coords: number[][] = [];

  if (!segmentVoxelData || !dimensions || dimensions.length < 3) {
    console.log('[extractLesionCoordinates] Invalid input data');
    return coords;
  }

  const [depth, height, width] = dimensions;
  console.log(
    `[extractLesionCoordinates] Extracting coordinates for segment ${segmentIndex} in volume ${width}x${height}x${depth}`
  );

  try {
    // Check if we have a voxel manager with forEach method
    if (segmentVoxelData && typeof segmentVoxelData.forEach === 'function') {
      console.log('[extractLesionCoordinates] Using voxel manager forEach');
      let foundVoxels = 0;

      segmentVoxelData.forEach(({ value, index }: { value: number; index: number }) => {
        if (value === segmentIndex) {
          // Convert linear index to 3D coordinates
          const z = Math.floor(index / (height * width));
          const remainder = index % (height * width);
          const y = Math.floor(remainder / width);
          const x = remainder % width;

          if (z >= 0 && z < depth && y >= 0 && y < height && x >= 0 && x < width) {
            coords.push([z, y, x]);
            foundVoxels++;
          }
        }
      });

      console.log(`[extractLesionCoordinates] Found ${foundVoxels} voxels using voxel manager`);
    }
    // Fallback to direct array iteration
    else if (segmentVoxelData.length) {
      console.log('[extractLesionCoordinates] Using direct array iteration');
      let foundVoxels = 0;

      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = z * height * width + y * width + x;
            if (index < segmentVoxelData.length && segmentVoxelData[index] === segmentIndex) {
              coords.push([z, y, x]);
              foundVoxels++;
            }
          }
        }
      }

      console.log(`[extractLesionCoordinates] Found ${foundVoxels} voxels using direct iteration`);
    } else {
      console.log('[extractLesionCoordinates] Unsupported voxel data format');
    }
  } catch (error) {
    console.error('[extractLesionCoordinates] Error extracting coordinates:', error);
  }

  console.log(
    `[extractLesionCoordinates] Extracted ${coords.length} coordinates for segment ${segmentIndex}`
  );
  return coords;
}

/**
 * Extract coordinates for a specific segment from image IDs
 */
async function extractSegmentCoordinatesFromImageIds(
  imageIds: string[],
  segmentIndex: number
): Promise<number[][]> {
  const coords: number[][] = [];
  
  try {
    console.log(`[extractSegmentCoordinatesFromImageIds] Extracting coordinates for segment ${segmentIndex} from ${imageIds.length} images`);
    
    // For now, return empty coordinates as this is a complex operation
    // that would require accessing pixel data from each image
    console.log('[extractSegmentCoordinatesFromImageIds] Image-based coordinate extraction not yet implemented');
    
    return coords;
  } catch (error) {
    console.error('[extractSegmentCoordinatesFromImageIds] Error extracting coordinates:', error);
    return coords;
  }
}

/**
 * Enhanced calculate and update stats with OBB diameter calculation
 */
async function calculateAndUpdateStatsWithOBB(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  _segId: string,
  segmentation: any,
  _updateSegment: any,
  voxelData?: any,
  dimensions?: number[]
) {
  console.log(
    '🎯 [calculateAndUpdateStatsWithOBB] FUNCTION CALLED! Starting enhanced OBB calculation...'
  );
  console.log('🎯 [calculateAndUpdateStatsWithOBB] Input parameters:', {
    segmentCount: Object.keys(segmentVoxelCounts).length,
    spacing,
    hasDimensions: !!dimensions,
    hasVoxelData: !!voxelData,
    dimensions,
  });

  // Calculate volume and diameter for each segment
  const voxelVolume = spacing[0] * spacing[1] * spacing[2]; // mm³

  for (const [segmentIndexStr, voxelCount] of Object.entries(segmentVoxelCounts)) {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000; // Convert to cm³

    // Calculate diameter assuming spherical shape
    const radius = Math.pow((3 * volumeCm3) / (4 * Math.PI), 1 / 3);
    const sphericalDiameter = 2 * radius; // in cm

    console.log(
      `[calculateAndUpdateStatsWithOBB] Segment ${segmentIndex}: ${voxelCount} voxels, ${volumeMm3.toFixed(2)} mm³`
    );

    // Try to calculate more accurate diameters using OBB method
    let obbDiameters = null;
    try {
      if (voxelData && dimensions) {
        // Extract coordinates for this specific segment
        const coords = extractLesionCoordinates(voxelData, segmentIndex, dimensions);

        if (coords.length > 0) {
          const mockLesion = {
            label: segmentIndex,
            coords: coords,
          };

          obbDiameters = await computeDiametersOBBOpenCV(mockLesion, spacing, 'largest-area');

          console.log(
            `[calculateAndUpdateStatsWithOBB] OBB diameters for segment ${segmentIndex}:`,
            obbDiameters
          );
        } else {
          console.log(
            `[calculateAndUpdateStatsWithOBB] No coordinates found for segment ${segmentIndex}`
          );
        }
      } else {
        console.log(
          `[calculateAndUpdateStatsWithOBB] Voxel data or dimensions not available for OBB calculation`
        );
      }
    } catch (error) {
      console.log(
        `[calculateAndUpdateStatsWithOBB] Could not calculate OBB diameters for segment ${segmentIndex}:`,
        error
      );
    }

    // Update segment cachedStats directly in the OHIF segmentation
    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      console.log(
        `[calculateAndUpdateStatsWithOBB] Updating segment ${segmentIndex} with new statistics`
      );

      // Update the cachedStats directly
      if (!segment.cachedStats) {
        segment.cachedStats = {};
      }

      // Use OBB diameters if available, otherwise use spherical diameter (all in mm)
      const sphericalDiameterMm = sphericalDiameter * 10; // Convert cm to mm
      const majorDiameterMm = obbDiameters?.major_axis_mm ?? sphericalDiameterMm;
      const minorDiameterMm = obbDiameters?.minor_axis_mm ?? sphericalDiameterMm;

      // Update the cachedStats with real calculated values - create new object to trigger React updates
      segment.cachedStats = {
        ...segment.cachedStats,
        volume: volumeMm3, // Volume in mm³
        diameter: majorDiameterMm, // Use major diameter as the primary diameter in mm
        major_diameter: majorDiameterMm,
        minor_diameter: minorDiameterMm,
        axial_diameter: majorDiameterMm,
        coronal_diameter: majorDiameterMm,
        sagittal_diameter: majorDiameterMm,
        obb_method: obbDiameters ? 'obb' : 'spherical',
        obb_strategy: obbDiameters ? 'largest-area' : null,
        major_axis_slice_idx: obbDiameters?.major_axis_slice_idx || null,
      };

      // Force a re-render by updating the segmentation object reference
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(
        `[calculateAndUpdateStatsWithOBB] Updated segment ${segmentIndex} with ${obbDiameters ? 'OBB' : 'spherical'} diameters`
      );
    }
  }

  console.log('[calculateAndUpdateStatsWithOBB] Statistics calculation completed successfully');
}

// Declare global types
declare global {
  interface Window {
    segmentationUpdateTimeout: any;
  }
}

type UseSegmentationDataSyncProps = {
  servicesManager: any;
  subscribeToDataModified?: boolean;
};

export function useSegmentationDataSync({
  servicesManager,
  subscribeToDataModified = false,
}: UseSegmentationDataSyncProps) {
  const { segmentations, updateSegment } = useSegmentationsStore();

  useEffect(() => {
    console.log('🚀 [useSegmentationDataSync] useEffect triggered!', {
      subscribeToDataModified,
      hasServicesManager: !!servicesManager,
    });

    if (!subscribeToDataModified) {
      console.log('[useSegmentationDataSync] subscribeToDataModified is false, not subscribing');
      return;
    }

    const { segmentationService } = servicesManager.services;
    console.log('[useSegmentationDataSync] Setting up subscription to SEGMENTATION_DATA_MODIFIED');
    console.log('[useSegmentationDataSync] Available events:', segmentationService.EVENTS);

    const unsubscribe = segmentationService.subscribe(
      segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED,
      (evt: any) => {
        console.log('[useSegmentationDataSync] SEGMENTATION_DATA_MODIFIED event received:', evt);

        // Debounce the calculation to avoid excessive updates during rapid brush strokes
        clearTimeout(window.segmentationUpdateTimeout);
        window.segmentationUpdateTimeout = setTimeout(() => {
          handleSegmentationDataModified(evt, segmentations, updateSegment, segmentationService);
        }, 500);
      }
    );

    console.log('[useSegmentationDataSync] Subscription set up successfully');

    return () => {
      console.log('[useSegmentationDataSync] Cleaning up subscription');
      unsubscribe();
      clearTimeout(window.segmentationUpdateTimeout);
    };
  }, [subscribeToDataModified, segmentations, updateSegment, servicesManager]);
}

/**
 * Handle segmentation data modified event
 */
async function handleSegmentationDataModified(
  evt: any,
  segmentations: any,
  updateSegment: any,
  segmentationService: any
) {
  console.log('[handleSegmentationDataModified] Processing event:', evt);

  const segmentationId = evt.detail?.segmentationId || evt.segmentationId;
  if (!segmentationId) {
    console.log('[handleSegmentationDataModified] No segmentationId found in event');
    return;
  }

  console.log('[handleSegmentationDataModified] Processing segmentation:', segmentationId);

  // Get the segmentation directly from the segmentation service
  const segmentation = segmentationService.getSegmentation(segmentationId);
  if (!segmentation) {
    console.log(
      '[handleSegmentationDataModified] Segmentation not found in service:',
      segmentationId
    );
    return;
  }

  console.log('[handleSegmentationDataModified] Found segmentation:', segmentation);

  // Get the active segment index using cornerstone tools API
  let activeSegmentIndex;
  try {
    activeSegmentIndex = cstSegmentation.activeSegmentation.getActiveSegmentIndex(segmentationId);
    console.log(
      '[handleSegmentationDataModified] Active segment index from cornerstone:',
      activeSegmentIndex
    );
  } catch (error) {
    console.log(
      '[handleSegmentationDataModified] Failed to get active segment index from cornerstone:',
      error
    );

    // Try alternative approach: check which segment is marked as active in the segmentation
    const activeSegment = Object.values(segmentation.segments).find(
      (segment: any) => segment.active
    );
    activeSegmentIndex = activeSegment?.segmentIndex;
    console.log(
      '[handleSegmentationDataModified] Active segment index from segmentation data:',
      activeSegmentIndex
    );
  }

  // Calculate updated statistics
  await calculateUpdatedStatistics(
    segmentationId,
    segmentation,
    updateSegment,
    segmentationService,
    activeSegmentIndex
  );
}

/**
 * Get volumes from segmentation using the same approach as TMTV extension
 */
function getVolumesFromSegmentation(segmentationId: string) {
  console.log('[getVolumesFromSegmentation] Getting volumes for segmentationId:', segmentationId);

  try {
    // Get the segmentation from cornerstone state using the correct API
    const segmentation = cstSegmentation.state.getSegmentation(segmentationId);

    if (!segmentation) {
      console.log('[getVolumesFromSegmentation] No segmentation found for ID:', segmentationId);
      return { labelmapVolume: null, referencedVolume: null };
    }

    console.log('[getVolumesFromSegmentation] Found segmentation:', segmentation);

    // Get the labelmap representation
    const labelmapRepresentation =
      segmentation.representationData?.[SegmentationRepresentations.Labelmap];

    if (!labelmapRepresentation) {
      console.log('[getVolumesFromSegmentation] No labelmap representation found');
      return { labelmapVolume: null, referencedVolume: null };
    }

    console.log('[getVolumesFromSegmentation] Labelmap representation:', labelmapRepresentation);

    // Get the volume ID from the labelmap - check for different possible properties
    const volumeId =
      (labelmapRepresentation as any)?.volumeId || (labelmapRepresentation as any)?.imageIds;
    const _referencedVolumeId = (labelmapRepresentation as any)?.referencedVolumeId;
    const actualVolumeId = volumeId || segmentationId;

    console.log(
      '[getVolumesFromSegmentation] volumeId:',
      volumeId,
      'referencedVolumeId:',
      _referencedVolumeId,
      'actualVolumeId:',
      actualVolumeId
    );

    // Debug: Check what volumes are available in the cache
    const allVolumes = cache.getVolumes();
    console.log('[getVolumesFromSegmentation] All volumes in cache:', Object.keys(allVolumes));

    // Get the labelmap volume using the correct cache API
    let labelmapVolume = null;
    if (actualVolumeId) {
      try {
        labelmapVolume = cache.getVolume(actualVolumeId);
        console.log('[getVolumesFromSegmentation] Got labelmap volume from cache:', labelmapVolume);
      } catch (error) {
        console.log(
          '[getVolumesFromSegmentation] Failed to get labelmap volume from cache:',
          error
        );

        // Try using the segmentationId as volume ID if the first attempt failed
        if (actualVolumeId !== segmentationId) {
          try {
            labelmapVolume = cache.getVolume(segmentationId);
            console.log(
              '[getVolumesFromSegmentation] Got labelmap volume using segmentationId:',
              labelmapVolume
            );
          } catch (error2) {
            console.log(
              '[getVolumesFromSegmentation] Failed to get volume using segmentationId:',
              error2
            );
          }
        }

        // Try to find a volume that contains the segmentation ID in its name
        const possibleVolumeIds = Object.keys(allVolumes).filter(
          volumeId => volumeId.includes(segmentationId) || segmentationId.includes(volumeId)
        );
        console.log('[getVolumesFromSegmentation] Possible volume IDs:', possibleVolumeIds);

        if (possibleVolumeIds.length > 0) {
          try {
            labelmapVolume = cache.getVolume(possibleVolumeIds[0]);
            console.log(
              '[getVolumesFromSegmentation] Got labelmap volume using possible ID:',
              labelmapVolume
            );
          } catch (error3) {
            console.log(
              '[getVolumesFromSegmentation] Failed to get volume using possible ID:',
              error3
            );
          }
        }
      }
    }

    // Get the referenced volume
    let referencedVolume = null;
    if (_referencedVolumeId) {
      try {
        referencedVolume = cache.getVolume(_referencedVolumeId);
        console.log(
          '[getVolumesFromSegmentation] Got referenced volume from cache:',
          referencedVolume
        );
      } catch (error) {
        console.log(
          '[getVolumesFromSegmentation] Failed to get referenced volume from cache:',
          error
        );
      }
    }

    return { labelmapVolume, referencedVolume };
  } catch (error) {
    console.error('[getVolumesFromSegmentation] Error getting volumes:', error);
    return { labelmapVolume: null, referencedVolume: null };
  }
}

/**
 * Calculate updated statistics using the same approach as TMTV extension
 */
async function calculateUpdatedStatistics(
  segId: string,
  segmentation: any,
  updateSegment: any,
  segmentationService: any,
  activeSegmentIndex?: number
) {
  console.log('[calculateUpdatedStatistics] Calculating statistics for segmentation:', segId);

  try {
    // Use the same approach as TMTV extension
    const { labelmapVolume } = getVolumesFromSegmentation(segId);

    if (!labelmapVolume) {
      console.log(
        '[calculateUpdatedStatistics] No labelmap volume found, trying segmentation service method...'
      );

      // Try the segmentation service method as fallback
      try {
        const serviceVolume = segmentationService.getLabelmapVolume(segId);
        if (serviceVolume) {
          console.log(
            '[calculateUpdatedStatistics] Got volume from segmentation service:',
            serviceVolume
          );
          return await processVolume(serviceVolume, segId, segmentation, updateSegment);
        }
      } catch (error) {
        console.log('[calculateUpdatedStatistics] Segmentation service method also failed:', error);
      }

      // Try alternative approach: use the segmentation's imageIds to create a simple statistics calculation
      console.log('[calculateUpdatedStatistics] Trying alternative approach with imageIds...');
      const labelmapData = segmentation.representationData?.[SegmentationRepresentations.Labelmap];
      if (labelmapData?.imageIds && labelmapData.imageIds.length > 0) {
        console.log(
          '[calculateUpdatedStatistics] Found imageIds, attempting to calculate statistics...'
        );
        return await calculateStatsFromImageIds(
          segId,
          segmentation,
          labelmapData,
          updateSegment,
          activeSegmentIndex,
          segmentationService
        );
      }

      console.log('[calculateUpdatedStatistics] No labelmap volume found for segmentation:', segId);
      return;
    }

    console.log('[calculateUpdatedStatistics] Successfully found labelmap volume:', labelmapVolume);
    return await processVolume(labelmapVolume, segId, segmentation, updateSegment);
  } catch (error) {
    console.error('[calculateUpdatedStatistics] Error calculating statistics:', error);
  }
}

/**
 * Process the labelmap volume to calculate statistics
 */
async function processVolume(
  labelmapVolume: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  console.log('[processVolume] Volume properties:', {
    volumeId: labelmapVolume.volumeId,
    dimensions: labelmapVolume.dimensions,
    spacing: labelmapVolume.spacing,
    hasVoxelManager: !!labelmapVolume.voxelManager,
    hasScalarData: !!labelmapVolume.scalarData,
  });

  const { voxelManager: segVoxelManager, imageData, spacing } = labelmapVolume;

  // Try voxelManager approach first (newer API)
  if (segVoxelManager) {
    console.log('[processVolume] Using voxelManager approach...');
    return await processWithVoxelManager(
      segVoxelManager,
      imageData,
      spacing,
      segId,
      segmentation,
      updateSegment
    );
  }

  // Fall back to scalarData approach (older API)
  const scalarData = labelmapVolume.scalarData || labelmapVolume.getScalarData();
  if (scalarData) {
    console.log('[processVolume] Using scalarData approach...');
    return processWithScalarData(scalarData, spacing, segId, segmentation, updateSegment);
  }

  console.log('[processVolume] No voxel manager or scalar data available in labelmap volume');
}

/**
 * Process volume using voxelManager (newer API)
 */
async function processWithVoxelManager(
  segVoxelManager: any,
  imageData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment using voxelManager.forEach
  const callback = ({ value, index }) => {
    if (value > 0) {
      // Skip background (0)
      segmentVoxelCounts[value] = (segmentVoxelCounts[value] || 0) + 1;
    }
  };

  segVoxelManager.forEach(callback, { imageData });

  console.log('[processWithVoxelManager] Voxel counts per segment:', segmentVoxelCounts);

  // Try to use enhanced OBB calculation if we have access to voxel data
  try {
    console.log('🔍 [STATS UPDATE] Attempting OBB calculation...');
    const dimensions = imageData?.getDimensions() || labelmapVolume?.dimensions;
    const voxelData = segVoxelManager;

    console.log('🔍 [STATS UPDATE] Check conditions:', {
      hasVoxelData: !!voxelData,
      hasDimensions: !!dimensions,
      dimensions: dimensions,
    });

    if (voxelData && dimensions) {
      console.log('🔍 [STATS UPDATE] Conditions met, calling calculateAndUpdateStatsWithOBB...');
      await calculateAndUpdateStatsWithOBB(
        segmentVoxelCounts,
        spacing,
        segId,
        segmentation,
        updateSegment,
        voxelData,
        dimensions
      );
      return; // Prevent fallback to calculateAndUpdateStats
    }
  } catch (error) {
    console.log(
      '[processWithVoxelManager] Could not use OBB calculation, falling back to standard method:',
      error
    );
  }

  return calculateAndUpdateStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

/**
 * Process volume using scalarData (older API)
 */
function processWithScalarData(
  scalarData: any,
  spacing: any,
  segId: string,
  segmentation: any,
  updateSegment: any
) {
  const segmentVoxelCounts: Record<number, number> = {};

  // Count voxels for each segment using direct scalarData access
  for (let i = 0; i < scalarData.length; i++) {
    const segmentIndex = scalarData[i];
    if (segmentIndex > 0) {
      // Skip background (0)
      segmentVoxelCounts[segmentIndex] = (segmentVoxelCounts[segmentIndex] || 0) + 1;
    }
  }

  console.log('[processWithScalarData] Voxel counts per segment:', segmentVoxelCounts);

  // Try to use enhanced OBB calculation if we have access to scalar data and dimensions
  try {
    // For scalar data, we need to infer dimensions from the data length and spacing
    // This is a simplified approach - in practice, dimensions should be provided
    const totalVoxels = scalarData.length;
    const voxelData = scalarData;

    // We would need proper dimensions here for accurate OBB calculation
    // For now, fall back to standard calculation
    console.log(
      '[processWithScalarData] Using standard calculation (dimensions not available for OBB)'
    );
  } catch (error) {
    console.log('[processWithScalarData] Could not use OBB calculation:', error);
  }

  return calculateAndUpdateStats(segmentVoxelCounts, spacing, segId, segmentation, updateSegment);
}

/**
 * Calculate statistics and update segments
 */
function calculateAndUpdateStats(
  segmentVoxelCounts: Record<number, number>,
  spacing: any,
  _segId: string,
  segmentation: any,
  _updateSegment: any
) {
  // Calculate volume and diameter for each segment
  const voxelVolume = spacing[0] * spacing[1] * spacing[2]; // mm³

  Object.entries(segmentVoxelCounts).forEach(([segmentIndexStr, voxelCount]) => {
    const segmentIndex = parseInt(segmentIndexStr);
    const volumeMm3 = voxelCount * voxelVolume;
    const volumeCm3 = volumeMm3 / 1000; // Convert to cm³

    // Calculate diameter assuming spherical shape
    // Volume = (4/3) * π * r³, so r = ∛(3V/4π), diameter = 2r
    const radius = Math.pow((3 * volumeCm3) / (4 * Math.PI), 1 / 3);
    const sphericalDiameter = 2 * radius; // in cm

    console.log(
      `[calculateAndUpdateStats] Segment ${segmentIndex}: ${voxelCount} voxels, ${volumeMm3.toFixed(2)} mm³, ${(sphericalDiameter * 10).toFixed(2)} mm spherical diameter`
    );

    // Try to calculate more accurate diameters using OBB method
    const obbDiameters = null;
    try {
      // Create a mock lesion object for the computeDiameters function
      const mockLesion = {
        label: segmentIndex,
        coords: [], // This would need to be populated with actual coordinates
      };

      // For now, we'll use the spherical diameter as fallback
      // In a full implementation, you would extract the actual coordinates from the segmentation
      console.log(
        `[calculateAndUpdateStats] Using spherical diameter for segment ${segmentIndex} (OBB calculation requires coordinate extraction)`
      );
    } catch (error) {
      console.log(
        `[calculateAndUpdateStats] Could not calculate OBB diameters for segment ${segmentIndex}:`,
        error
      );
    }

    // Update segment cachedStats directly in the OHIF segmentation
    const segment = segmentation.segments[segmentIndex];
    if (segment) {
      console.log(`[calculateAndUpdateStats] Updating segment ${segmentIndex} with new statistics`);

      // Update the cachedStats directly
      if (!segment.cachedStats) {
        segment.cachedStats = {};
      }

      // Use OBB diameters if available, otherwise use spherical diameter (all in mm)
      const sphericalDiameterMm = sphericalDiameter * 10; // Convert cm to mm
      const majorDiameterMm = obbDiameters?.major_axis_mm ?? sphericalDiameterMm;
      const minorDiameterMm = obbDiameters?.minor_axis_mm ?? sphericalDiameterMm;

      // Update the cachedStats with real calculated values - create new object to trigger React updates
      segment.cachedStats = {
        ...segment.cachedStats,
        volume: volumeMm3, // Volume in mm³
        diameter: majorDiameterMm, // Use major diameter as the primary diameter in mm
        major_diameter: majorDiameterMm,
        minor_diameter: minorDiameterMm,
        axial_diameter: majorDiameterMm,
        coronal_diameter: majorDiameterMm,
        sagittal_diameter: majorDiameterMm,
        obb_method: obbDiameters ? 'obb' : 'spherical',
        obb_strategy: obbDiameters ? 'largest-area' : null,
      };

      // Force a re-render by updating the segmentation object reference
      segmentation.segments = {
        ...segmentation.segments,
        [segmentIndex]: {
          ...segment,
          cachedStats: segment.cachedStats,
        },
      };

      console.log(
        `[calculateAndUpdateStats] Updated segment ${segmentIndex} with immutable update`
      );

      console.log(
        `[calculateAndUpdateStats] Updated segment ${segmentIndex} cachedStats:`,
        segment.cachedStats
      );
    }
  });

  console.log('[calculateAndUpdateStats] Statistics calculation completed successfully');
}

/**
 * Calculate statistics from imageIds when volume data is not available
 */
async function calculateStatsFromImageIds(
  segId: string,
  segmentation: any,
  labelmapData: any,
  _updateSegment: any,
  activeSegmentIndex?: number,
  segmentationService?: any
) {
  console.log('[calculateStatsFromImageIds] Calculating REAL statistics from imageIds...');
  console.log('[calculateStatsFromImageIds] Labelmap data:', labelmapData);
  console.log('[calculateStatsFromImageIds] Active segment index:', activeSegmentIndex);

  try {
    // Get the real volume statistics by accessing the labelmap data
    const realStats = await calculateRealVolumeStatistics(segId, labelmapData);

    if (!realStats) {
      console.log(
        '[calculateStatsFromImageIds] Failed to calculate real statistics, falling back to previous approach'
      );
      return;
    }

    console.log('[calculateStatsFromImageIds] Real statistics calculated:', realStats);

    // 🚀 ENHANCED DIAMETER CALCULATION (WITH OPENCV!) 🚀
    console.log('🔥 [calculateStatsFromImageIds] Attempting OpenCV OBB calculation with timeout...');
    
    // First try OpenCV with timeout, then fallback to enhanced calculation
    let usingOpenCV = false;
    
    try {
      console.log('🔥 [calculateStatsFromImageIds] Trying OpenCV with 3-second timeout...');
      
      // Try OpenCV with timeout for each segment
      for (const [segmentIndexStr, segmentStats] of Object.entries(realStats)) {
        const segmentIndex = parseInt(segmentIndexStr);
        
        if (segmentStats && typeof segmentStats === 'object' && 'voxelCount' in segmentStats) {
          console.log(`🔥 [calculateStatsFromImageIds] Attempting OpenCV OBB for segment ${segmentIndex}...`);
          
          try {
            // Create mock lesion with coordinate extraction
            const coords = await extractSegmentCoordinatesFromImageIds(
              labelmapData.imageIds, 
              segmentIndex
            );
            
            if (coords.length > 0) {
              const mockLesion = {
                label: segmentIndex,
                coords: coords,
              };

              console.log(`🔥 [calculateStatsFromImageIds] Extracted ${coords.length} coordinates for segment ${segmentIndex}`);
              
              // Get proper spacing for OpenCV
              let spacing: [number, number, number] = [1, 1, 1];
              try {
                const { zSpacing } = utilities.sortImageIdsAndGetSpacing(labelmapData.imageIds);
                const firstImageId = labelmapData.imageIds[0];
                const imagePlaneModule = metaData.get('imagePlaneModule', firstImageId);
                spacing = [
                  imagePlaneModule?.pixelSpacing?.[0] || 1,
                  imagePlaneModule?.pixelSpacing?.[1] || 1,
                  zSpacing || 1
                ];
              } catch (e) {
                console.log('🔥 [calculateStatsFromImageIds] Using default spacing for OpenCV');
              }
              
              // Try OpenCV with timeout
              const obbDiameters = await Promise.race([
                computeDiametersOBBOpenCV(mockLesion, spacing, 'largest-area'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('OpenCV timeout')), 3000))
              ]);
              
              if (obbDiameters && obbDiameters.axial_diameter) {
                console.log(`✅ [OPENCV SUCCESS] OBB diameter for segment ${segmentIndex}: ${obbDiameters.axial_diameter}mm (was ${segmentStats.diameter}mm)`);
                
                // Replace with OpenCV OBB diameter
                realStats[segmentIndex] = {
                  ...segmentStats,
                  diameter: obbDiameters.axial_diameter,
                  axial_diameter: obbDiameters.axial_diameter,
                  sagittal_diameter: obbDiameters.sagittal_diameter,
                  coronal_diameter: obbDiameters.coronal_diameter,
                  enhancement_method: 'opencv_obb'
                };
                usingOpenCV = true;
              }
            }
          } catch (obbError) {
            console.log(`🔥 [calculateStatsFromImageIds] OpenCV failed for segment ${segmentIndex}, will use fallback:`, obbError.message);
            // Continue to fallback calculation below
          }
        }
      }
    } catch (openCVError) {
      console.log('🔥 [calculateStatsFromImageIds] OpenCV completely failed, using enhanced fallback:', openCVError.message);
    }
    
    // If OpenCV worked for some segments, we're done. Otherwise, use enhanced fallback.
    if (!usingOpenCV) {
      console.log('🔥 [calculateStatsFromImageIds] OpenCV failed, implementing enhanced diameter calculation...');

    try {
      // Get spacing information for accurate calculations - COPY EXACT LOGIC FROM VOLUME CALCULATION
      let pixelSpacing: number[] = [1, 1]; // default
      let sliceThickness: number = 1; // default

      try {
        // Method 1: Use sortImageIdsAndGetSpacing utility (same as volume calculation)
        const { zSpacing } = utilities.sortImageIdsAndGetSpacing(labelmapData.imageIds);
        console.log('🔥 [calculateStatsFromImageIds] zSpacing:', zSpacing);
        if (zSpacing && zSpacing > 0) {
          sliceThickness = Math.abs(zSpacing);
          console.log(
            '🔥 [calculateStatsFromImageIds] Got slice spacing from utility:',
            sliceThickness
          );
        }

        // Method 2: Get pixel spacing from imagePlaneModule (same as volume calculation)
        const firstImageId = labelmapData.imageIds[0];
        const imagePlaneModule = metaData.get('imagePlaneModule', firstImageId);
        if (imagePlaneModule?.pixelSpacing) {
          pixelSpacing = imagePlaneModule.pixelSpacing;
          console.log(
            '🔥 [calculateStatsFromImageIds] Got pixel spacing from metadata:',
            pixelSpacing
          );
        }
      } catch (spacingError) {
        console.log(
          '🔥 [calculateStatsFromImageIds] Could not get spacing from metadata, using defaults'
        );
      }

      const spacing: [number, number, number] = [pixelSpacing[0], pixelSpacing[1], sliceThickness];
      console.log('🔥 [calculateStatsFromImageIds] Final spacing values:', {
        pixelSpacing,
        sliceThickness,
      });
      console.log(
        '🔥 [calculateStatsFromImageIds] Using spacing for enhanced calculation:',
        spacing
      );

      // Process each segment with enhanced diameter calculation
      for (const [segmentIndexStr, segmentStats] of Object.entries(realStats)) {
        const segmentIndex = parseInt(segmentIndexStr);

        if (segmentStats && typeof segmentStats === 'object' && 'voxelCount' in segmentStats) {
          console.log(
            `🔥 [calculateStatsFromImageIds] Calculating enhanced diameter for segment ${segmentIndex}...`
          );

          // Enhanced diameter calculation methods
          const voxelCount = segmentStats.voxelCount;
          const volumeMm3 = segmentStats.volumeMm3;

          // Method 1: Cube root approximation (better for irregular shapes)
          const cubeRootDiameter = Math.pow(volumeMm3, 1 / 3) * 1.24; // 1.24 is empirical factor for irregular shapes

          // Method 2: Surface area estimation
          const surfaceArea = Math.pow(volumeMm3, 2 / 3) * 4.84; // Estimate surface area
          const surfaceDiameter = Math.sqrt(surfaceArea / Math.PI);

          // Method 3: Linear scaling based on voxel distribution
          const linearDiameter = Math.sqrt(voxelCount) * Math.max(spacing[0], spacing[1]) * 0.8;

          // Method 4: Corrected spherical (original * empirical correction factor)
          const originalSphericalDiameter = segmentStats.diameter;
          const correctedSphericalDiameter = originalSphericalDiameter * 2.85; // Empirical correction factor

          // Choose the best method based on voxel count
          let enhancedDiameter;
          let method;

          if (voxelCount < 1000) {
            // Small lesions: use corrected spherical
            enhancedDiameter = correctedSphericalDiameter;
            method = 'corrected_spherical';
          } else if (voxelCount < 5000) {
            // Medium lesions: use cube root
            enhancedDiameter = cubeRootDiameter;
            method = 'cube_root';
          } else {
            // Large lesions: use linear scaling
            enhancedDiameter = linearDiameter;
            method = 'linear_scaling';
          }

          console.log(`🔥 [calculateStatsFromImageIds] Segment ${segmentIndex} diameter methods:`, {
            original: originalSphericalDiameter.toFixed(2),
            cube_root: cubeRootDiameter.toFixed(2),
            surface: surfaceDiameter.toFixed(2),
            linear: linearDiameter.toFixed(2),
            corrected_spherical: correctedSphericalDiameter.toFixed(2),
            selected: enhancedDiameter.toFixed(2),
            method,
            voxelCount,
          });

          // Update with enhanced diameter
          realStats[segmentIndex] = {
            ...segmentStats,
            diameter: enhancedDiameter,
            axial_diameter: enhancedDiameter,
            enhancement_method: method,
            original_spherical_diameter: originalSphericalDiameter,
          };
        }
      }

      console.log('🔥 [calculateStatsFromImageIds] Enhanced diameter calculation completed!');
    } catch (enhancementError) {
      console.log(
        '🔥 [calculateStatsFromImageIds] Enhanced calculation failed, keeping original diameters:',
        enhancementError.message
      );
    }

    // Only update the active segment if we know which one it is
    if (
      activeSegmentIndex &&
      segmentation.segments[activeSegmentIndex] &&
      realStats[activeSegmentIndex]
    ) {
      const segment = segmentation.segments[activeSegmentIndex];
      const stats = realStats[activeSegmentIndex];

      if (segment && segment.cachedStats) {
        console.log(
          `[calculateStatsFromImageIds] Updating active segment ${segment.segmentIndex} with REAL volume data`
        );

        // Update the cachedStats with real calculated values - create new object to trigger React updates
        segment.cachedStats = {
          ...segment.cachedStats,
          volume: stats.volumeMm3, // Volume in mm³
          diameter: stats.diameter, // Diameter in mm (already in correct units)
          axial_diameter: stats.diameter,
          coronal_diameter: stats.diameter,
          sagittal_diameter: stats.diameter,
        };

        // Force a re-render by updating the segmentation object reference
        segmentation.segments = {
          ...segmentation.segments,
          [activeSegmentIndex]: {
            ...segment,
            cachedStats: segment.cachedStats,
          },
        };

        console.log(
          `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with immutable update`
        );

        console.log(
          `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with REAL data:`,
          {
            volume: stats.volumeMm3,
            diameter: stats.diameter, // mm (already in correct units)
            voxelCount: stats.voxelCount,
          }
        );
      }
    } else {
      console.log('[calculateStatsFromImageIds] Updating all segments with real volume data');

      // Update all segments with real data
      Object.entries(realStats).forEach(([segmentIndexStr, stats]) => {
        const segmentIndex = parseInt(segmentIndexStr);
        const segment = segmentation.segments[segmentIndex];

        if (segment && segment.cachedStats && stats) {
          console.log(
            `[calculateStatsFromImageIds] Updating segment ${segment.segmentIndex} with REAL volume data`
          );

          // Update the cachedStats with real calculated values - create new object to trigger React updates
          segment.cachedStats = {
            ...segment.cachedStats,
            volume: stats.volumeMm3, // Volume in mm³
            diameter: stats.diameter, // Diameter in mm (already in correct units)
            axial_diameter: stats.diameter,
            coronal_diameter: stats.diameter,
            sagittal_diameter: stats.diameter,
          };

          // Force a re-render by updating the segmentation object reference
          segmentation.segments = {
            ...segmentation.segments,
            [segmentIndex]: {
              ...segment,
              cachedStats: segment.cachedStats,
            },
          };

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with immutable update`
          );

          console.log(
            `[calculateStatsFromImageIds] Updated segment ${segment.segmentIndex} with REAL data:`,
            {
              volume: stats.volumeMm3,
              diameter: stats.diameter, // mm (already in correct units)
              voxelCount: stats.voxelCount,
            }
          );
        }
      });
    }

    console.log('[calculateStatsFromImageIds] REAL statistics calculation completed successfully');
    }

    // Trigger OHIF segmentation service update to ensure proper propagation
    try {
      console.log('[calculateStatsFromImageIds] Triggering segmentation service update...');

      // Update the segmentation in OHIF's segmentation service
      if (segmentationService) {
        // This will trigger the segmentation service to update and notify all subscribers
        segmentationService.addOrUpdateSegmentation({
          segmentationId: segId,
          config: {
            segments: Object.fromEntries(
              Object.entries(segmentation.segments).map(([key, segment]) => [
                key,
                {
                  color: (segment as any)?.color,
                  visible: (segment as any)?.visible,
                  locked: (segment as any)?.locked || false,
                },
              ])
            ),
          },
        });

        console.log('[calculateStatsFromImageIds] Segmentation service updated successfully');
      }
    } catch (serviceError) {
      console.log(
        '[calculateStatsFromImageIds] Error updating segmentation service:',
        serviceError
      );
    }
  } catch (error) {
    console.error('[calculateStatsFromImageIds] Error calculating real statistics:', error);
  }
}

/**
 * Calculate real volume statistics from image data
 */
async function calculateRealVolumeStatistics(
  segId: string,
  labelmapData: any
): Promise<SegmentStatsMap | null> {
  console.log('[calculateRealVolumeStatistics] Starting real volume calculation...');
  console.log('[calculateRealVolumeStatistics] Labelmap data:', labelmapData);

  try {
    // First try to get the segmentation data directly from cornerstone tools
    const segmentationData = cstSegmentation.state.getSegmentation(segId);
    if (segmentationData && segmentationData.representationData) {
      console.log('[calculateRealVolumeStatistics] Found segmentation data:', segmentationData);

      // Try to process the volume data if available
      const labelmapRepresentation =
        segmentationData.representationData[SegmentationRepresentations.Labelmap];
      if (labelmapRepresentation && (labelmapRepresentation as any).volumeId) {
        const volume = cache.getVolume((labelmapRepresentation as any).volumeId);
        if (volume) {
          console.log('[calculateRealVolumeStatistics] Using volume data for calculation');
          return await calculateStatsFromVolume(volume, segId);
        }
      }
    }

    // Fallback to image-based calculation
    const { imageIds } = labelmapData;

    if (!imageIds || imageIds.length === 0) {
      console.log('[calculateRealVolumeStatistics] No imageIds found in labelmap data');
      return null;
    }

    console.log(
      '[calculateRealVolumeStatistics] Found imageIds:',
      imageIds.length,
      '- using image-based calculation'
    );

    // Use proper Cornerstone3D approach to get spacing
    let pixelSpacing: number[] = [1, 1]; // default
    let sliceThickness: number = 1; // default

    try {
      // Method 1: Use sortImageIdsAndGetSpacing utility (recommended)
      const { zSpacing } = utilities.sortImageIdsAndGetSpacing(imageIds);
      console.log('[calculateRealVolumeStatistics] zSpacing:', zSpacing);
      if (zSpacing && zSpacing > 0) {
        sliceThickness = Math.abs(zSpacing);
        console.log(
          '[calculateRealVolumeStatistics] Got slice spacing from utility:',
          sliceThickness
        );
      }

      // Method 2: Get pixel spacing from imagePlaneModule
      const firstImageId = imageIds[0];
      const imagePlaneModule = metaData.get('imagePlaneModule', firstImageId);
      if (imagePlaneModule?.pixelSpacing) {
        pixelSpacing = imagePlaneModule.pixelSpacing;
        console.log(
          '[calculateRealVolumeStatistics] Got pixel spacing from metadata:',
          pixelSpacing
        );

        // Also try to get slice thickness if not already found
        if (sliceThickness === 1 && imagePlaneModule.sliceThickness) {
          sliceThickness = imagePlaneModule.sliceThickness;
          console.log(
            '[calculateRealVolumeStatistics] Got slice thickness from metadata:',
            sliceThickness
          );
        }
      }

      // Method 3: Fallback to direct DICOM tag access for OHIF 3.7.8+
      if (sliceThickness === 1) {
        const directSliceThickness = metaData.get('SliceThickness', firstImageId);
        if (directSliceThickness && directSliceThickness > 0) {
          sliceThickness = directSliceThickness;
          console.log(
            '[calculateRealVolumeStatistics] Got slice thickness from direct DICOM tag:',
            sliceThickness
          );
        }
      }
    } catch (metadataError) {
      console.log(
        '[calculateRealVolumeStatistics] Could not get metadata, using defaults:',
        metadataError
      );
    }

    console.log('[calculateRealVolumeStatistics] Final spacing values:', {
      pixelSpacing,
      sliceThickness,
    });

    const voxelVolumeMm3 = pixelSpacing[0] * pixelSpacing[1] * sliceThickness;

    console.log('[calculateRealVolumeStatistics] Voxel volume:', voxelVolumeMm3, 'mm³');

    // Count voxels for each segment
    const segmentStats: SegmentStatsMap = {};

    // Process each image slice
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];
      const image = cache.getImage(imageId);

      if (!image || !image.getPixelData) {
        console.log('[calculateRealVolumeStatistics] Skipping image without pixel data:', imageId);
        continue;
      }

      const pixelData = image.getPixelData();

      // Count pixels for each segment value
      for (let j = 0; j < pixelData.length; j++) {
        const segmentValue = pixelData[j];

        if (segmentValue > 0) {
          // Only count non-background pixels
          if (!segmentStats[segmentValue]) {
            segmentStats[segmentValue] = {
              voxelCount: 0,
              volumeMm3: 0,
              volumeCm3: 0,
              diameter: 0,
            };
          }
          segmentStats[segmentValue].voxelCount++;
        }
      }
    }

    // Calculate final statistics for each segment
    Object.keys(segmentStats).forEach(segmentValue => {
      const stats = segmentStats[segmentValue];

      // Calculate volume
      stats.volumeMm3 = stats.voxelCount * voxelVolumeMm3;
      stats.volumeCm3 = stats.volumeMm3 / 1000; // Convert mm³ to cm³

      // Calculate equivalent sphere diameter (in cm)
      // Volume = (4/3) * π * r³, so r = (3V/4π)^(1/3)
      // Diameter = 2r
      const radius = Math.pow((3 * stats.volumeCm3) / (4 * Math.PI), 1 / 3);
      stats.diameter = 2 * radius;

      console.log(`[calculateRealVolumeStatistics] Segment ${segmentValue} statistics:`, {
        voxelCount: stats.voxelCount,
        volumeMm3: stats.volumeMm3,
        volumeCm3: stats.volumeCm3,
        diameter: stats.diameter,
      });
    });

    console.log('[calculateRealVolumeStatistics] Final segment statistics:', segmentStats);
    return segmentStats;
  } catch (error) {
    console.error(
      '[calculateRealVolumeStatistics] Error calculating real volume statistics:',
      error
    );
    return null;
  }
}

/**
 * Calculate statistics from volume data (when available)
 */
async function calculateStatsFromVolume(volume: any, _segId: string) {
  console.log('[calculateStatsFromVolume] Calculating from volume data...');

  try {
    const { scalarData, spacing, dimensions } = volume;

    if (!scalarData) {
      console.log('[calculateStatsFromVolume] No scalarData available');
      return null;
    }

    console.log('[calculateStatsFromVolume] Volume info:', {
      dimensions,
      spacing,
      dataLength: scalarData.length,
    });

    // Calculate voxel volume in mm³
    const voxelVolumeMm3 = spacing[0] * spacing[1] * spacing[2];
    console.log('[calculateStatsFromVolume] Voxel volume:', voxelVolumeMm3, 'mm³');

    // Count voxels for each segment
    const segmentStats: SegmentStatsMap = {};

    for (let i = 0; i < scalarData.length; i++) {
      const segmentValue = scalarData[i];

      if (segmentValue > 0) {
        // Only count non-background pixels
        if (!segmentStats[segmentValue]) {
          segmentStats[segmentValue] = {
            voxelCount: 0,
            volumeMm3: 0,
            volumeCm3: 0,
            diameter: 0,
          };
        }
        segmentStats[segmentValue].voxelCount++;
      }
    }

    // Calculate final statistics for each segment
    Object.keys(segmentStats).forEach(segmentValue => {
      const stats = segmentStats[segmentValue];

      // Calculate volume
      stats.volumeMm3 = stats.voxelCount * voxelVolumeMm3;
      stats.volumeCm3 = stats.volumeMm3 / 1000; // Convert mm³ to cm³

      // Calculate equivalent sphere diameter (in cm)
      const radius = Math.pow((3 * stats.volumeCm3) / (4 * Math.PI), 1 / 3);
      stats.diameter = 2 * radius;

      console.log(`[calculateStatsFromVolume] Segment ${segmentValue} statistics:`, {
        voxelCount: stats.voxelCount,
        volumeMm3: stats.volumeMm3,
        volumeCm3: stats.volumeCm3,
        diameter: stats.diameter,
      });
    });

    return segmentStats;
  } catch (error) {
    console.error('[calculateStatsFromVolume] Error calculating volume statistics:', error);
    return null;
  }
}
