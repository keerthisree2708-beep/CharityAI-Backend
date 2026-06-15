const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`Failed to connect to local MongoDB. Starting in-memory database for testing...`);
    try {
      const mongoServer = await MongoMemoryServer.create();
      const memoryUri = mongoServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`In-Memory MongoDB Connected: ${conn.connection.host} (Data will be lost on restart)`);
    } catch (memError) {
      console.error(`In-Memory DB Error: ${memError.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
