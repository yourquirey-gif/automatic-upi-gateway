import Counter from '../models/Counter.js';

const USER_ID_BASE = 1000000000;

export async function nextUserId() {
  const counter = await Counter.findOneAndUpdate(
    { key: 'merchant-user-id' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const numericId = USER_ID_BASE + Number(counter.seq);
  if (numericId > 1099999999) {
    throw new Error('User ID range exhausted');
  }
  return String(numericId);
}
