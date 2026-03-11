import {Centrifuge, Subscription, TransportEndpoint} from 'centrifuge';
import './style.css';

interface RecoveryEvent {
  seq: number;
  source: string;
  message: string;
  publishedAt: string;
}

const serverUrl = import.meta.env.VITE_SERVER_URL as string;
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS as string;

let centrifuge: Centrifuge | null = null;
let subscription: Subscription | null = null;
let lastSeq = 0;
let recoveredSubscriptions = 0;
let gapsDetected = 0;

const connectionStateEl = document.getElementById('connection-state')!;
const lastSeqEl = document.getElementById('last-seq')!;
const recoveriesEl = document.getElementById('recoveries')!;
const gapsEl = document.getElementById('gaps')!;
const timelineSummaryEl = document.getElementById('timeline-summary')!;
const timelineEl = document.getElementById('timeline')!;

function transports(): TransportEndpoint[] {
  return [{transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`}];
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${serverUrl}${path}`);
  return response.text();
}

async function post(path: string, body?: unknown) {
  await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function renderStats() {
  lastSeqEl.textContent = String(lastSeq);
  recoveriesEl.textContent = String(recoveredSubscriptions);
  gapsEl.textContent = String(gapsDetected);
}

function pushLog(text: string, kind: 'info' | 'warn' | 'data' = 'data') {
  const item = document.createElement('li');
  item.className = kind;
  item.innerHTML = `${text}<span>${new Date().toLocaleTimeString()}</span>`;
  timelineEl.prepend(item);
  while (timelineEl.children.length > 18) {
    timelineEl.removeChild(timelineEl.lastElementChild!);
  }
}

function handlePublication(event: RecoveryEvent) {
  if (lastSeq !== 0 && event.seq !== lastSeq + 1) {
    gapsDetected += Math.max(0, event.seq - lastSeq - 1);
    pushLog(`Gap detected. Expected ${lastSeq + 1}, received ${event.seq}.`, 'warn');
  }
  lastSeq = event.seq;
  timelineSummaryEl.textContent = `Latest event ${event.seq} from ${event.source}.`;
  pushLog(`#${event.seq} ${event.message}`, event.source === 'burst' ? 'info' : 'data');
  renderStats();
}

async function ensureConnection() {
  if (centrifuge) {
    return;
  }

  const token = await fetchText('/centrifugo-token');
  centrifuge = new Centrifuge(transports(), {token});
  subscription = centrifuge.newSubscription('recovery:lab');

  centrifuge.on('connecting', () => {
    connectionStateEl.textContent = 'connecting';
  });

  centrifuge.on('connected', () => {
    connectionStateEl.textContent = 'connected';
    pushLog('Transport connected.', 'info');
  });

  centrifuge.on('disconnected', (ctx) => {
    connectionStateEl.textContent = `disconnected (${ctx.reason})`;
    pushLog(`Transport disconnected: ${ctx.reason}.`, 'warn');
  });

  subscription.on('subscribed', (ctx) => {
    const recovered = Boolean((ctx as {recovered?: boolean}).recovered);
    if (recovered) {
      recoveredSubscriptions += 1;
    }
    pushLog(`Subscribed. recovered=${recovered}.`, recovered ? 'info' : 'data');
    renderStats();
  });

  subscription.on('publication', (ctx) => {
    handlePublication(ctx.data as RecoveryEvent);
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

async function simulateRecovery() {
  disconnect();
  pushLog('Manual disconnect triggered. Publishing burst while offline.', 'warn');
  await post('/burst', {count: 12});
  window.setTimeout(() => {
    void connect();
  }, 1600);
}

document.getElementById('connect-btn')!.addEventListener('click', () => {
  void connect();
});

document.getElementById('disconnect-btn')!.addEventListener('click', disconnect);

document.getElementById('burst-btn')!.addEventListener('click', () => {
  void post('/burst', {count: 12});
});

document.getElementById('simulate-btn')!.addEventListener('click', () => {
  void simulateRecovery();
});

document.getElementById('reset-server-btn')!.addEventListener('click', async () => {
  lastSeq = 0;
  gapsDetected = 0;
  recoveredSubscriptions = 0;
  renderStats();
  await post('/reset');
  pushLog('Server sequence reset.', 'info');
});

document.getElementById('clear-log-btn')!.addEventListener('click', () => {
  timelineEl.innerHTML = '';
  timelineSummaryEl.textContent = 'Timeline cleared.';
});

renderStats();
void connect();