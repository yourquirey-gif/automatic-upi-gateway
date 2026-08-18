import mongoose from 'mongoose';

/**
 * Remove unique indexes left behind by older Gmail verification schemas.
 * Older deployments used a gmailVerification collection with a unique
 * owner_1 index. The current schema stores Gmail connections per merchant,
 * so owner must never be unique.
 */
async function repairLegacyGmailIndexes() {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = ['gmailVerification', 'gmailVerifications', 'gmailConnections'];
  for (const name of collections) {
    try {
      const collection = db.collection(name);
      const indexes = await collection.listIndexes().toArray();
      for (const index of indexes) {
        const key = index?.key || {};
        const isOwnerOnly = Object.keys(key).length === 1 && key.owner === 1;
        if (isOwnerOnly && index.name) {
          try {
            await collection.dropIndex(index.name);
            console.log(`Removed legacy Gmail owner index: ${name}.${index.name}`);
          } catch (error) {
            if (!/index not found|ns not found|not found/i.test(String(error?.message || ''))) throw error;
          }
        }
      }
    } catch (error) {
      if (!/ns not found|namespace not found|does not exist/i.test(String(error?.message || ''))) {
        console.warn(`Legacy Gmail index check failed for ${name}:`, error.message);
      }
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
