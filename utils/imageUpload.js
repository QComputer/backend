import fs from 'fs/promises';
import path from 'path';

// Configure upload directory to use Liara disk
const UPLOAD_DIR = process.env.LIARA_DISK_PATH
  ? path.join(process.env.LIARA_DISK_PATH, 'uploads')
  : path.join(process.cwd(), 'uploads');

const uploadImageToDisk = async (fileBuffer, originalname, mimetype) => {
  console.log(`Uploading to Liara disk: ${UPLOAD_DIR}`);
  console.log(`File info: ${originalname}, ${mimetype}, buffer size: ${fileBuffer.length}`);

  try {
    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log('Upload directory ready:', UPLOAD_DIR);

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(originalname) || '.jpg';
    const filename = `${uniqueSuffix}${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Save file to disk
    await fs.writeFile(filePath, fileBuffer);
    console.log('File saved to disk:', filename);

    // Return the URL for accessing the image
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/uploads/${filename}`;
    
    console.log('Image upload successful:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('Liara disk upload error:', error);
    throw new Error(`Failed to upload to Liara disk: ${error.message}`);
  }
};

export { uploadImageToDisk };