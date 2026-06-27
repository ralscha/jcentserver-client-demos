import {Centrifuge, SharedPollSubscription, TransportEndpoint} from 'centrifuge';
import './style.css';

interface VoteItem {
  key: string;
  title: string;
  category: string;
  votes: number;
  version: number;
}

const serverUrl = 'http://localhost:8095';
const centrifugoBase = 'localhost:8000';
const posts = new Map<string, VoteItem>();
const tracked = new Set<string>();

let sub: SharedPollSubscription | null = null;
let client: Centrifuge | null = null;

const cardsEl = document.getElementById('cards')!;
const updatesEl = document.getElementById('updates')!;
const connectionStateEl = document.getElementById('connection-state')!;
const trackedCountEl = document.getElementById('tracked-count')!;

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

function logUpdate(text: string) {
  const item = document.createElement('li');
  item.innerHTML = `<span>${new Date().toLocaleTimeString()}</span>${text}`;
  updatesEl.prepend(item);
  while (updatesEl.children.length > 12) {
    updatesEl.removeChild(updatesEl.lastElementChild!);
  }
}

function render() {
  cardsEl.innerHTML = '';
  for (const post of posts.values()) {
    const article = document.createElement('article');
    article.className = tracked.has(post.key) ? 'card tracked' : 'card';
    article.innerHTML = `
      <div>
        <span>${post.category}</span>
        <h2>${post.title}</h2>
      </div>
      <strong>${post.votes}</strong>
      <div class="actions">
        <label><input type="checkbox" ${tracked.has(post.key) ? 'checked' : ''} data-track="${post.key}" /> Track</label>
        <button data-vote="${post.key}">Vote</button>
      </div>
    `;
    cardsEl.appendChild(article);
  }
  trackedCountEl.textContent = `${tracked.size} tracked`;
}

async function connect() {
  const token = await fetchText('/centrifugo-token');
  client = new Centrifuge(transports(), {token});
  sub = client.newSharedPollSubscription('post_votes:feed', {
    getSignature: async (ctx) => fetchJson('/signature', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({keys: ctx.keys})
    })
  });

  client.on('connecting', () => {
    connectionStateEl.textContent = 'connecting';
  });
  client.on('connected', () => {
    connectionStateEl.textContent = 'connected';
  });
  client.on('disconnected', (ctx) => {
    connectionStateEl.textContent = `disconnected (${ctx.reason})`;
  });

  sub.on('update', (ctx) => {
    if (ctx.removed) {
      posts.delete(ctx.key);
      tracked.delete(ctx.key);
      logUpdate(`${ctx.key} was removed.`);
    }
    else {
      posts.set(ctx.key, ctx.data as VoteItem);
      logUpdate(`${ctx.key} refreshed at version ${ctx.version}.`);
    }
    render();
  });

  sub.subscribe();
  client.connect();
}

cardsEl.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const key = input.dataset.track;
  if (!key || !sub) {
    return;
  }
  if (input.checked) {
    tracked.add(key);
    sub.track([key]);
    logUpdate(`Tracking ${key}.`);
  }
  else {
    tracked.delete(key);
    sub.untrack([key]);
    logUpdate(`Stopped tracking ${key}.`);
  }
  render();
});

cardsEl.addEventListener('click', async (event) => {
  const button = event.target as HTMLButtonElement;
  const key = button.dataset.vote;
  if (!key) {
    return;
  }
  const updated = await fetchJson<VoteItem>('/vote', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({key})
  });
  posts.set(updated.key, updated);
  logUpdate(`Vote written for ${key}.`);
  render();
});

async function bootstrap() {
  const initialPosts = await fetchJson<VoteItem[]>('/posts');
  initialPosts.forEach((post) => posts.set(post.key, post));
  initialPosts.slice(0, 3).forEach((post) => tracked.add(post.key));
  render();
  await connect();
  sub?.track([...tracked]);
}

void bootstrap();
