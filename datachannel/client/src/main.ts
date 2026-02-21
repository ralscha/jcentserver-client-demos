import { Centrifuge, TransportEndpoint } from 'centrifuge';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';
import './style.css';

const serverUrl = import.meta.env.VITE_SERVER_URL as string;

interface PeerInfo {
  rtcPeerConnection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface SignalingEvent {
  event: string;
  id?: string;
  receiver?: string;
  localDescription?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// Stable client ID stored in sessionStorage
let clientId = sessionStorage.getItem('clientId');
if (!clientId) {
  clientId = crypto.randomUUID();
  sessionStorage.setItem('clientId', clientId);
}

document.getElementById('myIdOutput')!.textContent = clientId;

// vis.js network
const nodes = new DataSet<{ id: string; label: string; color?: { background: string } }>();
const edges = new DataSet<{ id?: string; from: string; to: string }>();
const container = document.getElementById('peers')!;
new Network(container, { nodes, edges }, {});

// My own node (green)
nodes.add({ id: clientId, label: clientId, color: { background: '#C3E186' } });

const peers = new Map<string, PeerInfo>();

const configuration: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.stunprotocol.org:3478' }],
};

async function post(path: string, body: unknown) {
  await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function onIceCandidate(peerKey: string, event: RTCPeerConnectionIceEvent) {
  if (event.candidate) {
    post('/ice', { receiver: peerKey, id: clientId, candidate: event.candidate });
  }
}

function handleChannelStatusChange(peerKey: string, channel: RTCDataChannel) {
  const state = channel.readyState;
  if (state === 'open') {
    nodes.remove(peerKey);
    edges.remove(`${clientId}-${peerKey}`);
    nodes.add({ id: peerKey, label: peerKey });
    edges.add({ id: `${clientId}-${peerKey}`, from: clientId!, to: peerKey });

    // Add edges between this peer and all other known peers
    for (const key of peers.keys()) {
      if (key !== peerKey) {
        const existing = edges.get({
          filter: (e) =>
            (e.from === key && e.to === peerKey) || (e.from === peerKey && e.to === key),
        });
        if (!existing || existing.length === 0) {
          edges.add({ from: key, to: peerKey });
        }
      }
    }
  } else {
    nodes.remove(peerKey);
  }
}

function onDataChannelMessage(peerKey: string, event: MessageEvent) {
  const output = document.getElementById('output')!;
  output.innerHTML =
    `<p>Message '<strong>${event.data}</strong>' received from ${peerKey}</p>` + output.innerHTML;
}

function peerConnected(peerId: string) {
  if (peerId === clientId) return;

  const rtcPeerConnection = new RTCPeerConnection(configuration);
  rtcPeerConnection.onicecandidate = (e) => onIceCandidate(peerId, e);

  const dataChannel = rtcPeerConnection.createDataChannel('dataChannel');
  dataChannel.onopen = () => handleChannelStatusChange(peerId, dataChannel);
  dataChannel.onclose = () => handleChannelStatusChange(peerId, dataChannel);
  dataChannel.onmessage = (e) => onDataChannelMessage(peerId, e);

  rtcPeerConnection
    .createOffer()
    .then((offer) => rtcPeerConnection.setLocalDescription(offer))
    .then(() =>
      post('/offer', {
        receiver: peerId,
        id: clientId,
        localDescription: rtcPeerConnection.localDescription,
      }),
    )
    .catch(console.error);

  peers.set(peerId, { rtcPeerConnection, dataChannel });
}

function peerDisconnected(peerId: string) {
  const peer = peers.get(peerId);
  if (peer) {
    peer.dataChannel?.close();
    peer.rtcPeerConnection.close();
    peers.delete(peerId);
    nodes.remove(peerId);
  }
}

function offerReceived(msg: SignalingEvent) {
  const peerKey = msg.id!;
  const offer = msg.localDescription!;

  const rtcPeerConnection = new RTCPeerConnection(configuration);
  rtcPeerConnection.onicecandidate = (e) => onIceCandidate(peerKey, e);
  rtcPeerConnection.ondatachannel = (event) => {
    const dc = event.channel;
    dc.onopen = () => handleChannelStatusChange(peerKey, dc);
    dc.onclose = () => handleChannelStatusChange(peerKey, dc);
    dc.onmessage = (e) => onDataChannelMessage(peerKey, e);
    peers.set(peerKey, { rtcPeerConnection, dataChannel: dc });
  };

  rtcPeerConnection
    .setRemoteDescription(offer)
    .then(() => rtcPeerConnection.createAnswer())
    .then((answer) => rtcPeerConnection.setLocalDescription(answer))
    .then(() =>
      post('/answer', {
        receiver: peerKey,
        id: clientId,
        localDescription: rtcPeerConnection.localDescription,
      }),
    )
    .catch(console.error);

  peers.set(peerKey, { rtcPeerConnection });
}

function answerReceived(msg: SignalingEvent) {
  const peerKey = msg.id!;
  const answer = msg.localDescription!;
  const peer = peers.get(peerKey);
  if (peer) {
    peer.rtcPeerConnection.setRemoteDescription(answer).catch(console.error);
  }
}

function iceReceived(msg: SignalingEvent) {
  const peerKey = msg.id!;
  const ice = msg.candidate!;
  const peer = peers.get(peerKey);
  if (peer) {
    peer.rtcPeerConnection.addIceCandidate(ice).catch(console.error);
  }
}

function sendP2PMessage(msg: string) {
  const output = document.getElementById('output')!;
  output.innerHTML = `<p>Sent message '<strong>${msg}</strong>' to peers</p>` + output.innerHTML;
  for (const peer of peers.values()) {
    if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(msg);
    }
  }
}

// UI event handlers
const messageInput = document.getElementById('messageTa') as HTMLInputElement;
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendP2PMessage(messageInput.value);
    messageInput.value = '';
  }
});

document.getElementById('sendButton')!.addEventListener('click', () => {
  sendP2PMessage(messageInput.value);
  messageInput.value = '';
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
  const tokenResponse = await fetch(`${serverUrl}/centrifugo-token?clientId=${encodeURIComponent(clientId!)}`);
  const token = await tokenResponse.text();

  const centrifuge = new Centrifuge(transports(), { token });

  // Subscribe to personal channel for signaling messages
  const sub = centrifuge.newSubscription(`peer.${clientId}`);

  sub.on('publication', (ctx) => {
    const data = ctx.data as SignalingEvent;
    if (data.event === 'peer.connected') {
      peerConnected(data.id!);
    } else if (data.event === 'peer.disconnected') {
      peerDisconnected(data.id!);
    } else if (data.event === 'offer') {
      offerReceived(data);
    } else if (data.event === 'answer') {
      answerReceived(data);
    } else if (data.event === 'ice') {
      iceReceived(data);
    }
  });

  sub.subscribe();
  centrifuge.connect();

  // Notify the server that we are online
  centrifuge.on('connected', () => {
    post('/connect', { clientId });
  });

  // Notify the server on disconnect
  window.addEventListener('beforeunload', () => {
    navigator.sendBeacon(`${serverUrl}/disconnect`, JSON.stringify({ clientId }));
  });
}

init();
