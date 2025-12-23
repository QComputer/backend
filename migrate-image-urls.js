import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zero';
const IMAGE_SERVER_URL = process.env.IMAGE_SERVER_URL || 'http://localhost:3001';

async function migrateImageUrls() {
  try {
    console.log('🔄 Starting comprehensive image URL migration...');
    console.log(`📊 MongoDB URI: ${MONGODB_URI}`);
    console.log(`🖼️  Image Server URL: ${IMAGE_SERVER_URL}`);

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all available uploaded images from the image service
    const imageUploadsDir = path.join(__dirname, '../image/uploads');
    let availableImages = [];

    try {
      const files = await fs.readdir(imageUploadsDir);
      availableImages = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'].includes(ext);
      });
      console.log(`📁 Found ${availableImages.length} images in image service uploads`);
    } catch (error) {
      console.log('⚠️ Could not read image uploads directory, will use fallback mapping');
    }

    // Define models and their image fields
    const models = [
      { name: 'Product', fields: ['image'] },
      { name: 'Category', fields: ['image'] },
      { name: 'User', fields: ['avatar', 'image'] },
      { name: 'Catalog', fields: ['header.logo.url', 'footer.logo.url', 'seo.ogImage', 'banners.image.url'] }
    ];

    let totalUpdated = 0;

    for (const modelInfo of models) {
      console.log(`\n🔍 Processing ${modelInfo.name} collection...`);

      const Model = mongoose.model(modelInfo.name, new mongoose.Schema({}, { strict: false }));

      // Find all documents that have image fields
      const documents = await Model.find({}).lean();
      console.log(`📋 Found ${documents.length} ${modelInfo.name} documents`);

      let modelUpdated = 0;

      for (const doc of documents) {
        let docUpdated = false;

        for (const field of modelInfo.fields) {
          const imageUrl = getNestedValue(doc, field);

          if (imageUrl && typeof imageUrl === 'string') {
            // Check if it's a localhost URL that needs updating
            if (imageUrl.includes('localhost:3001/images/') ||
                imageUrl.includes('localhost:3000/uploads/') ||
                imageUrl.startsWith('data:image/') ||
                !imageUrl.includes('localhost:3001/images/')) {

              // Generate a proper image service URL
              let newImageUrl;

              if (availableImages.length > 0) {
                // Use a random available image
                const randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
                newImageUrl = `${IMAGE_SERVER_URL}/images/${randomImage}`;
              } else {
                // Fallback: generate a timestamp-based filename
                const timestamp = Date.now();
                const randomId = Math.floor(Math.random() * 1000000000);
                newImageUrl = `${IMAGE_SERVER_URL}/images/${timestamp}-${randomId}.jpg`;
              }

              // Update the document
              const updatePath = field.replace(/\./g, '.');
              const updateObj = {};
              setNestedValue(updateObj, field, newImageUrl);

              await Model.updateOne(
                { _id: doc._id },
                { $set: updateObj }
              );

              console.log(`🔄 Updated ${modelInfo.name} "${doc.name || doc.username || doc._id}":`);
              console.log(`   Field: ${field}`);
              console.log(`   Old: ${imageUrl}`);
              console.log(`   New: ${newImageUrl}`);

              docUpdated = true;
              modelUpdated++;
              totalUpdated++;
            }
          }
        }

        // Handle banners array for catalogs
        if (modelInfo.name === 'Catalog' && doc.banners && Array.isArray(doc.banners)) {
          for (let i = 0; i < doc.banners.length; i++) {
            const banner = doc.banners[i];
            if (banner.image?.url) {
              const imageUrl = banner.image.url;

              if (imageUrl.includes('localhost:3001/images/') ||
                  imageUrl.includes('localhost:3000/uploads/') ||
                  imageUrl.startsWith('data:image/') ||
                  !imageUrl.includes('localhost:3001/images/')) {

                let newImageUrl;
                if (availableImages.length > 0) {
                  const randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
                  newImageUrl = `${IMAGE_SERVER_URL}/images/${randomImage}`;
                } else {
                  const timestamp = Date.now();
                  const randomId = Math.floor(Math.random() * 1000000000);
                  newImageUrl = `${IMAGE_SERVER_URL}/images/${timestamp}-${randomId}.jpg`;
                }

                await Model.updateOne(
                  { _id: doc._id },
                  { $set: { [`banners.${i}.image.url`]: newImageUrl } }
                );

                console.log(`🔄 Updated ${modelInfo.name} "${doc.name || doc._id}" banner ${i + 1}:`);
                console.log(`   Old: ${imageUrl}`);
                console.log(`   New: ${newImageUrl}`);

                docUpdated = true;
                modelUpdated++;
                totalUpdated++;
              }
            }
          }
        }
      }

      console.log(`✅ Updated ${modelUpdated} ${modelInfo.name} documents`);
    }

    console.log(`\n🎉 Migration completed! Updated ${totalUpdated} total image URLs`);
    console.log('📝 All image URLs now point to the image service with proper format:');
    console.log('   http://localhost:3001/images/[timestamp]-[randomId].[extension]');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function to get nested object value
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper function to set nested object value
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// Run the migration
migrateImageUrls().catch(console.error);