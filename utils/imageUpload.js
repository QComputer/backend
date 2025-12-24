import axios from 'axios';
import FormData from "form-data";
import sharp from 'sharp';

const MAX_SIZE_BYTES = 512000; // 500KB

const uploadImageToServer = async (fileBuffer, originalname, mimetype) => {
  const imageServerUrl = process.env.IMAGE_SERVER_URL || 'http://localhost:3001';

  console.log(`Uploading to image server: ${imageServerUrl}/upload`);
  console.log(`File info: ${originalname}, ${mimetype}, buffer size: ${fileBuffer.length}`);

  let processedBuffer = fileBuffer;

  // Check if image is larger than 500KB and resize/compress if needed
  if (fileBuffer.length > MAX_SIZE_BYTES) {
    console.log(`Image size ${fileBuffer.length} bytes exceeds ${MAX_SIZE_BYTES} bytes, compressing...`);

    try {
      // Use sharp to compress the image
      processedBuffer = await sharp(fileBuffer)
        .jpeg({ quality: 80 }) // Compress to JPEG with 80% quality
        .toBuffer();

      // If still too large, reduce quality further
      if (processedBuffer.length > MAX_SIZE_BYTES) {
        processedBuffer = await sharp(fileBuffer)
          .jpeg({ quality: 60 })
          .toBuffer();
      }

      // If still too large, resize and compress
      if (processedBuffer.length > MAX_SIZE_BYTES) {
        const metadata = await sharp(fileBuffer).metadata();
        const scaleFactor = Math.sqrt(MAX_SIZE_BYTES / fileBuffer.length);
        const newWidth = Math.floor(metadata.width * scaleFactor);
        const newHeight = Math.floor(metadata.height * scaleFactor);

        processedBuffer = await sharp(fileBuffer)
          .resize(newWidth, newHeight, { withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
      }

      console.log(`Compressed image to ${processedBuffer.length} bytes`);
      mimetype = 'image/jpeg'; // Change mimetype to jpeg after compression
      originalname = originalname.replace(/\.[^.]+$/, '.jpg'); // Change extension
    } catch (error) {
      console.error('Error compressing image:', error);
      // If compression fails, use original buffer
      processedBuffer = fileBuffer;
    }
  }

  const imageFormData = new FormData();
  imageFormData.append('image', processedBuffer, {
    filename: originalname,
    contentType: mimetype,
  });

  console.log('FormData created with buffer');

  try {
    const imageResponse = await axios.post(`${imageServerUrl}/upload`, imageFormData, {
      headers: {
        ...imageFormData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('Image upload successful:', imageResponse.data.data);
    return imageResponse.data.data.url;
  } catch (error) {
    console.error(`Image server error (${error.response?.status}):`, error.response?.data || error.message);
    throw new Error(`Failed to upload to image-server: ${error.response?.data?.message || error.message}`);
  }
};

export { uploadImageToServer };