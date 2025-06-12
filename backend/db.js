// backend/db.js
// Centralized MongoDB client and connection logic

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI not set in environment variables');
}

const client = new MongoClient(uri); // Removed deprecated options

let db;

async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}

module.exports = {
  client,
  connectToDatabase,
  getDb,
};
