import dotenv from 'dotenv';
dotenv.config();

// cloudinary must be imported AFTER dotenv.config()
import { v2 as cloudinary } from 'cloudinary';
import { connectDB, disconnectDB } from '../config/db.js';
import Product from '../models/Product.js';
import Gallery from '../models/Gallery.js';
import Brand from '../models/Brand.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const isBase64 = (str) => str && str.startsWith('data:image');

const uploadBase64ToCloudinary = async (base64, folder) => {
  const result = await cloudinary.uploader.upload(base64, { folder, resource_type: 'image' });
  return result.secure_url;
};

const migrateProducts = async () => {
  const products = await Product.find({});
  let updated = 0;

  for (const product of products) {
    let changed = false;

    if (isBase64(product.image)) {
      console.log(`⬆️  Uploading image for product: ${product.name}`);
      product.image = await uploadBase64ToCloudinary(product.image, 'bismillah-spray-center/products');
      changed = true;
    }

    if (product.images && product.images.length > 0) {
      const newImages = [];
      for (const img of product.images) {
        if (isBase64(img)) {
          newImages.push(await uploadBase64ToCloudinary(img, 'bismillah-spray-center/products'));
          changed = true;
        } else {
          newImages.push(img);
        }
      }
      product.images = newImages;
    }

    if (changed) {
      await product.save();
      updated++;
      console.log(`✅ Product updated: ${product.name}`);
    }
  }

  console.log(`\n📦 Products migrated: ${updated}/${products.length}`);
};

const migrateGallery = async () => {
  const images = await Gallery.find({});
  let updated = 0;

  for (const item of images) {
    if (isBase64(item.image)) {
      console.log(`⬆️  Uploading gallery image: ${item.title}`);
      item.image = await uploadBase64ToCloudinary(item.image, 'bismillah-spray-center/gallery');
      await item.save();
      updated++;
      console.log(`✅ Gallery updated: ${item.title}`);
    }
  }

  console.log(`\n🖼️  Gallery images migrated: ${updated}/${images.length}`);
};

const migrateBrands = async () => {
  const brands = await Brand.find({});
  let updated = 0;

  for (const brand of brands) {
    if (isBase64(brand.logo)) {
      console.log(`⬆️  Uploading logo for brand: ${brand.name}`);
      brand.logo = await uploadBase64ToCloudinary(brand.logo, 'bismillah-spray-center/brands');
      await brand.save();
      updated++;
      console.log(`✅ Brand updated: ${brand.name}`);
    }
  }

  console.log(`\n🏷️  Brands migrated: ${updated}/${brands.length}`);
};

const migrate = async () => {
  try {
    await connectDB();
    console.log('🚀 Starting migration...\n');

    await migrateProducts();
    await migrateGallery();
    await migrateBrands();

    console.log('\n✨ Migration completed successfully!');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message || error);
    process.exit(1);
  }
};

migrate();
