import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import Product from '../models/Product.js';
import FAQ from '../models/FAQ.js';

dotenv.config();

/**
 * Clean database and drop indexes
 * Run this if you're having seeding issues
 */
const cleanDatabase = async () => {
  try {
    await connectDB();

    console.log('🧹 Cleaning database...\n');

    // Delete all products
    const deletedProducts = await Product.deleteMany({});
    console.log(`✅ Deleted ${deletedProducts.deletedCount} products`);

    // Delete all FAQs
    const deletedFAQs = await FAQ.deleteMany({});
    console.log(`✅ Deleted ${deletedFAQs.deletedCount} FAQs`);

    // Drop product indexes
    try {
      await Product.collection.dropIndexes();
      console.log('✅ Dropped product indexes');
    } catch (error) {
      console.log('ℹ️  No product indexes to drop');
    }

    // Drop FAQ indexes
    try {
      await FAQ.collection.dropIndexes();
      console.log('✅ Dropped FAQ indexes');
    } catch (error) {
      console.log('ℹ️  No FAQ indexes to drop');
    }

    console.log('\n✨ Database cleaned successfully!');
    console.log('You can now run: npm run seed\n');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleaning failed:', error.message);
    process.exit(1);
  }
};

cleanDatabase();
