import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  seq: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Counter', counterSchema);
