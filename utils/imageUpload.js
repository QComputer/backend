import axios from 'axios';
import FormData from "form-data";

const uploadImageToServer = async (fileBuffer, originalname, mimetype) => {
  const imageServerUrl = process.env.IMAGE_SERVER_URL || 'http://localhost:3001';

  console.log(`Uploading to image server: ${imageServerUrl}/upload`);
  console.log(`File info: ${originalname}, ${mimetype}, buffer size: ${fileBuffer.length}`);

  const imageFormData = new FormData();
  imageFormData.append('image', fileBuffer, {
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