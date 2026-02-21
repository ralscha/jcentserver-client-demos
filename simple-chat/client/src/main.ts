import {Centrifuge, TransportEndpoint} from 'centrifuge';

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
        {transport: 'websocket', endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`}
    ];
}

function show(message: ChatMessage, me: boolean) {
    const msgAlign = me ? 'right' : 'left';
    const msgLog = `<div class='blockquote-${msgAlign}'>${message.text}<br><span class='time'>${message.sentAt}</span></div>`;
    logDiv.innerHTML = msgLog + logDiv.innerHTML;
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

        await fetch(`${import.meta.env.VITE_SERVER_URL}/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(message)
        });

        msgInput.value = '';
    }
}

async function main() {
    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/centrifugo-token`);
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
