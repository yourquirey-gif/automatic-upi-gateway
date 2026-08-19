import { ImapFlow } from 'imapflow';
import GmailConnection from '../models/GmailConnection.js';
import { decryptSecret } from '../utils/secretBox.js';
import { verifyConnection } from './gmailImapPaymentVerifier.js';

const watchers = new Map();
const DEBOUNCE_MS = 1000;
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 60000;

function isExcludedMailbox(box) {
  const path = String(box?.path || box?.name || '').toLowerCase();
  const flags = new Set(box?.flags || []);
  return flags.has('\\Trash') || flags.has('\\Junk') || path.includes('spam') || path.includes('trash');
}

async function findAllMailPath(client) {
  const boxes = await client.list();
  const all = boxes.find(box => !isExcludedMailbox(box) && new Set(box.flags || []).has('\\All'));
  if (all?.path) return all.path;
  const fallback = boxes.find(box => !isExcludedMailbox(box) && /all mail/i.test(String(box.path || box.name || '')));
  return fallback?.path || null;
}

async function runVerification(connectionId) {
  const connection = await GmailConnection.findById(connectionId).select('+appPasswordEncrypted');
  if (!connection?.active || !connection.appPasswordEncrypted) return;
  try {
    const result = await verifyConnection(connection);
    if (result.confirmed) console.log(`Gmail IDLE verification confirmed ${result.confirmed} payment(s) for ${connection.email}`);
  } catch (error) {
    console.error(`Gmail IDLE verification failed for ${connection.email}:`, error.message);
  }
}

function scheduleVerification(connectionId) {
  const watcher = watchers.get(String(connectionId));
  if (!watcher || watcher.verifyTimer) return;
  watcher.verifyTimer = setTimeout(async () => {
    watcher.verifyTimer = null;
    await runVerification(connectionId);
  }, DEBOUNCE_MS);
}

async function startWatcher(connection) {
  const key = String(connection._id);
  if (watchers.has(key)) return;

  const state = { client: null, verifyTimer: null, reconnectTimer: null, stopped: false, delay: RECONNECT_MIN_MS };
  watchers.set(key, state);

  const connect = async () => {
    if (state.stopped) return;
    try {
      const latest = await GmailConnection.findById(connection._id).select('+appPasswordEncrypted');
      if (!latest?.active || !latest.appPasswordEncrypted) {
        stopWatcher(key);
        return;
      }

      const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: latest.email, pass: decryptSecret(latest.appPasswordEncrypted) },
        logger: false,
        socketTimeout: 60000,
        disableAutoIdle: false
      });
      state.client = client;

      client.on('error', error => {
        console.error(`Gmail IDLE connection error for ${latest.email}:`, error.message);
      });
      client.on('close', () => {
        state.client = null;
        if (!state.stopped) scheduleReconnect(key);
      });
      client.on('exists', () => scheduleVerification(latest._id));

      await client.connect();
      const mailbox = await findAllMailPath(client);
      if (!mailbox) throw new Error('Gmail All Mail folder is unavailable.');
      await client.mailboxOpen(mailbox, { readOnly: true });
      state.delay = RECONNECT_MIN_MS;
      await runVerification(latest._id);

      while (!state.stopped && state.client === client && !client.closed) {
        await client.idle();
      }
    } catch (error) {
      if (!state.stopped) {
        console.error(`Gmail IDLE watcher failed for ${connection.email}:`, error.message);
        scheduleReconnect(key);
      }
    } finally {
      if (state.client) {
        try { state.client.close(); } catch {}
        state.client = null;
      }
    }
  };

  state.connect = connect;
  await connect();
}

function scheduleReconnect(key) {
  const state = watchers.get(key);
  if (!state || state.stopped || state.reconnectTimer) return;
  const delay = state.delay;
  state.delay = Math.min(state.delay * 2, RECONNECT_MAX_MS);
  state.reconnectTimer = setTimeout(async () => {
    state.reconnectTimer = null;
    await state.connect();
  }, delay);
}

function stopWatcher(key) {
  const state = watchers.get(key);
  if (!state) return;
  state.stopped = true;
  if (state.verifyTimer) clearTimeout(state.verifyTimer);
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  try { state.client?.close(); } catch {}
  watchers.delete(key);
}

export async function startGmailIdleWatchers() {
  const connections = await GmailConnection.find({ active: true }).select('+appPasswordEncrypted');
  const activeIds = new Set(connections.map(connection => String(connection._id)));
  for (const key of [...watchers.keys()]) if (!activeIds.has(key)) stopWatcher(key);
  for (const connection of connections) {
    if (!watchers.has(String(connection._id))) {
      startWatcher(connection).catch(error => console.error(`Failed to start Gmail watcher for ${connection.email}:`, error.message));
    }
  }
  return { watchers: watchers.size };
}

export function stopGmailIdleWatchers() {
  for (const key of [...watchers.keys()]) stopWatcher(key);
}
