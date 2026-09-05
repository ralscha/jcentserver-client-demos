import { Centrifuge, TransportEndpoint } from 'centrifuge';
import './style.css';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

interface DrawingMessage {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
}

const canvas = document.querySelector<HTMLCanvasElement>('.whiteboard')!;
const ctx = canvas.getContext('2d')!;
const colors = document.querySelectorAll<HTMLDivElement>('.color');

let currentColor = 'black';
let drawing = false;
let lastX = 0;
let lastY = 0;
let lastEmittedX = 0;
let lastEmittedY = 0;
let lastSendTime = 0;

// Set canvas size to fill the window
function resizeCanvas() {
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (snapshot.width > 0 && snapshot.height > 0) {
    ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, canvas.width, canvas.height);
  }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Color picker
colors.forEach((colorEl) => {
  colorEl.addEventListener('click', () => {
    const classList = colorEl.classList;
    if (classList.contains('black')) currentColor = 'black';
    else if (classList.contains('red')) currentColor = 'red';
    else if (classList.contains('green')) currentColor = 'green';
    else if (classList.contains('blue')) currentColor = 'blue';
    else if (classList.contains('yellow')) currentColor = 'yellow';
  });
});

function drawLine(x0: number, y0: number, x1: number, y1: number, color: string, emit: boolean) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.closePath();

  if (!emit) return;

  const now = Date.now();
  if (now - lastSendTime < 10) return;
  lastSendTime = now;

  const data: DrawingMessage = {
    x0: lastEmittedX / canvas.width,
    y0: lastEmittedY / canvas.height,
    x1: x1 / canvas.width,
    y1: y1 / canvas.height,
    color,
  };
  lastEmittedX = x1;
  lastEmittedY = y1;

  void fetch(`${serverUrl}/drawing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Could not publish drawing: ${response.status}`);
    }
  }).catch(console.error);
}

function canvasPoint(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(canvas.width, Math.max(0, ((clientX - rect.left) / rect.width) * canvas.width)),
    y: Math.min(canvas.height, Math.max(0, ((clientY - rect.top) / rect.height) * canvas.height)),
  };
}

canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  const point = canvasPoint(event.clientX, event.clientY);
  drawing = true;
  lastX = point.x;
  lastY = point.y;
  lastEmittedX = point.x;
  lastEmittedY = point.y;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event: PointerEvent) => {
  if (!drawing) return;
  const point = canvasPoint(event.clientX, event.clientY);
  drawLine(lastX, lastY, point.x, point.y, currentColor, true);
  lastX = point.x;
  lastY = point.y;
});

canvas.addEventListener('pointerup', (event: PointerEvent) => {
  drawing = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  drawing = false;
});

function transports(): TransportEndpoint[] {
  return [
    {
      transport: 'websocket',
      endpoint: `ws://${centrifugoBase}/connection/websocket`,
    },
    {
      transport: 'http_stream',
      endpoint: `http://${centrifugoBase}/connection/http_stream`,
    },
    {
      transport: 'sse',
      endpoint: `http://${centrifugoBase}/connection/sse`,
    },
  ];
}

// Centrifugo connection
async function init() {
  const tokenResponse = await fetch(`${serverUrl}/centrifugo-token`);
  if (!tokenResponse.ok) {
    throw new Error(`Could not fetch token: ${tokenResponse.status}`);
  }
  const token = await tokenResponse.text();

  const centrifuge = new Centrifuge(transports(), { token });

  const sub = centrifuge.newSubscription('drawing');

  sub.on('publication', (ctx) => {
    const msg = ctx.data as DrawingMessage;
    drawLine(
      msg.x0 * canvas.width,
      msg.y0 * canvas.height,
      msg.x1 * canvas.width,
      msg.y1 * canvas.height,
      msg.color,
      false,
    );
  });

  sub.subscribe();
  centrifuge.connect();
}

void init().catch(console.error);
