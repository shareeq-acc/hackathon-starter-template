// MongoDB initialization script for development
// This script runs when the MongoDB container starts for the first time

print('Starting MongoDB initialization for development environment...');

// Switch to the application database
db = db.getSiblingDB('typescript-backend-api');

// Create application user with read/write permissions
db.createUser({
  user: 'dev_user',
  pwd: 'dev_password',
  roles: [
    {
      role: 'readWrite',
      db: 'typescript-backend-api'
    }
  ]
});

print('Created development user for typescript-backend-api database');

// Create test database and user
db = db.getSiblingDB('typescript-backend-api-test');

db.createUser({
  user: 'test_user',
  pwd: 'test_password',
  roles: [
    {
      role: 'readWrite',
      db: 'typescript-backend-api-test'
    }
  ]
});

print('Created test user for typescript-backend-api-test database');

// Switch back to main database for index creation
db = db.getSiblingDB('typescript-backend-api');

// Create indexes for better performance
print('Creating database indexes...');

// Users collection indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "googleId": 1 }, { sparse: true });
db.users.createIndex({ "createdAt": 1 });

print('Created users collection indexes');

// Refresh tokens collection indexes
db.refreshtokens.createIndex({ "token": 1 }, { unique: true });
db.refreshtokens.createIndex({ "userId": 1 });
db.refreshtokens.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

print('Created refresh tokens collection indexes');

// Quotes collection indexes
db.quotes.createIndex({ "createdAt": 1 });
db.quotes.createIndex({ "theme": 1 });
db.quotes.createIndex({ "source": 1 });

print('Created quotes collection indexes');

// Insert some sample data for development (optional)
print('Inserting sample development data...');

// Sample quotes for fallback
db.quotes.insertMany([
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    theme: "motivation",
    source: "fallback",
    createdAt: new Date()
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs",
    theme: "innovation",
    source: "fallback",
    createdAt: new Date()
  },
  {
    text: "Life is what happens to you while you're busy making other plans.",
    author: "John Lennon",
    theme: "life",
    source: "fallback",
    createdAt: new Date()
  }
]);

print('Sample quotes inserted successfully');

print('MongoDB development initialization completed successfully!');
print('');
print('Connection details:');
print('- Main Database: mongodb://admin:password123@localhost:27017/typescript-backend-api?authSource=admin');
print('- Test Database: mongodb://admin:password123@localhost:27017/typescript-backend-api-test?authSource=admin');
print('- Mongo Express: http://localhost:8081 (admin/admin123)');
print('');