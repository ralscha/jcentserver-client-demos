import {Centrifuge, Subscription, TransportEndpoint} from 'centrifuge';
import './style.css';

interface SigninPayload {
  username: string;
  role: string;
  desk: string;
}

type PresenceInfo = {
  user?: string;
  client?: string;
  info?: Record<string, unknown>;
  conn_info?: Record<string, unknown>;
  connInfo?: Record<string, unknown>;
};

const serverUrl = import.meta.env.VITE_SERVER_URL as string;
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS as string;

let currentIdentity: SigninPayload | null = null;
let centrifuge: Centrifuge | null = null;
let subscription: Subscription | null = null;

const signinForm = document.getElementById('signin-form') as HTMLFormElement;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const roleInput = document.getElementById('role-input') as HTMLInputElement;
const deskInput = document.getElementById('desk-input') as HTMLInputElement;
const statusPillEl = document.getElementById('status-pill')!;
const clientCountEl = document.getElementById('client-count')!;
const userCountEl = document.getElementById('user-count')!;
const rosterEl = document.getElementById('roster')!;
const eventFeedEl = document.getElementById('event-feed')!;

function transports(): TransportEndpoint[] {
  return [{transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`}];
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  return response.json() as Promise<T>;
}

function setStatus(text: string) {
  statusPillEl.textContent = text;
}

function eventInfo(ctx: {info?: PresenceInfo}) {
  const info = ctx.info ?? {};
  const connInfo = info.connInfo ?? info.conn_info ?? info.info ?? {};
  const username = typeof connInfo.name === 'string' ? connInfo.name : info.user ?? 'anonymous';
  const role = typeof connInfo.role === 'string' ? connInfo.role : 'viewer';
  const desk = typeof connInfo.desk === 'string' ? connInfo.desk : 'remote';
  return {username, role, desk};
}

function pushEvent(text: string) {
  const item = document.createElement('li');
  item.innerHTML = `${text}<span>${new Date().toLocaleTimeString()}</span>`;
  eventFeedEl.prepend(item);
  while (eventFeedEl.children.length > 14) {
    eventFeedEl.removeChild(eventFeedEl.lastElementChild!);
  }
}

function renderRoster(clients: PresenceInfo[]) {
  rosterEl.innerHTML = '';
  if (clients.length === 0) {
    rosterEl.innerHTML = '<p>No online users.</p>';
    return;
  }

  clients.forEach((client) => {
    const info = client.connInfo ?? client.conn_info ?? client.info ?? {};
    const name = typeof info.name === 'string' ? info.name : client.user ?? 'anonymous';
    const role = typeof info.role === 'string' ? info.role : 'viewer';
    const desk = typeof info.desk === 'string' ? info.desk : 'remote';
    const card = document.createElement('article');
    card.className = 'person';
    card.innerHTML = `<div><strong>${name}</strong><small>${role}</small></div><div><strong>${desk}</strong><small>${client.client ?? ''}</small></div>`;
    rosterEl.appendChild(card);
  });
}

async function refreshPresence() {
  if (!centrifuge) {
    return;
  }

  const api = centrifuge as unknown as {
    presence: (channel: string) => Promise<{clients: Record<string, PresenceInfo>}>;
    presenceStats: (channel: string) => Promise<{numClients?: number; numUsers?: number; clients?: number; users?: number}>;
  };

  const [presence, stats] = await Promise.all([
    api.presence('presence:lobby'),
    api.presenceStats('presence:lobby')
  ]);

  const clients = Object.values(presence.clients ?? {});
  renderRoster(clients);
  clientCountEl.textContent = String(stats.numClients ?? stats.clients ?? clients.length);
  userCountEl.textContent = String(stats.numUsers ?? stats.users ?? new Set(clients.map((client) => client.user)).size);
}

async function createConnection(identity: SigninPayload) {
  const response = await postJson<{token: string}>('/centrifugo-token', identity);
  currentIdentity = identity;
  centrifuge = new Centrifuge(transports(), {token: response.token});
  subscription = centrifuge.newSubscription('presence:lobby');

  centrifuge.on('connecting', () => setStatus('connecting'));
  centrifuge.on('connected', () => setStatus('connected'));
  centrifuge.on('disconnected', (ctx) => setStatus(`disconnected (${ctx.reason})`));

  subscription.on('subscribed', async () => {
    pushEvent(`${identity.username} joined the lobby.`);
    await refreshPresence();
  });

  subscription.on('join', async (ctx) => {
    const info = eventInfo(ctx);
    pushEvent(`${info.username} joined from ${info.desk} as ${info.role}.`);
    await refreshPresence();
  });

  subscription.on('leave', async (ctx) => {
    const info = eventInfo(ctx);
    pushEvent(`${info.username} left the lobby.`);
    await refreshPresence();
  });

  subscription.subscribe();
  centrifuge.connect();
}

signinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (centrifuge) {
    centrifuge.disconnect();
    subscription?.unsubscribe();
  }

  void createConnection({
    username: nameInput.value.trim(),
    role: roleInput.value.trim(),
    desk: deskInput.value.trim()
  });
});

document.getElementById('refresh-btn')!.addEventListener('click', () => {
  void refreshPresence();
});

document.getElementById('disconnect-btn')!.addEventListener('click', () => {
  centrifuge?.disconnect();
});

document.getElementById('reconnect-btn')!.addEventListener('click', () => {
  if (!centrifuge && currentIdentity) {
    void createConnection(currentIdentity);
    return;
  }
  centrifuge?.connect();
});

setStatus('idle');