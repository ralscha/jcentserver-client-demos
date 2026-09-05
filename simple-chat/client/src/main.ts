import {Centrifuge, TransportEndpoint} from 'centrifuge';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

interface ChatMessage {
    id: string;
    text: string;
    sentAt: string;
}

const logDiv = document.getElementById('log') as HTMLDivElement;
const msgInput = document.getElementById('msgInput') as HTMLInputElement;
const sentMessages = new Set<string>();

function transports(): TransportEndpoint[] {
    return [
        {transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${centrifugoBase}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${centrifugoBase}/connection/sse`}
    ];
}

function show(message: ChatMessage, me: boolean) {
    const msgAlign = me ? 'right' : 'left';
    const item = document.createElement('div');
    item.className = `blockquote-${msgAlign}`;
    item.append(document.createTextNode(message.text), document.createElement('br'));
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = message.sentAt;
    item.appendChild(time);
    logDiv.prepend(item);
}

async function sendMessage() {
    const value = msgInput.value;
    if (value) {
        const message: ChatMessage = {
            id: crypto.randomUUID(),
            text: value,
            sentAt: new Date().toLocaleTimeString()
        };

        sentMessages.add(message.id);

        const response = await fetch(`${serverUrl}/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            sentMessages.delete(message.id);
            throw new Error(`Could not send message: ${response.status}`);
        }

        msgInput.value = '';
    }
}

async function main() {
    const response = await fetch(`${serverUrl}/centrifugo-token`);
    if (!response.ok) {
        throw new Error(`Could not fetch token: ${response.status}`);
    }
    const token = await response.text();

    const centrifuge = new Centrifuge(transports(), {token});

    const sub = centrifuge.newSubscription('chat');
    sub.on('publication', ctx => {
        const msg = ctx.data as ChatMessage;
        const me = sentMessages.delete(msg.id);
        show(msg, me);
    });
    sub.subscribe();

    centrifuge.connect();

    msgInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            sendMessage().catch(console.error);
        }
    });

    document.getElementById('sendButton')!.addEventListener('click', () => {
        sendMessage().catch(console.error);
    });
}

main().catch(console.error);
