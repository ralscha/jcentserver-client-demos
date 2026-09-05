import { Centrifuge, TransportEndpoint } from 'centrifuge';
import './style.css';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

const FADE_TIME = 150;
const TYPING_TIMER_LENGTH = 400;
const COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7',
];

interface ChatEvent {
  event: string;
  username?: string;
  message?: string;
  numUsers?: number;
}

// DOM elements
const usernameInput = document.querySelector<HTMLInputElement>('.usernameInput')!;
const messages = document.querySelector<HTMLUListElement>('.messages')!;
const inputMessage = document.querySelector<HTMLInputElement>('.inputMessage')!;
const loginPage = document.querySelector<HTMLLIElement>('.login.page')!;
const chatPage = document.querySelector<HTMLLIElement>('.chat.page')!;

// Show login page initially
loginPage.classList.add('active');

let username = '';
let userId = '';
let connected = false;
let typing = false;
let lastTypingTime = 0;
let centrifuge: Centrifuge | null = null;

function getUsernameColor(name: string): string {
  let hash = 7;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + (hash << 5) - hash;
  }
  return COLORS[Math.abs(hash % COLORS.length)];
}

function addParticipantsMessage(numUsers: number) {
  const msg = numUsers === 1 ? "there's 1 participant" : `there are ${numUsers} participants`;
  log(msg);
}

function log(message: string) {
  const li = document.createElement('li');
  li.classList.add('log');
  li.textContent = message;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

function addChatMessage(data: { username: string; message: string; typing?: boolean }) {
  // Remove existing typing message from this user if any
  const existingTyping = messages.querySelectorAll<HTMLLIElement>('li.message.typing');
  existingTyping.forEach((el) => {
    if (el.dataset.username === data.username) el.remove();
  });

  const li = document.createElement('li');
  li.classList.add('message');
  if (data.typing) li.classList.add('typing');
  li.dataset.username = data.username;

  const usernameSpan = document.createElement('span');
  usernameSpan.classList.add('username');
  usernameSpan.textContent = data.username;
  usernameSpan.style.color = getUsernameColor(data.username);

  const bodySpan = document.createElement('span');
  bodySpan.classList.add('messageBody');
  bodySpan.textContent = data.message;

  li.appendChild(usernameSpan);
  li.appendChild(bodySpan);
  messages.appendChild(li);

  if (data.typing) {
    // Auto-fade typing indicators
    setTimeout(() => li.remove(), 3000);
  }

  messages.scrollTop = messages.scrollHeight;

  if (!data.typing) {
    li.style.opacity = '0';
    li.style.transition = `opacity ${FADE_TIME}ms`;
    requestAnimationFrame(() => {
      li.style.opacity = '1';
    });
  }
}

function removeChatTyping(name: string) {
  messages.querySelectorAll<HTMLLIElement>('li.message.typing').forEach((el) => {
    if (el.dataset.username === name) el.remove();
  });
}

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

async function post(path: string, body: unknown) {
  const response = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

function sendMessage() {
  const message = inputMessage.value.trim();
  if (message && connected) {
    inputMessage.value = '';
    // Show own message immediately
    addChatMessage({ username, message });
    void post('/new-message', { username, message }).catch(console.error);
  }
}

function updateTyping() {
  if (!connected) return;
  if (!typing) {
    typing = true;
    void post('/typing', { username }).catch(console.error);
  }
  lastTypingTime = Date.now();
  setTimeout(() => {
    if (Date.now() - lastTypingTime >= TYPING_TIMER_LENGTH && typing) {
      void post('/stop-typing', { username }).catch(console.error);
      typing = false;
    }
  }, TYPING_TIMER_LENGTH);
}

async function setUsername() {
  const name = usernameInput.value.trim();
  if (!name || username) return;
  username = name;
  userId = crypto.randomUUID();

  const tokenResponse = await fetch(`${serverUrl}/centrifugo-token?userId=${encodeURIComponent(userId)}`);
  if (!tokenResponse.ok) {
    throw new Error(`Could not fetch token: ${tokenResponse.status}`);
  }
  const token = await tokenResponse.text();

  // Connect to Centrifugo
  centrifuge = new Centrifuge(transports(), { token });

  const sub = centrifuge.newSubscription('chat');

  sub.on('publication', (ctx) => {
    const data = ctx.data as ChatEvent;
    if (data.event === 'new-message') {
      // Don't show own messages twice
      if (data.username !== username) {
        addChatMessage({ username: data.username!, message: data.message! });
      }
    } else if (data.event === 'user-joined') {
      log(`${data.username} joined`);
      addParticipantsMessage(data.numUsers!);
    } else if (data.event === 'user-left') {
      log(`${data.username} left`);
      addParticipantsMessage(data.numUsers!);
      removeChatTyping(data.username!);
    } else if (data.event === 'typing') {
      if (data.username !== username) {
        addChatMessage({ username: data.username!, message: 'is typing', typing: true });
      }
    } else if (data.event === 'stop-typing') {
      removeChatTyping(data.username!);
    }
  });

  sub.subscribe();
  centrifuge.connect();

  // Register user on server
  const loginResponse = await fetch(`${serverUrl}/add-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Could not register user: ${loginResponse.status}`);
  }
  const loginData = await loginResponse.json();

  // Switch pages only after the server accepted the registration.
  loginPage.classList.remove('active');
  chatPage.classList.add('active');
  inputMessage.focus();

  connected = true;
  log('Welcome to Chat!');
  addParticipantsMessage(loginData.numUsers);

  // Remove user when tab/window is closed
  window.addEventListener('beforeunload', () => {
    navigator.sendBeacon(`${serverUrl}/remove-user?userId=${encodeURIComponent(userId)}`);
  });
}

// Key handling
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') {
    if (username) {
      sendMessage();
      if (typing) {
        void post('/stop-typing', { username }).catch(console.error);
        typing = false;
      }
    } else {
      void setUsername().catch((error) => {
        centrifuge?.disconnect();
        centrifuge = null;
        username = '';
        userId = '';
        connected = false;
        usernameInput.focus();
        console.error(error);
      });
    }
  }
});

inputMessage.addEventListener('input', () => updateTyping());
loginPage.addEventListener('click', () => usernameInput.focus());
inputMessage.addEventListener('click', () => inputMessage.focus());
