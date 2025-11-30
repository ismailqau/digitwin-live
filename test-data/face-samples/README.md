# Face Processing Test Data

This directory contains sample images for testing the face processing service.

## Requirements for Test Images

1. **Format**: JPEG or PNG
2. **Resolution**: Minimum 256x256 pixels
3. **Face Requirements**:
   - Clear, frontal face view
   - Good lighting (no harsh shadows)
   - Face should occupy at least 20% of the image
   - No extreme head rotation (< 30° yaw, < 25° pitch)

## Sample Images Needed

For comprehensive testing, add the following images:

- `sample-face.jpg` - Single frontal face, good quality
- `sample-face-2.jpg` - Same person, different angle
- `sample-face-3.jpg` - Same person, different lighting
- `multi-face.jpg` - Image with multiple faces
- `low-quality.jpg` - Blurry or poorly lit face
- `no-face.jpg` - Image without any faces
- `profile.jpg` - Side profile view

## Usage

```bash
# Run local tests
./scripts/test-face-processing-local.sh

# Run with custom test images
FACE_TEST_IMAGE=/path/to/image.jpg ./scripts/test-face-processing-local.sh
```

## Notes

- Test images should not contain PII
- Use stock photos or generated faces for testing
- Ensure images are properly licensed for testing purposes
