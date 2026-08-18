import mongoose from 'mongoose';

async function repairLegacyGmailIndexes() {
  const db = mongoose.connection.db;
  if (!db) return;
  for (const name of ['gmailVerification', 'gmailVerifications', 'gmailConnections']) {
    try {
      const collection = db.collection(name);
      for (const index of await collection.listIndexes().toArray()) {
        const key = index?.key || {};
        if (Object.keys(key).length === 1 && key.owner === 1 && index.name) {
          try { await collection.dropIndex(index.name); console.log(`Removed legacy Gmail owner index: ${name}.${index.name}`); }
          catch (error) { if (!/index not found|ns not found|not found/i.test(String(error?.message || ''))) throw error; }
        }
      }
    } catch (error) {
      if (!/ns not found|namespace not found|does not exist/i.test(String(error?.message || ''))) console.warn(`Legacy Gmail index check failed for ${name}:`, error.message);
    }
  }
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(uri);
  await repairLegacyGmailIndexes();
  console.log('MongoDB connected');
}
