// test-connection.js
// Run this to diagnose MongoDB connection issues
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

console.log('=================================');
console.log('MongoDB Connection Diagnostic Tool');
console.log('=================================\n');

// Check environment variables
console.log('1. Checking environment variables...');
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  console.log('\n💡 Solution: Add MONGODB_URI to your .env file');
  console.log('Example: MONGODB_URI=mongodb://localhost:27017/orms');
  process.exit(1);
}

// Mask password in URI for display
const maskedUri = process.env.MONGODB_URI.replace(
  /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
  'mongodb$1://$2:***@'
);
console.log('✅ MONGODB_URI found');
console.log(`   ${maskedUri}\n`);

// Attempt connection
const testConnection = async () => {
  try {
    console.log('2. Attempting to connect to MongoDB...');
    console.log('   Timeout: 5 seconds\n');

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB connected successfully!\n');

    // Display connection info
    console.log('3. Connection Information:');
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Port: ${mongoose.connection.port || 'N/A (using Atlas)'}`);
    console.log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)\n`);

    // Test a simple operation
    console.log('4. Testing database operations...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections`);
    if (collections.length > 0) {
      console.log('   Collections:', collections.map(c => c.name).join(', '));
    }
    console.log();

    // Success!
    console.log('=================================');
    console.log('✅ All checks passed!');
    console.log('=================================');
    console.log('Your MongoDB connection is working correctly.');
    console.log('You can now run your application.\n');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ MongoDB connection failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Name: ${error.name}\n`);

    // Provide specific guidance based on error
    console.log('💡 Troubleshooting Suggestions:\n');

    if (error.message.includes('authentication failed') || error.message.includes('auth')) {
      console.log('Authentication Issue:');
      console.log('• Check your username and password in MONGODB_URI');
      console.log('• Make sure the database user exists in MongoDB Atlas');
      console.log('• URL-encode special characters in password');
      console.log('  Example: p@ssw0rd! becomes p%40ssw0rd%21\n');

    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('DNS/Host Resolution Issue:');
      console.log('• Check the hostname in your MONGODB_URI');
      console.log('• Verify your cluster name in MongoDB Atlas');
      console.log('• Check your internet connection\n');

    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
      console.log('Connection Timeout Issue:');
      console.log('• Whitelist your IP address in MongoDB Atlas Network Access');
      console.log('  Go to: Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
      console.log('• Check if MongoDB service is running (for local):');
      console.log('  sudo systemctl status mongod');
      console.log('• Check firewall settings\n');

    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('Connection Refused Issue:');
      console.log('• MongoDB is not running. Start it with:');
      console.log('  sudo systemctl start mongod   (Linux)');
      console.log('  brew services start mongodb-community   (macOS)');
      console.log('• Check if port 27017 is correct\n');

    } else {
      console.log('General Connection Issue:');
      console.log('• Verify MongoDB is installed and running');
      console.log('• Check your MONGODB_URI format');
      console.log('• Try connecting with MongoDB Compass or mongosh');
      console.log('• Check MongoDB Atlas cluster is active (not paused)\n');
    }

    console.log('For local MongoDB:');
    console.log('   MONGODB_URI=mongodb://localhost:27017/orms\n');

    console.log('For MongoDB Atlas:');
    console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/orms\n');

    console.log('Need more help? Check the MongoDB Troubleshooting Guide.');
    console.log('=================================\n');

    await mongoose.connection.close();
    process.exit(1);
  }
};

testConnection();