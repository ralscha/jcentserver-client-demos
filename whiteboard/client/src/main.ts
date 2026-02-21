import { Centrifuge, TransportEndpoint } from 'centrifuge';
import './style.css';

const serverUrl = import.meta.env.VITE_SERVER_URL as string;

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
let lastSendTime = 0;

// Set canvas size to fill the window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
    x0: x0 / canvas.width,
    y0: y0 / canvas.height,
    x1: x1 / canvas.width,
    y1: y1 / canvas.height,
    color,
  };

  fetch(`${serverUrl}/drawing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  drawing = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (!drawing) return;
  drawLine(lastX, lastY, e.clientX, e.clientY, currentColor, true);
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
});

canvas.addEventListener('mouseleave', () => {
  drawing = false;
});

// Touch support
canvas.addEventListener('touchstart', (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  drawing = true;
  lastX = touch.clientX;
  lastY = touch.clientY;
});

canvas.addEventListener('touchmove', (e: TouchEvent) => {
  e.preventDefault();
  if (!drawing) return;
  const touch = e.touches[0];
  drawLine(lastX, lastY, touch.clientX, touch.clientY, currentColor, true);
  lastX = touch.clientX;
  lastY = touch.clientY;
});

canvas.addEventListener('touchend', () => {
  drawing = false;
});

function transports(): TransportEndpoint[] {
  return [
    {
      transport: 'websocket',
      endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`,
    },
    {
      transport: 'http_stream',
      endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`,
    },
    {
      transport: 'sse',
      endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`,
    },
  ];
}

// Centrifugo connection
async function init() {
  const tokenResponse = await fetch(`${serverUrl}/centrifugo-token`);
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

init();
