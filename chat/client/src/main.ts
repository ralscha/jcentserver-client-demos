import { Centrifuge, Subscription, TransportEndpoint } from 'centrifuge';
import './style.css';

const serverUrl = import.meta.env.VITE_SERVER_URL as string;

type MessageType = 'MSG' | 'JOIN' | 'LEAVE';

interface ChatMessage {
  type: MessageType;
  user: string;
  message: string;
  sendDate: number;
}

interface RoomEvent {
  event: string;
  message?: ChatMessage;
  room?: string;
  rooms?: string[];
}

// State
let username = '';
let currentRoom = '';
const joinedRooms = new Set<string>();
const roomSubscriptions = new Map<string, Subscription>();
let centrifuge: Centrifuge | null = null;

// DOM
const signinScreen = document.getElementById('signin-screen')!;
const chatScreen = document.getElementById('chat-screen')!;
const usernameInput = document.getElementById('username-input') as HTMLInputElement;
const signinBtn = document.getElementById('signin-btn')!;
const signinError = document.getElementById('signin-error')!;
const signoutBtn = document.getElementById('signout-btn')!;
const currentUserEl = document.getElementById('current-user')!;
const roomListEl = document.getElementById('room-list')!;
const newRoomBtn = document.getElementById('new-room-btn')!;
const noRoomMsg = document.getElementById('no-room-msg')!;
const roomView = document.getElementById('room-view')!;
const roomTitle = document.getElementById('room-title')!;
const messagesEl = document.getElementById('messages')!;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn')!;

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

function renderRoomList(rooms: string[]) {
  roomListEl.innerHTML = '';
  rooms.sort().forEach((room) => addRoomToList(room));
}

function addRoomToList(room: string) {
  // Avoid duplicates
  if (roomListEl.querySelector(`[data-room="${CSS.escape(room)}"]`)) return;

  const li = document.createElement('li');
  li.textContent = `# ${room}`;
  li.dataset.room = room;
  li.addEventListener('click', () => switchRoom(room));
  roomListEl.appendChild(li);
}

async function switchRoom(room: string) {
  if (room === currentRoom) return;

  // Leave old room
  if (currentRoom) {
    await post('/leave-room', { room: currentRoom, username });
    roomListEl.querySelector(`[data-room="${CSS.escape(currentRoom)}"]`)?.classList.remove('active');
    // Unsubscribe
    const sub = roomSubscriptions.get(currentRoom);
    if (sub) {
      sub.unsubscribe();
    }
    joinedRooms.delete(currentRoom);
  }

  currentRoom = room;
  roomListEl.querySelector(`[data-room="${CSS.escape(room)}"]`)?.classList.add('active');
  messagesEl.innerHTML = '';
  roomTitle.textContent = `# ${room}`;
  noRoomMsg.classList.add('hidden');
  roomView.classList.remove('hidden');

  // Subscribe to room channel in Centrifugo
  if (!roomSubscriptions.has(room)) {
    const sub = centrifuge!.newSubscription(`room.${room}`);
    sub.on('publication', (ctx) => {
      const data = ctx.data as RoomEvent;
      if (data.event === 'new-message' && data.message) {
        appendMessage(data.message);
      }
    });
    sub.subscribe();
    roomSubscriptions.set(room, sub);
  }

  joinedRooms.add(room);

  // Join room on server and load history
  const history = await post<ChatMessage[]>('/join-room', { room, username });
  if (history) {
    history.forEach(appendMessage);
  }

  messageInput.focus();
}

function appendMessage(msg: ChatMessage) {
  const li = document.createElement('li');
  if (msg.type === 'MSG') {
    li.classList.add('msg');
    const author = document.createElement('span');
    author.classList.add('author');
    author.textContent = msg.user + ':';
    li.appendChild(author);
    li.appendChild(document.createTextNode(msg.message));
  } else {
    li.classList.add('system');
    li.textContent = msg.message;
  }
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !currentRoom) return;
  messageInput.value = '';
  await post('/msg', { room: currentRoom, username, message });
}

async function signin() {
  const name = usernameInput.value.trim();
  if (!name) return;

  const result = await post<{ token?: string; rooms?: string[]; error?: string }>('/signin', {
    username: name,
  });

  if (result.error === 'userexists') {
    signinError.textContent = 'That nickname is already taken. Please choose another.';
    signinError.classList.remove('hidden');
    return;
  }

  username = name;
  const token = result.token!;
  const rooms = result.rooms ?? [];

  signinError.classList.add('hidden');
  currentUserEl.textContent = username;
  signinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');

  renderRoomList(rooms);

  // Connect to Centrifugo
  centrifuge = new Centrifuge(transports(), { token });

  // Subscribe to global rooms channel for room additions/removals
  const roomsSub = centrifuge.newSubscription('rooms');
  roomsSub.on('publication', (ctx) => {
    const data = ctx.data as RoomEvent;
    if (data.event === 'room-added' && data.room) {
      addRoomToList(data.room);
    } else if (data.event === 'rooms-removed' && data.rooms) {
      data.rooms.forEach((r) => {
        roomListEl.querySelector(`[data-room="${CSS.escape(r)}"]`)?.remove();
      });
    }
  });
  roomsSub.subscribe();
  centrifuge.connect();

  // Cleanup on close
  window.addEventListener('beforeunload', () => {
    if (currentRoom) {
      navigator.sendBeacon(`${serverUrl}/leave-room`, JSON.stringify({ room: currentRoom, username }));
    }
    navigator.sendBeacon(`${serverUrl}/signout`, JSON.stringify({ username }));
  });
}

async function signout() {
  if (currentRoom) {
    await post('/leave-room', { room: currentRoom, username });
    currentRoom = '';
  }
  await post('/signout', { username });
  centrifuge?.disconnect();
  centrifuge = null;
  roomSubscriptions.clear();
  joinedRooms.clear();
  username = '';

  chatScreen.classList.add('hidden');
  signinScreen.classList.remove('hidden');
  usernameInput.value = '';
  messagesEl.innerHTML = '';
  roomView.classList.add('hidden');
  noRoomMsg.classList.remove('hidden');
}

// Event listeners
signinBtn.addEventListener('click', signin);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') signin();
});

signoutBtn.addEventListener('click', signout);

newRoomBtn.addEventListener('click', () => {
  const room = prompt('New room name:')?.trim();
  if (room) {
    post('/new-room', { room }).then(() => switchRoom(room));
  }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
