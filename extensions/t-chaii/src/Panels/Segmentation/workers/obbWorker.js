// OBB Calculation Web Worker
// This worker performs OpenCV-based OBB diameter calculations without blocking the main UI thread

let cv = null;
let isLoadingOpenCV = false;

// Load OpenCV in the worker
const loadOpenCV = async () => {
  if (cv) return cv;
  
  if (isLoadingOpenCV) {
    while (isLoadingOpenCV && !cv) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cv;
  }

  isLoadingOpenCV = true;
  
  try {
    // List of CDN fallbacks
    const cdnUrls = [
      'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js',
      'https://unpkg.com/opencv.js@1.2.1/opencv.js',
      'https://cdnjs.cloudflare.com/ajax/libs/opencv.js/4.5.5/opencv.js'
    ];
    
    for (let i = 0; i < cdnUrls.length; i++) {
      const url = cdnUrls[i];
      console.log(`[OBB Worker] Trying CDN ${i + 1}/${cdnUrls.length}: ${url}`);
      
      try {
        // Import OpenCV script
        importScripts(url);
        
        // Wait for OpenCV to be initialized
        if (typeof cv !== 'undefined') {
          if (cv.Mat) {
            console.log('[OBB Worker] OpenCV runtime ready');
            isLoadingOpenCV = false;
            return cv;
          } else {
            await new Promise(resolve => {
              cv.onRuntimeInitialized = () => {
                console.log('[OBB Worker] OpenCV runtime initialized');
                resolve();
              };
            });
            isLoadingOpenCV = false;
            return cv;
          }
        }
      } catch (error) {
        console.log(`[OBB Worker] CDN ${i + 1} failed:`, error);
        continue;
      }
    }
    
    console.error('[OBB Worker] All CDN sources failed to load OpenCV');
    isLoadingOpenCV = false;
    return null;
    
  } catch (error) {
    console.error('[OBB Worker] Error loading OpenCV:', error);
    isLoadingOpenCV = false;
    return null;
  }
};

// OBB calculation function (matches the main thread implementation)
async function computeDiametersWithOpenCV(segmentVoxelData, segmentIndex, dimensions, spacing, cv) {
  try {
    console.log(`[OBB Worker] Starting OBB calculation for segment ${segmentIndex}`);
    
    const [width, height, depth] = dimensions;
    const [pixelSpacingX, pixelSpacingY, sliceThickness] = spacing;
    
    let maxMajorAxis = 0;
    let maxMinorAxis = 0;
    let maxMajorSlice = -1;
    
    // Process each slice (z-direction)
    for (let z = 0; z < depth; z++) {
      try {
        // Create slice mask
        const sliceMask = new cv.Mat(height, width, cv.CV_8UC1);
        const sliceOffset = z * width * height;
        
        // Fill slice data
        let hasPixels = false;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixelIndex = sliceOffset + y * width + x;
            const pixelValue = segmentVoxelData[pixelIndex];
            
            if (pixelValue === segmentIndex) {
              sliceMask.ucharPtr(y, x)[0] = 255;
              hasPixels = true;
            } else {
              sliceMask.ucharPtr(y, x)[0] = 0;
            }
          }
        }
        
        if (!hasPixels) {
          sliceMask.delete();
          continue;
        }
        
        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        
        cv.findContours(sliceMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        if (contours.size() === 0) {
          sliceMask.delete();
          contours.delete();
          hierarchy.delete();
          continue;
        }
        
        // Find largest contour by area ('largest-area' strategy)
        let largestContour = null;
        let largestArea = 0;
        
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);
          
          if (area > largestArea) {
            largestArea = area;
            if (largestContour) largestContour.delete();
            largestContour = contour.clone();
          }
        }
        
        if (largestContour && largestArea > 10) { // Minimum area threshold
          // Calculate oriented bounding box (OBB)
          const rotatedRect = cv.minAreaRect(largestContour);
          
          // Get width and height from the rotated rectangle
          const rectWidth = rotatedRect.size.width;
          const rectHeight = rotatedRect.size.height;
          
          // Convert to physical units (mm)
          const widthMm = rectWidth * pixelSpacingX;
          const heightMm = rectHeight * pixelSpacingY;
          
          // Major axis is the larger dimension, minor axis is the smaller
          const majorAxisMm = Math.max(widthMm, heightMm);
          const minorAxisMm = Math.min(widthMm, heightMm);
          
          // Track the slice with maximum major axis
          if (majorAxisMm > maxMajorAxis) {
            maxMajorAxis = majorAxisMm;
            maxMinorAxis = minorAxisMm;
            maxMajorSlice = z;
          }
        }
        
        // Cleanup
        if (largestContour) largestContour.delete();
        sliceMask.delete();
        contours.delete();
        hierarchy.delete();
        
      } catch (error) {
        console.error(`[OBB Worker] Error processing slice ${z}:`, error);
        continue;
      }
    }
    
    console.log(`[OBB Worker] OBB calculation completed for segment ${segmentIndex}: major=${maxMajorAxis.toFixed(2)}mm, minor=${maxMinorAxis.toFixed(2)}mm, slice=${maxMajorSlice}`);
    
    return {
      majorAxisMm: maxMajorAxis,
      minorAxisMm: maxMinorAxis,
      majorAxisSlice: maxMajorSlice
    };
    
  } catch (error) {
    console.error(`[OBB Worker] Error in OBB calculation:`, error);
    return null;
  }
}

// Worker message handler
self.onmessage = async function(e) {
  const { type, data, id } = e.data;
  
  try {
    if (type === 'CALCULATE_OBB') {
      const { segmentVoxelData, segmentIndex, dimensions, spacing } = data;
      
      console.log(`[OBB Worker] Received OBB calculation request for segment ${segmentIndex}`);
      
      // Load OpenCV if not already loaded
      const openCV = await loadOpenCV();
      
      if (!openCV) {
        self.postMessage({
          type: 'OBB_ERROR',
          id,
          error: 'Failed to load OpenCV'
        });
        return;
      }
      
      // Perform OBB calculation
      const result = await computeDiametersWithOpenCV(
        new Uint8Array(segmentVoxelData),
        segmentIndex,
        dimensions,
        spacing,
        openCV
      );
      
      if (result) {
        self.postMessage({
          type: 'OBB_RESULT',
          id,
          result
        });
      } else {
        self.postMessage({
          type: 'OBB_ERROR',
          id,
          error: 'OBB calculation failed'
        });
      }
      
    } else {
      self.postMessage({
        type: 'ERROR',
        id,
        error: `Unknown message type: ${type}`
      });
    }
    
  } catch (error) {
    console.error('[OBB Worker] Error handling message:', error);
    self.postMessage({
      type: 'OBB_ERROR',
      id,
      error: error.message
    });
  }
};

console.log('[OBB Worker] Worker initialized and ready');
