import {Centrifuge, Subscription} from 'centrifuge';
import type {StreamPosition, TransportEndpoint} from 'centrifuge';
import './style.css';

interface KitchenOrder {
  id: number;
  item: string;
  station: string;
  status: 'queued' | 'preparing' | 'ready' | 'served';
  createdAt: string;
}

interface StateSnapshot {
  position: StreamPosition;
  orders: KitchenOrder[];
}

interface OrderEvent {
  type: 'created' | 'updated';
  order: KitchenOrder;
}

const serverUrl = 'http://localhost:8096';
const centrifugoBase = 'localhost:8000';

let centrifuge: Centrifuge | null = null;
let subscription: Subscription | null = null;
const orders = new Map<number, KitchenOrder>();

const connectionStateEl = document.getElementById('connection-state')!;
const streamPositionEl = document.getElementById('stream-position')!;
const ordersEl = document.getElementById('orders')!;
const eventsEl = document.getElementById('events')!;
const itemInput = document.getElementById('item-input') as HTMLSelectElement;
const stationInput = document.getElementById('station-input') as HTMLSelectElement;

function transports(): TransportEndpoint[] {
  return [{transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`}];
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, init);
  return response.json() as Promise<T>;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${serverUrl}${path}`);
  return response.text();
}

function renderOrders() {
  ordersEl.innerHTML = '';
  const sorted = [...orders.values()].sort((a, b) => b.id - a.id);
  if (sorted.length === 0) {
    ordersEl.innerHTML = '<p class="empty">No orders yet.</p>';
    return;
  }

  for (const order of sorted) {
    const article = document.createElement('article');
    article.className = `order ${order.status}`;
    article.innerHTML = `
      <div>
        <span>#${order.id} ${order.station}</span>
        <h2>${order.item}</h2>
      </div>
      <strong>${order.status}</strong>
      <button data-advance="${order.id}" ${order.status === 'served' ? 'disabled' : ''}>Advance</button>
    `;
    ordersEl.appendChild(article);
  }
}

function logEvent(text: string) {
  const item = document.createElement('li');
  item.innerHTML = `<span>${new Date().toLocaleTimeString()}</span>${text}`;
  eventsEl.prepend(item);
  while (eventsEl.children.length > 12) {
    eventsEl.removeChild(eventsEl.lastElementChild!);
  }
}

function applySnapshot(snapshot: StateSnapshot) {
  orders.clear();
  snapshot.orders.forEach((order) => orders.set(order.id, order));
  streamPositionEl.textContent = `offset ${snapshot.position.offset}`;
  renderOrders();
}

function applyOrderEvent(event: OrderEvent) {
  orders.set(event.order.id, event.order);
  renderOrders();
  logEvent(`${event.type} order #${event.order.id} at ${event.order.status}.`);
}

async function loadState(): Promise<StreamPosition> {
  const snapshot = await fetchJson<StateSnapshot>('/orders/state');
  applySnapshot(snapshot);
  logEvent(`Loaded database snapshot at offset ${snapshot.position.offset}.`);
  return snapshot.position;
}

async function connect() {
  const token = await fetchText('/centrifugo-token');
  centrifuge = new Centrifuge(transports(), {token});
  subscription = centrifuge.newSubscription('pg_orders:kitchen', {
    getState: loadState
  });

  centrifuge.on('connecting', () => {
    connectionStateEl.textContent = 'connecting';
  });
  centrifuge.on('connected', () => {
    connectionStateEl.textContent = 'connected';
  });
  centrifuge.on('disconnected', (ctx) => {
    connectionStateEl.textContent = `disconnected (${ctx.reason})`;
  });

  subscription.on('subscribed', (ctx) => {
    const offset = ctx.streamPosition?.offset ?? 0;
    streamPositionEl.textContent = `offset ${offset}`;
    logEvent(`Subscribed. recovered=${ctx.recovered}.`);
  });

  subscription.on('publication', (ctx) => {
    streamPositionEl.textContent = `offset ${ctx.offset ?? 0}`;
    applyOrderEvent(ctx.data as OrderEvent);
  });

  subscription.subscribe();
  centrifuge.connect();
}

document.getElementById('create-btn')!.addEventListener('click', async () => {
  const order = await fetchJson<KitchenOrder>('/orders', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({item: itemInput.value, station: stationInput.value})
  });
  orders.set(order.id, order);
  renderOrders();
});

document.getElementById('reload-btn')!.addEventListener('click', () => {
  void loadState();
});

ordersEl.addEventListener('click', async (event) => {
  const button = event.target as HTMLButtonElement;
  const id = button.dataset.advance;
  if (!id) {
    return;
  }
  const order = await fetchJson<KitchenOrder>(`/orders/${id}/advance`, {method: 'POST'});
  orders.set(order.id, order);
  renderOrders();
});

void connect();
