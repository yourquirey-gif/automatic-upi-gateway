import { ImapFlow } from 'imapflow';
import GmailConnection from '../models/GmailConnection.js';
import { decryptSecret } from '../utils/secretBox.js';
import { listMailboxes, verifyConnection } from './gmailImapPaymentVerifier.js';

const watchers = new Map();
const DEBOUNCE_MS = 1000;
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 60000;

async function findEventMailbox(client) {
  const boxes = await client.list();
  const allowed = await listMailboxes(client);
  const all = boxes.find(box => allowed.includes(box.path || box.name) && new Set(box.flags || []).has('\\All'));
  if (all?.path) return all.path;
  return allowed[0] || null;
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
  if (!watcher || watcher.verifyTimer || watcher.stopped) return;
  watcher.verifyTimer = setTimeout(async () => {
    watcher.verifyTimer = null;
    await runVerification(connectionId);
  }, DEBOUNCE_MS);
}

async function startWatcher(connection) {
  const key = String(connection._id);
  const existing = watchers.get(key);
  if (existing) return existing.connectPromise || null;

  const state = { client: null, verifyTimer: null, reconnectTimer: null, stopped: false, delay: RECONNECT_MIN_MS, connecting: false, connectPromise: null };
  watchers.set(key, state);

  const connect = async () => {
    if (state.stopped || state.connecting) return;
    state.connecting = true;
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
      const eventMailbox = await findEventMailbox(client);
      if (!eventMailbox) throw new Error('No allowed Gmail mailbox is available for IMAP IDLE.');
      const allowedCount = (await listMailboxes(client)).length;
      await client.mailboxOpen(eventMailbox, { readOnly: true });
      state.delay = RECONNECT_MIN_MS;
      console.log(`Gmail IDLE watcher ready for ${latest.email}: event mailbox ${eventMailbox}, ${allowedCount} allowed mailboxes scanned per event.`);
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
      state.connecting = false;
      if (state.client) {
        try { state.client.close(); } catch {}
        state.client = null;
      }
    }
  };

  state.connect = connect;
  state.connectPromise = connect();
  await state.connectPromise;
  state.connectPromise = null;
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
