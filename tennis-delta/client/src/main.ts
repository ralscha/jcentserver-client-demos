import {Centrifuge, Subscription, TransportEndpoint} from 'centrifuge';
import './style.css';

interface Player {
  name: string;
  country: string;
}

interface Scoreboard {
  sets: Array<{a: number; b: number}>;
  currentGames: {a: number; b: number};
  currentPoints: {a: string; b: string};
  server: string;
  pressureLabel: string;
  winner?: string;
}

interface MatchClock {
  elapsedSeconds: number;
  formatted: string;
  shotClock: number;
  pointNumber: number;
}

interface EventItem {
  id: string;
  text: string;
  at: string;
}

interface Telemetry {
  serverPayloadBytes: number;
  autoplay: boolean;
}

interface MatchState {
  meta: {tournament: string; court: string};
  players: {a: Player; b: Player};
  scoreboard: Scoreboard;
  clock: MatchClock;
  stats: Record<string, string>;
  lastEvents: EventItem[];
  telemetry: Telemetry;
}

type FeedMode = 'plain' | 'delta';

interface MeterState {
  bytes: number;
  frames: number;
  lastFrameBytes: number;
}

const serverUrl = import.meta.env.VITE_SERVER_URL as string;
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS as string;

const textEncoder = new TextEncoder();
const wsHooks: Array<(bytes: number) => void> = [];

const meters: Record<FeedMode, MeterState> = {
  plain: {bytes: 0, frames: 0, lastFrameBytes: 0},
  delta: {bytes: 0, frames: 0, lastFrameBytes: 0}
};

const subscriptions: Partial<Record<FeedMode, Subscription>> = {};
const clients: Partial<Record<FeedMode, Centrifuge>> = {};
let latestState: MatchState | null = null;

const plainBytesEl = document.getElementById('plain-bytes')!;
const plainFramesEl = document.getElementById('plain-frames')!;
const plainLastEl = document.getElementById('plain-last')!;
const deltaBytesEl = document.getElementById('delta-bytes')!;
const deltaFramesEl = document.getElementById('delta-frames')!;
const deltaLastEl = document.getElementById('delta-last')!;
const reductionValueEl = document.getElementById('reduction-value')!;
const payloadEstimateEl = document.getElementById('payload-estimate')!;
const tournamentNameEl = document.getElementById('tournament-name')!;
const courtNameEl = document.getElementById('court-name')!;
const clockElapsedEl = document.getElementById('clock-elapsed')!;
const clockShotEl = document.getElementById('clock-shot')!;
const playerACountryEl = document.getElementById('player-a-country')!;
const playerANameEl = document.getElementById('player-a-name')!;
const playerASetsEl = document.getElementById('player-a-sets')!;
const playerAGamesEl = document.getElementById('player-a-games')!;
const playerAPointsEl = document.getElementById('player-a-points')!;
const playerBCountryEl = document.getElementById('player-b-country')!;
const playerBNameEl = document.getElementById('player-b-name')!;
const playerBSetsEl = document.getElementById('player-b-sets')!;
const playerBGamesEl = document.getElementById('player-b-games')!;
const playerBPointsEl = document.getElementById('player-b-points')!;
const serverIndicatorEl = document.getElementById('server-indicator')!;
const pressureIndicatorEl = document.getElementById('pressure-indicator')!;
const winnerIndicatorEl = document.getElementById('winner-indicator')!;
const statGridEl = document.getElementById('stat-grid')!;
const eventLogEl = document.getElementById('event-log')!;
const autoplayBtn = document.getElementById('autoplay-btn') as HTMLButtonElement;

function installWebSocketMeter() {
  const marker = '__tennisDeltaWsMeterInstalled';
  const globalWindow = window as unknown as Record<string, unknown>;
  if (globalWindow[marker]) {
    return;
  }

  const NativeWebSocket = window.WebSocket;

  class InstrumentedWebSocket extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(typeof url === 'string' ? url : url.toString(), protocols);
      const hook = wsHooks.shift();
      if (hook) {
        this.addEventListener('message', (event) => {
          if (typeof event.data === 'string') {
            hook(textEncoder.encode(event.data).length);
          } else if (event.data instanceof Blob) {
            hook(event.data.size);
          } else if (event.data instanceof ArrayBuffer) {
            hook(event.data.byteLength);
          }
        });
      }
    }
  }

  window.WebSocket = InstrumentedWebSocket as typeof WebSocket;
  globalWindow[marker] = true;
}

function transports(): TransportEndpoint[] {
  return [{transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`}];
}

async function fetchText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetch(`${serverUrl}${path}`, init);
  return response.text();
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, init);
  return response.json() as Promise<T>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderMeters() {
  plainBytesEl.textContent = formatBytes(meters.plain.bytes);
  plainFramesEl.textContent = `${meters.plain.frames} frames`;
  plainLastEl.textContent = `Last frame ${formatBytes(meters.plain.lastFrameBytes)}`;

  deltaBytesEl.textContent = formatBytes(meters.delta.bytes);
  deltaFramesEl.textContent = `${meters.delta.frames} frames`;
  deltaLastEl.textContent = `Last frame ${formatBytes(meters.delta.lastFrameBytes)}`;

  const reduction = meters.plain.bytes === 0 ? 0 : ((meters.plain.bytes - meters.delta.bytes) / meters.plain.bytes) * 100;
  reductionValueEl.textContent = `${Math.max(0, reduction).toFixed(1)}%`;
  payloadEstimateEl.textContent = latestState ? `Server payload ${formatBytes(latestState.telemetry.serverPayloadBytes)}` : 'Server payload 0 B';
}

function renderState(state: MatchState) {
  latestState = state;
  tournamentNameEl.textContent = state.meta.tournament;
  courtNameEl.textContent = state.meta.court;
  clockElapsedEl.textContent = state.clock.formatted;
  clockShotEl.textContent = `Shot clock ${state.clock.shotClock}`;

  playerACountryEl.textContent = state.players.a.country;
  playerANameEl.textContent = state.players.a.name;
  playerASetsEl.textContent = String(state.scoreboard.sets.filter((set) => set.a > set.b).length);
  playerAGamesEl.textContent = String(state.scoreboard.currentGames.a);
  playerAPointsEl.textContent = state.scoreboard.currentPoints.a;

  playerBCountryEl.textContent = state.players.b.country;
  playerBNameEl.textContent = state.players.b.name;
  playerBSetsEl.textContent = String(state.scoreboard.sets.filter((set) => set.b > set.a).length);
  playerBGamesEl.textContent = String(state.scoreboard.currentGames.b);
  playerBPointsEl.textContent = state.scoreboard.currentPoints.b;

  serverIndicatorEl.textContent = `Serving: ${state.scoreboard.server}`;
  pressureIndicatorEl.textContent = state.scoreboard.pressureLabel;
  winnerIndicatorEl.textContent = state.scoreboard.winner ? `${state.scoreboard.winner} wins the match` : 'Match in progress';
  autoplayBtn.textContent = state.telemetry.autoplay ? 'Pause autoplay' : 'Resume autoplay';

  statGridEl.innerHTML = '';
  Object.entries(state.stats).forEach(([label, value]) => {
    const card = document.createElement('article');
    card.className = 'stat-card';
    card.innerHTML = `<span class="label">${label}</span><strong>${value}</strong>`;
    statGridEl.appendChild(card);
  });

  eventLogEl.innerHTML = '';
  state.lastEvents.forEach((event) => {
    const item = document.createElement('li');
    item.innerHTML = `<div>${event.text}</div><small>${event.at}</small>`;
    eventLogEl.appendChild(item);
  });

  renderMeters();
}

function resetMeters() {
  meters.plain.bytes = 0;
  meters.plain.frames = 0;
  meters.plain.lastFrameBytes = 0;
  meters.delta.bytes = 0;
  meters.delta.frames = 0;
  meters.delta.lastFrameBytes = 0;
  renderMeters();
}

async function connectFeed(mode: FeedMode, delta: boolean) {
  wsHooks.push((bytes) => {
    meters[mode].bytes += bytes;
    meters[mode].frames += 1;
    meters[mode].lastFrameBytes = bytes;
    renderMeters();
  });

  const token = await fetchText('/centrifugo-token');
  const client = new Centrifuge(transports(), {token});
  const subscription = client.newSubscription('tennis:centre-court', delta ? {delta: 'fossil'} : undefined);

  subscription.on('publication', (ctx) => {
    renderState(ctx.data as MatchState);
  });

  const subscribed = new Promise<void>((resolve, reject) => {
    subscription.on('subscribed', () => resolve());
    subscription.on('error', (ctx) => reject(ctx));
  });

  subscriptions[mode] = subscription;
  clients[mode] = client;
  subscription.subscribe();
  client.connect();

  await subscribed;
}

async function post(path: string, body?: unknown) {
  await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function bootstrap() {
  installWebSocketMeter();
  renderState(await fetchJson<MatchState>('/match-state'));
  await connectFeed('plain', false);
  await connectFeed('delta', true);
  resetMeters();
}

document.getElementById('next-point-btn')!.addEventListener('click', () => {
  void post('/next-point');
});

document.getElementById('reset-match-btn')!.addEventListener('click', () => {
  void post('/reset-match');
  resetMeters();
});

document.getElementById('reset-meters-btn')!.addEventListener('click', resetMeters);

autoplayBtn.addEventListener('click', () => {
  const enabled = !(latestState?.telemetry.autoplay ?? true);
  void post('/autoplay', {enabled});
});

window.addEventListener('beforeunload', () => {
  subscriptions.plain?.unsubscribe();
  subscriptions.delta?.unsubscribe();
  clients.plain?.disconnect();
  clients.delta?.disconnect();
});

void bootstrap();