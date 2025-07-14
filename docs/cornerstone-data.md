# Accessing Slice Thickness in OHIF/Cornerstone3D: Complete Solution

Your attempts to access slice thickness are failing because **Cornerstone3D has fundamentally changed how metadata is accessed** compared to legacy Cornerstone. The methods you've tried are either deprecated or accessing the wrong metadata structure. Here's the complete solution with working code examples.

## The correct approach: sortImageIdsAndGetSpacing utility

The **primary method** for accessing slice thickness in Cornerstone3D is through the `sortImageIdsAndGetSpacing` utility function, which was enhanced in recent versions to handle both `sliceThickness` and `spacingBetweenSlices` metadata:

```javascript
import { utilities } from "@cornerstonejs/core";

// This is the correct way to get slice spacing in Cornerstone3D
const { sortedImageIds, zSpacing, origin } =
	utilities.sortImageIdsAndGetSpacing(imageIds);

console.log("Slice spacing (z-direction):", zSpacing);
console.log("Volume origin:", origin);
console.log("Properly sorted image IDs:", sortedImageIds);
```

## Updated metadata access patterns

For individual image metadata access, the API has changed significantly:

### Cornerstone3D (Current)

```javascript
import { metaData } from "@cornerstonejs/core";

// Access slice thickness from imagePlaneModule
const imagePlaneModule = metaData.get("imagePlaneModule", imageId);
if (imagePlaneModule) {
	const sliceThickness = imagePlaneModule.sliceThickness;
	const pixelSpacing = imagePlaneModule.pixelSpacing; // [row, column]
	const imagePositionPatient = imagePlaneModule.imagePositionPatient;
}

// For volume-based operations
const volume = cache.getVolume(volumeId);
if (volume) {
	const spacing = volume.spacing; // [x, y, z] spacing
	const sliceSpacing = spacing[2]; // Z-direction spacing
}
```

### OHIF 3.7.8+ Changes

OHIF versions 3.7.8+ introduced naturalized DICOM JSON metadata, changing how you access slice thickness:

```javascript
// New approach for OHIF 3.7.8+
const sliceThickness = cornerstone.metaData.get("SliceThickness", imageId);
const spacingBetweenSlices = cornerstone.metaData.get(
	"SpacingBetweenSlices",
	imageId,
);

// Or access full instance metadata
const instance = cornerstone.metaData.get("instance", imageId);
const sliceThickness = instance["00180050"]?.Value?.[0]; // DICOM tag (0018,0050)
```

## Why your attempts failed

Your five attempts failed for these specific reasons:

1. **`image.sliceThickness`** - This property doesn't exist on image objects in Cornerstone3D
2. **`metadata.sliceThickness`** - Wrong metadata structure; needs module-specific access
3. **`metadata.spacingBetweenSlices`** - Same issue, and this tag is often missing in DICOM files
4. **`cornerstone.metaData.get('imagePlaneModule', imageId)`** - Correct pattern but needs import from `@cornerstonejs/core`
5. **`cornerstone.metaData.get('pixelSpacingModule', imageId)`** - Wrong module name; should be `imagePlaneModule`

## Critical DICOM metadata distinction

Understanding the **difference between slice thickness and spacing** is crucial:

- **Slice Thickness (0018,0050)**: Physical thickness of tissue contributing to pixel values
- **Spacing Between Slices (0018,0088)**: Distance between slice centers
- **These are NOT the same**: 3mm thick slices can have 5mm spacing (gaps) or 1mm spacing (overlap)

## Robust implementation with fallback strategies

Here's a production-ready solution that handles missing metadata:

```javascript
class SliceThicknessResolver {
	constructor() {
		this.fallbackSpacing = 1.0; // Default 1mm spacing
	}

	getSliceSpacing(imageIds, options = {}) {
		const { useSliceThickness = true, fallbackToIPP = true } = options;

		try {
			// Method 1: Use Cornerstone3D utility (recommended)
			const { zSpacing } = utilities.sortImageIdsAndGetSpacing(imageIds);
			if (zSpacing && zSpacing > 0) {
				return zSpacing;
			}

			// Method 2: Try slice thickness from metadata
			if (useSliceThickness) {
				const sliceThickness = this.getSliceThickness(imageIds[0]);
				if (sliceThickness && sliceThickness > 0) {
					return sliceThickness;
				}
			}

			// Method 3: Calculate from ImagePositionPatient
			if (fallbackToIPP && imageIds.length >= 2) {
				return this.calculateFromImagePositions(imageIds);
			}

			// Method 4: Fallback to default
			console.warn("Using default slice spacing:", this.fallbackSpacing);
			return this.fallbackSpacing;
		} catch (error) {
			console.error("Slice spacing resolution failed:", error);
			return this.fallbackSpacing;
		}
	}

	getSliceThickness(imageId) {
		const imagePlaneModule = metaData.get("imagePlaneModule", imageId);

		if (imagePlaneModule?.sliceThickness) {
			return imagePlaneModule.sliceThickness;
		}

		// Fallback to direct DICOM tag access
		const instance = metaData.get("instance", imageId);
		return parseFloat(instance?.["00180050"]?.Value?.[0]) || null;
	}

	calculateFromImagePositions(imageIds) {
		const positions = [];
		const firstImagePlane = metaData.get("imagePlaneModule", imageIds[0]);

		if (!firstImagePlane?.imageOrientationPatient) {
			throw new Error("ImageOrientationPatient not available");
		}

		// Extract positions and calculate slice normal
		imageIds.forEach((imageId) => {
			const imagePlane = metaData.get("imagePlaneModule", imageId);
			if (imagePlane?.imagePositionPatient) {
				positions.push(imagePlane.imagePositionPatient);
			}
		});

		if (positions.length < 2) {
			throw new Error("Need at least 2 image positions");
		}

		// Calculate slice normal vector
		const orientation = firstImagePlane.imageOrientationPatient;
		const rowCosines = orientation.slice(0, 3);
		const colCosines = orientation.slice(3, 6);

		const sliceNormal = [
			rowCosines[1] * colCosines[2] - rowCosines[2] * colCosines[1],
			rowCosines[2] * colCosines[0] - rowCosines[0] * colCosines[2],
			rowCosines[0] * colCosines[1] - rowCosines[1] * colCosines[0],
		];

		// Calculate spacings between consecutive slices
		const spacings = [];
		for (let i = 1; i < positions.length; i++) {
			const diff = [
				positions[i][0] - positions[i - 1][0],
				positions[i][1] - positions[i - 1][1],
				positions[i][2] - positions[i - 1][2],
			];

			const spacing = Math.abs(
				diff[0] * sliceNormal[0] +
					diff[1] * sliceNormal[1] +
					diff[2] * sliceNormal[2],
			);
			spacings.push(spacing);
		}

		// Return median spacing for robustness
		spacings.sort((a, b) => a - b);
		return spacings[Math.floor(spacings.length / 2)];
	}
}
```

## Volume calculation with proper slice thickness

Here's how to calculate accurate volumes using the resolved slice thickness:

```javascript
function calculateAccurateVolume(imageIds, segmentationData) {
	const resolver = new SliceThicknessResolver();

	// Get slice spacing
	const sliceSpacing = resolver.getSliceSpacing(imageIds);

	// Get pixel spacing from first image
	const imagePlaneModule = metaData.get("imagePlaneModule", imageIds[0]);
	if (!imagePlaneModule?.pixelSpacing) {
		throw new Error("Pixel spacing not available");
	}

	const [rowSpacing, colSpacing] = imagePlaneModule.pixelSpacing;

	// Calculate voxel volume
	const voxelVolume = rowSpacing * colSpacing * sliceSpacing;

	// Count segmented voxels
	const segmentedVoxelCount = segmentationData.filter(
		(value) => value > 0,
	).length;

	return {
		totalVolume: segmentedVoxelCount * voxelVolume, // in mm³
		voxelVolume,
		segmentedVoxelCount,
		spacing: { rowSpacing, colSpacing, sliceSpacing },
	};
}
```

## Common pitfalls and solutions

### Pitfall 1: Version incompatibility

**Problem**: Using legacy Cornerstone patterns with Cornerstone3D
**Solution**: Update imports and use the new `metaData` from `@cornerstonejs/core`

### Pitfall 2: Missing slice thickness metadata

**Problem**: DICOM files without slice thickness tags
**Solution**: Always implement fallback to ImagePositionPatient calculation

### Pitfall 3: Negative spacing values

**Problem**: Nuclear medicine images with negative spacing
**Solution**: Handle negative values correctly (indicates slice stacking direction)

```javascript
// Handle negative spacing correctly
function handleNegativeSpacing(spacing) {
	if (spacing < 0) {
		console.warn("Negative spacing detected, using absolute value");
		return Math.abs(spacing);
	}
	return spacing;
}
```

### Pitfall 4: Large datasets causing memory issues

**Problem**: Processing thousands of slices causes out-of-memory errors
**Solution**: Process in chunks and implement proper memory management

## Essential initialization setup

Ensure proper initialization order for metadata access:

```javascript
import { init as cornerstoneInit, metaData } from "@cornerstonejs/core";
import { init as cornerstoneToolsInit } from "@cornerstonejs/tools";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";

async function initializeCornerstone() {
	await cornerstoneInit();
	await dicomImageLoaderInit({
		maxWebWorkers: Math.min(navigator.hardwareConcurrency || 1, 7),
		startWebWorkersOnDemand: false,
	});
	await cornerstoneToolsInit();
}
```

## Summary

The solution to your slice thickness access problem requires:

1. **Use `utilities.sortImageIdsAndGetSpacing(imageIds)`** as the primary method
2. **Import from `@cornerstonejs/core`** instead of global `cornerstone` object
3. **Implement fallback strategies** for missing metadata
4. **Calculate from ImagePositionPatient** when thickness isn't available
5. **Handle version differences** between OHIF 3.7.8+ and earlier versions

This approach will give you accurate slice thickness values instead of the default 1mm, enabling proper volume calculations in your medical imaging application.
