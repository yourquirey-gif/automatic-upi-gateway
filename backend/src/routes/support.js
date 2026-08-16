import { Router } from 'express';
import SupportTicket from '../models/SupportTicket.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const cleanText = value => String(value || '').trim().slice(0, 5000);
const categories = ['payment','api','kyc','account','technical','other'];
const statuses = ['pending','open','waiting_user','resolved','closed'];
const priorities = ['low','normal','high','urgent'];

router.get('/tickets', async (req, res, next) => {
  try {
    if (req.auth.role === 'admin') {
      const filter = {};
      if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
      if (req.query.priority && req.query.priority !== 'all') filter.priority = req.query.priority;
      if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
      const tickets = await SupportTicket.find(filter).populate('user', 'userId name email mobile companyName').select('ticketId subject category priority status messages lastMessageAt createdAt updatedAt user').sort({ lastMessageAt: -1 });
      const counts = await SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      return res.json({ status: true, tickets, counts: Object.fromEntries(counts.map(x => [x._id, x.count])) });
    }
    const tickets = await SupportTicket.find({ user: req.auth.sub }).select('ticketId subject category priority status messages lastMessageAt createdAt updatedAt').sort({ lastMessageAt: -1 });
    res.json({ status: true, tickets });
  } catch (error) { next(error); }
});

router.post('/tickets', async (req, res, next) => {
  try {
    if (req.auth.role === 'admin') return res.status(403).json({ status: false, message: 'Administrators cannot create merchant tickets' });
    const subject = cleanText(req.body.subject).slice(0, 160);
    const text = cleanText(req.body.message);
    if (!subject || !text) return res.status(400).json({ status: false, message: 'Subject and message are required' });
    const ticket = await SupportTicket.create({ user: req.auth.sub, subject, category: categories.includes(req.body.category) ? req.body.category : 'other', priority: priorities.includes(req.body.priority) ? req.body.priority : 'normal', status: 'pending', messages: [{ sender: 'user', text }], lastMessageAt: new Date() });
    res.status(201).json({ status: true, ticket });
  } catch (error) { next(error); }
});

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const query = req.auth.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.auth.sub };
    const ticket = await SupportTicket.findOne(query).populate('user', 'userId name email mobile companyName');
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

router.post('/tickets/:id/messages', async (req, res, next) => {
  try {
    const text = cleanText(req.body.message);
    if (!text) return res.status(400).json({ status: false, message: 'Message is required' });
    const query = req.auth.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.auth.sub };
    const ticket = await SupportTicket.findOne(query);
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ status: false, message: 'Ticket is closed' });
    ticket.messages.push({ sender: req.auth.role === 'admin' ? 'admin' : 'user', text });
    ticket.status = req.auth.role === 'admin' ? 'waiting_user' : 'open';
    ticket.lastMessageAt = new Date();
    await ticket.save();
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

router.patch('/tickets/:id', requireAdmin, async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    if (statuses.includes(req.body.status)) {
      ticket.status = req.body.status;
      if (req.body.status === 'resolved') ticket.resolvedAt = new Date();
      if (req.body.status === 'closed') ticket.closedAt = new Date();
    }
    if (priorities.includes(req.body.priority)) ticket.priority = req.body.priority;
    if (categories.includes(req.body.category)) ticket.category = req.body.category;
    await ticket.save();
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

export default router;
