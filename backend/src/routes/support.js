import { Router } from 'express';
import SupportTicket from '../models/SupportTicket.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const cleanText = value => String(value || '').trim().slice(0, 5000);
const categories = ['payment','api','kyc','account','technical','other'];

router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.auth.sub }).select('ticketId subject category priority status messages lastMessageAt createdAt updatedAt').sort({ lastMessageAt: -1 });
    res.json({ status: true, tickets });
  } catch (error) { next(error); }
});

router.post('/tickets', async (req, res, next) => {
  try {
    const subject = cleanText(req.body.subject).slice(0, 160);
    const text = cleanText(req.body.message);
    if (!subject || !text) return res.status(400).json({ status: false, message: 'Subject and message are required' });
    const ticket = await SupportTicket.create({ user: req.auth.sub, subject, category: categories.includes(req.body.category) ? req.body.category : 'other', messages: [{ sender: 'user', text }] });
    res.status(201).json({ status: true, ticket });
  } catch (error) { next(error); }
});

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.auth.sub }).populate('user', 'userId name email mobile');
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

router.post('/tickets/:id/messages', async (req, res, next) => {
  try {
    const text = cleanText(req.body.message);
    if (!text) return res.status(400).json({ status: false, message: 'Message is required' });
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.auth.sub });
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ status: false, message: 'Ticket is closed' });
    ticket.messages.push({ sender: 'user', text }); ticket.status = 'open'; ticket.lastMessageAt = new Date(); await ticket.save();
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

const admin = Router();
admin.use(requireAuth, requireAdmin);

admin.get('/tickets', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.priority && req.query.priority !== 'all') filter.priority = req.query.priority;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    const tickets = await SupportTicket.find(filter).populate('user', 'userId name email mobile companyName').select('ticketId subject category priority status messages lastMessageAt createdAt updatedAt user').sort({ lastMessageAt: -1 });
    const counts = await SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ status: true, tickets, counts: Object.fromEntries(counts.map(x => [x._id, x.count])) });
  } catch (error) { next(error); }
});

admin.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('user', 'userId name email mobile companyName');
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

admin.post('/tickets/:id/messages', async (req, res, next) => {
  try {
    const text = cleanText(req.body.message);
    if (!text) return res.status(400).json({ status: false, message: 'Message is required' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ status: false, message: 'Ticket is closed' });
    ticket.messages.push({ sender: 'admin', text }); ticket.status = 'waiting_user'; ticket.lastMessageAt = new Date(); await ticket.save();
    res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

admin.patch('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    if (['pending','open','waiting_user','resolved','closed'].includes(req.body.status)) { ticket.status = req.body.status; if (req.body.status === 'resolved') ticket.resolvedAt = new Date(); if (req.body.status === 'closed') ticket.closedAt = new Date(); }
    if (['low','normal','high','urgent'].includes(req.body.priority)) ticket.priority = req.body.priority;
    if (categories.includes(req.body.category)) ticket.category = req.body.category;
    await ticket.save(); res.json({ status: true, ticket });
  } catch (error) { next(error); }
});

export { router as userSupportRoutes, admin as adminSupportRoutes };
