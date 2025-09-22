// electron/discordPresence.ts
// Lightweight wrapper around discord-rpc to manage a single client and set activity
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let RPC: any;
try {
  // discord-rpc is CommonJS
  RPC = require('discord-rpc');
} catch (e) {
  // Package may not be installed – guard everything
  console.warn('[discordPresence] discord-rpc not available, presence disabled');
}

type PresenceMode = 'browsing' | 'reading';

interface ReadingInfo {
  title: string;
  author?: string;
}

interface PresenceState {
  enabled: boolean;
  clientId?: string;
  mode: PresenceMode;
  reading?: ReadingInfo;
}

let client: any = null;
let connected = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let startTimestamp: number | null = null;
let lastState: PresenceState = { enabled: false, mode: 'browsing' };

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function connect(clientId: string) {
  if (!RPC) return;
  if (client && connected) return;
  try {
    if (!client) {
      client = new RPC.Client({ transport: 'ipc' });
      client.on('ready', () => {
        connected = true;
        console.log('[discordPresence] Connected to Discord RPC');
        // Apply last known state upon connection
        if (lastState.enabled) {
          updateActivity(lastState);
        }
      });
      client.on('disconnected', () => {
        connected = false;
        console.warn('[discordPresence] Disconnected from Discord RPC');
        scheduleReconnect();
      });
      client.on('error', (err: any) => {
        console.warn('[discordPresence] RPC error', err?.message || err);
      });
    }
    await client.login({ clientId });
  } catch (e) {
    connected = false;
    console.warn('[discordPresence] Login failed – is Discord running?', (e as any)?.message || e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  if (!lastState.enabled || !lastState.clientId) return;
  reconnectTimer = setTimeout(() => {
    connect(lastState.clientId!);
  }, 15000);
}

function buildActivity(state: PresenceState) {
  if (state.mode === 'reading' && state.reading) {
    const details = `Reading: ${state.reading.title}`.slice(0, 128);
    const activity: any = {
      details,
      state: state.reading.author ? `by ${state.reading.author}`.slice(0, 128) : undefined,
      startTimestamp: startTimestamp ?? Math.floor(Date.now() / 1000),
    };
    return activity;
  }
  // Browsing
  return {
    details: 'Browsing library',
    startTimestamp: startTimestamp ?? Math.floor(Date.now() / 1000),
  };
}

async function setActivity(activity: any) {
  if (!RPC || !client) return;
  if (!connected) return;
  try {
    await client.setActivity(activity);
  } catch (e) {
    console.warn('[discordPresence] setActivity failed', (e as any)?.message || e);
  }
}

export async function updateActivity(state: PresenceState) {
  lastState = state;
  if (!state.enabled || !state.clientId || !RPC) return;
  if (!client || !connected) {
    await connect(state.clientId);
  }
  if (!startTimestamp) startTimestamp = Math.floor(Date.now() / 1000);
  const activity = buildActivity(state);
  await setActivity(activity);
}

export async function clearActivity() {
  if (!RPC || !client || !connected) return;
  try {
    await client.clearActivity();
  } catch (e) {
    // ignore
  }
}

export async function shutdown() {
  clearReconnectTimer();
  try { await clearActivity(); } catch {}
  if (client) {
    try { client.destroy(); } catch {}
    client = null;
  }
  connected = false;
}

export function setEnabled(enabled: boolean, clientId?: string) {
  lastState.enabled = enabled;
  lastState.clientId = clientId;
  if (!enabled) {
    shutdown();
  } else if (clientId) {
    connect(clientId);
  }
}

export function setBrowsing() {
  startTimestamp = startTimestamp ?? Math.floor(Date.now() / 1000);
  return updateActivity({ ...lastState, mode: 'browsing', reading: undefined });
}

export function setReading(title: string, author?: string) {
  startTimestamp = startTimestamp ?? Math.floor(Date.now() / 1000);
  return updateActivity({ ...lastState, mode: 'reading', reading: { title, author } });
}
