import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 * Uses connection string from environment variables
 */
export const connectDB = async () => {
  try {
    // Optimized connection options for performance
    const options = {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Minimum number of connections
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 10000, // Timeout for server selection
      heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
      retryWrites: true, // Retry failed writes
      retryReads: true, // Retry failed reads
      compressors: ['zlib'], // Enable compression for network traffic
    };

    // If using MongoDB Atlas or remote connection, add SSL options
    if (process.env.MONGODB_URI.includes('mongodb+srv') || process.env.MONGODB_URI.includes('ssl=true')) {
      options.ssl = true;
      options.tls = true;
      options.tlsAllowInvalidCertificates = false;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    // Enable query result caching
    mongoose.set('strictQuery', false);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔧 Connection Pool: ${options.maxPoolSize} connections`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure MongoDB is running locally');
    console.error('   2. Check MONGODB_URI in .env file');
    console.error('   3. For local MongoDB, use: mongodb://localhost:27017/bismillah_spray_center');
    console.error('   4. For MongoDB Atlas, ensure IP is whitelisted and credentials are correct\n');
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 * Useful for testing and graceful shutdown
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  } catch (error) {
    console.error(`MongoDB Disconnect Error: ${error.message}`);
  }
};
