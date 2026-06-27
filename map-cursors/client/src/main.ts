import {Centrifuge, MapSubscription, TransportEndpoint} from 'centrifuge';
import './style.css';

const serverUrl = 'http://localhost:8094';
const centrifugoBase = 'localhost:8000';

let centrifuge: Centrifuge | null = null;
let subscription: MapSubscription | null = null;
const cursors = new Map<string, {name: string; color: string; x: number; y: number}>();
const identity = {
  name: `User ${Math.floor(Math.random() * 900) + 100}`,
  color: `hsl(${Math.floor(Math.random() * 360)} 72% 54%)`
};

const connectionStateEl = document.getElementById('connection-state')!;
const cursorCountEl = document.getElementById('cursor-count')!;
const stageEl = document.getElementById('stage')!;
const hintEl = document.getElementById('hint')!;

function transports(): TransportEndpoint[] {
  return [{transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`}];
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${serverUrl}${path}`);
  return response.text();
}

function renderCursors() {
  document.querySelectorAll('.cursor').forEach((node) => node.remove());
  cursors.forEach((cursor, key) => {
    const node = document.createElement('div');
    node.className = 'cursor';
    node.style.left = `${cursor.x}%`;
    node.style.top = `${cursor.y}%`;
    node.style.setProperty('--cursor-color', cursor.color);
    node.innerHTML = `<span></span><strong>${cursor.name}</strong>`;
    node.dataset.key = key;
    stageEl.appendChild(node);
  });
  cursorCountEl.textContent = `${cursors.size} cursor${cursors.size === 1 ? '' : 's'}`;
}

async function ensureConnection() {
  if (centrifuge) {
    return;
  }

  const token = await fetchText('/centrifugo-token');
  centrifuge = new Centrifuge(transports(), {token});
  subscription = centrifuge.newMapSubscription('cursors:room');

  centrifuge.on('connecting', () => {
    connectionStateEl.textContent = 'connecting';
  });

  centrifuge.on('connected', () => {
    connectionStateEl.textContent = 'connected';
  });

  centrifuge.on('disconnected', (ctx) => {
    connectionStateEl.textContent = `disconnected (${ctx.reason})`;
  });

  subscription.on('sync', (ctx) => {
    cursors.clear();
    for (const entry of ctx.entries) {
      cursors.set(entry.key, entry.data);
    }
    renderCursors();
  });

  subscription.on('update', (ctx) => {
    if (ctx.removed) {
      cursors.delete(ctx.key);
    }
    else {
      cursors.set(ctx.key, ctx.data);
    }
    renderCursors();
  });

  subscription.subscribe();
}

async function connect() {
  await ensureConnection();
  centrifuge?.connect();
}

function disconnect() {
  centrifuge?.disconnect();
}

let pendingFrame = 0;
stageEl.addEventListener('pointermove', (event) => {
  const rect = stageEl.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  hintEl.hidden = true;

  if (pendingFrame) {
    return;
  }
  pendingFrame = window.requestAnimationFrame(() => {
    pendingFrame = 0;
    void subscription?.publish('', {
      name: identity.name,
      color: identity.color,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  });
});

void connect();
window.addEventListener('beforeunload', disconnect);
