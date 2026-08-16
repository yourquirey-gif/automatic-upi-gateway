import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'admin'], required: true },
  text: { type: String, required: true, trim: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: ['payment', 'api', 'kyc', 'account', 'technical', 'other'], default: 'other', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
  status: { type: String, enum: ['pending', 'open', 'waiting_user', 'resolved', 'closed'], default: 'pending', index: true },
  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  resolvedAt: Date,
  closedAt: Date
}, { timestamps: true });

supportTicketSchema.pre('validate', async function(next) {
  if (!this.ticketId) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.model('SupportTicket', supportTicketSchema);
