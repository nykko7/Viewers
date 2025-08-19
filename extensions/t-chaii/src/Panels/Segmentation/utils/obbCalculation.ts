/**
 * Pure JavaScript Oriented Bounding Box (OBB) calculation using rotating calipers algorithm
 * with 'largest-area' contour selection strategy for medical image segmentation diameter analysis.
 *
 * This implementation provides per-slice OBB analysis with slice identification for navigation.
 */

interface Point {
  x: number;
  y: number;
}

interface OBBResult {
  width: number;
  height: number;
  majorAxis: [Point, Point];
  minorAxis: [Point, Point];
  area: number;
}

interface SliceResult {
  slice: number;
  maxDiameter: number;
  minDiameter: number;
  majorAxis: [Point, Point];
  minorAxis: [Point, Point];
  contourArea: number;
}

interface OBBDiametersResult {
  maxDiameter: number;
  minDiameter: number;
  maxDiameterSlice: number;
  minDiameterSlice: number;
  overallMajorAxis: [Point, Point];
  overallMinorAxis: [Point, Point];
  overallMajorAxisPixels: [Point, Point]; // Pixel coordinates for measurement positioning
  overallMinorAxisPixels: [Point, Point]; // Pixel coordinates for measurement positioning
  sliceResults: SliceResult[];
}

/**
 * Calculate convex hull using Graham scan algorithm
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) {
    return points;
  }

  // Find the bottom-most point (and leftmost in case of tie)
  let bottom = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].y < points[bottom].y ||
      (points[i].y === points[bottom].y && points[i].x < points[bottom].x)
    ) {
      bottom = i;
    }
  }

  // Swap bottom point to first position
  [points[0], points[bottom]] = [points[bottom], points[0]];
  const pivot = points[0];

  // Sort points by polar angle with respect to pivot
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    if (angleA === angleB) {
      // If angles are equal, sort by distance
      const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2;
      const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2;
      return distA - distB;
    }
    return angleA - angleB;
  });

  const hull = [pivot, sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    // Remove points that make clockwise turn
    while (
      hull.length > 1 &&
      crossProduct(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0
    ) {
      hull.pop();
    }
    hull.push(sorted[i]);
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
 * Calculate polygon area using shoelace formula
 */
function polygonArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Calculate minimum area rectangle using rotating calipers algorithm
 */
function minAreaRect(hull: Point[]): OBBResult {
  if (hull.length < 3) {
    // Fallback for degenerate cases
    const p1 = hull[0] || { x: 0, y: 0 };
    const p2 = hull[1] || { x: 1, y: 0 };
    const dist = distance(p1, p2);
    return {
      width: dist,
      height: 0,
      majorAxis: [p1, p2],
      minorAxis: [p1, p1],
      area: 0,
    };
  }

  let minArea = Infinity;
  let bestRect: OBBResult = {
    width: 0,
    height: 0,
    majorAxis: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    minorAxis: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    area: 0,
  };

  // For each edge of the convex hull
  for (let i = 0; i < hull.length; i++) {
    const edge = {
      x: hull[(i + 1) % hull.length].x - hull[i].x,
      y: hull[(i + 1) % hull.length].y - hull[i].y,
    };

    // Normalize edge vector
    const edgeLength = Math.sqrt(edge.x ** 2 + edge.y ** 2);
    if (edgeLength === 0) {
      continue;
    }

    const unitEdge = { x: edge.x / edgeLength, y: edge.y / edgeLength };
    const perpEdge = { x: -unitEdge.y, y: unitEdge.x };

    // Project all points onto the edge and perpendicular
    let minProj = Infinity,
      maxProj = -Infinity;
    let minPerpProj = Infinity,
      maxPerpProj = -Infinity;

    for (const point of hull) {
      const proj = point.x * unitEdge.x + point.y * unitEdge.y;
      const perpProj = point.x * perpEdge.x + point.y * perpEdge.y;

      minProj = Math.min(minProj, proj);
      maxProj = Math.max(maxProj, proj);
      minPerpProj = Math.min(minPerpProj, perpProj);
      maxPerpProj = Math.max(maxPerpProj, perpProj);
    }

    const width = maxProj - minProj;
    const height = maxPerpProj - minPerpProj;
    const area = width * height;

    if (area < minArea) {
      minArea = area;

      // Calculate rectangle corners
      const corner1 = {
        x: minProj * unitEdge.x + minPerpProj * perpEdge.x,
        y: minProj * unitEdge.y + minPerpProj * perpEdge.y,
      };
      const corner2 = {
        x: maxProj * unitEdge.x + minPerpProj * perpEdge.x,
        y: maxProj * unitEdge.y + minPerpProj * perpEdge.y,
      };
      const corner3 = {
        x: maxProj * unitEdge.x + maxPerpProj * perpEdge.x,
        y: maxProj * unitEdge.y + maxPerpProj * perpEdge.y,
      };
      const corner4 = {
        x: minProj * unitEdge.x + maxPerpProj * perpEdge.x,
        y: minProj * unitEdge.y + maxPerpProj * perpEdge.y,
      };

      // Determine major and minor axes
      if (width >= height) {
        bestRect = {
          width,
          height,
          majorAxis: [corner1, corner2],
          minorAxis: [corner1, corner4],
          area,
        };
      } else {
        bestRect = {
          width: height,
          height: width,
          majorAxis: [corner1, corner4],
          minorAxis: [corner1, corner2],
          area,
        };
      }
    }
  }

  return bestRect;
}

/**
 * Trace contour from binary mask using Moore neighborhood tracing
 */
function traceContour(
  mask: Uint8Array,
  width: number,
  height: number,
  segmentIndex: number
): Point[][] {
  const contours: Point[][] = [];
  const visited = new Uint8Array(width * height);

  // Moore neighborhood (8-connected)
  const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
  const dy = [-1, 0, 1, -1, 1, -1, 0, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === segmentIndex && !visited[idx]) {
        // Start new contour
        const contour: Point[] = [];
        const stack: Point[] = [{ x, y }];

        while (stack.length > 0) {
          const current = stack.pop()!;
          const currentIdx = current.y * width + current.x;

          if (visited[currentIdx] || mask[currentIdx] !== segmentIndex) {
            continue;
          }

          visited[currentIdx] = 1;
          contour.push(current);

          // Add neighbors
          for (let i = 0; i < 8; i++) {
            const nx = current.x + dx[i];
            const ny = current.y + dy[i];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (mask[nIdx] === segmentIndex && !visited[nIdx]) {
                stack.push({ x: nx, y: ny });
              }
            }
          }
        }

        if (contour.length > 2) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Calculate OBB diameters for 3D segmentation data with 'largest-area' strategy
 */
export function calculateOBBDiameters(
  voxelData: Uint8Array,
  segmentIndex: number,
  dimensions: [number, number, number],
  spacing: [number, number, number]
): OBBDiametersResult {
  const [width, height, depth] = dimensions;
  const [xSpacing, ySpacing, zSpacing] = spacing;

  console.log(
    `[OBB] Starting OBB calculation for segment ${segmentIndex}, dimensions: ${width}x${height}x${depth}`
  );

  const sliceResults: SliceResult[] = [];
  let maxOverallDiameter = 0;
  let correspondingMinDiameter = 0; // Minor axis corresponding to major axis slice
  let maxDiameterSlice = -1;
  let overallMajorAxis: [Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  let overallMinorAxis: [Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  let overallMajorAxisPixels: [Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  let overallMinorAxisPixels: [Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  // Process each slice
  for (let z = depth - 1; z >= 0; z--) {
    try {
      // Extract slice data
      const sliceData = new Uint8Array(width * height);
      const sliceOffset = z * width * height;

      for (let i = 0; i < width * height; i++) {
        sliceData[i] = voxelData[sliceOffset + i];
      }

      // Check if slice has segment pixels
      let hasSegmentPixels = false;
      for (let i = 0; i < sliceData.length; i++) {
        if (sliceData[i] === segmentIndex) {
          hasSegmentPixels = true;
          break;
        }
      }

      if (!hasSegmentPixels) {
        continue;
      }

      // Trace contours in the slice
      const contours = traceContour(sliceData, width, height, segmentIndex);

      if (contours.length === 0) {
        continue;
      }

      // Apply 'largest-area' strategy: select contour with largest area
      let largestContour: Point[] = [];
      let maxArea = 0;

      for (const contour of contours) {
        const area = polygonArea(contour);
        if (area > maxArea) {
          maxArea = area;
          largestContour = contour;
        }
      }

      if (largestContour.length < 3) {
        continue;
      }

      // Calculate convex hull
      const hull = convexHull([...largestContour]);

      if (hull.length < 3) {
        continue;
      }

      // Calculate minimum area rectangle (OBB)
      const obb = minAreaRect(hull);

      // Keep original pixel coordinates for measurement positioning
      const majorAxisPixels: [Point, Point] = [
        { x: obb.majorAxis[0].x, y: obb.majorAxis[0].y },
        { x: obb.majorAxis[1].x, y: obb.majorAxis[1].y },
      ];

      const minorAxisPixels: [Point, Point] = [
        { x: obb.minorAxis[0].x, y: obb.minorAxis[0].y },
        { x: obb.minorAxis[1].x, y: obb.minorAxis[1].y },
      ];

      // Convert to world coordinates for distance calculation
      const majorAxisWorld: [Point, Point] = [
        { x: obb.majorAxis[0].x * xSpacing, y: obb.majorAxis[0].y * ySpacing },
        { x: obb.majorAxis[1].x * xSpacing, y: obb.majorAxis[1].y * ySpacing },
      ];

      const minorAxisWorld: [Point, Point] = [
        { x: obb.minorAxis[0].x * xSpacing, y: obb.minorAxis[0].y * ySpacing },
        { x: obb.minorAxis[1].x * xSpacing, y: obb.minorAxis[1].y * ySpacing },
      ];

      const maxDiameter = parseFloat(distance(majorAxisWorld[0], majorAxisWorld[1]).toFixed(2));
      const minDiameter = parseFloat(distance(minorAxisWorld[0], minorAxisWorld[1]).toFixed(2));

      // Store slice result
      const sliceResult: SliceResult = {
        slice: z,
        maxDiameter,
        minDiameter,
        majorAxis: majorAxisWorld,
        minorAxis: minorAxisWorld,
        contourArea: maxArea,
      };

      sliceResults.push(sliceResult);

      // Update overall max tracking and corresponding minor axis
      if (maxDiameter > maxOverallDiameter) {
        maxOverallDiameter = maxDiameter;
        correspondingMinDiameter = minDiameter; // Minor axis from the same slice as major axis
        maxDiameterSlice = z;
        overallMajorAxis = majorAxisWorld;
        overallMinorAxis = minorAxisWorld; // Minor axis from the same slice
        overallMajorAxisPixels = majorAxisPixels; // Store pixel coordinates
        overallMinorAxisPixels = minorAxisPixels; // Store pixel coordinates from same slice
      }

      console.log(
        `[OBB] Slice ${z}: max=${maxDiameter}mm, min=${minDiameter}mm, area=${maxArea}px²`
      );
    } catch (error) {
      console.warn(`[OBB] Error processing slice ${z}:`, error);
    }
  }

  console.log(`[OBB] Completed OBB calculation: ${sliceResults.length} slices processed`);
  console.log(`[OBB] Overall max diameter: ${maxOverallDiameter}mm (slice ${maxDiameterSlice})`);
  console.log(
    `[OBB] Corresponding min diameter: ${correspondingMinDiameter}mm (same slice ${maxDiameterSlice})`
  );

  return {
    maxDiameter: maxOverallDiameter,
    minDiameter: correspondingMinDiameter > 0 ? correspondingMinDiameter : maxOverallDiameter,
    maxDiameterSlice,
    minDiameterSlice: maxDiameterSlice, // Same slice as max diameter
    overallMajorAxis,
    overallMinorAxis,
    overallMajorAxisPixels, // Add pixel coordinates for measurement positioning
    overallMinorAxisPixels, // Add pixel coordinates for measurement positioning
    sliceResults,
  };
}
