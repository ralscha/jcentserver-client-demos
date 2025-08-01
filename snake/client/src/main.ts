import {Centrifuge, TransportEndpoint} from 'centrifuge';
import {v4 as uuidv4} from 'uuid';

interface Location {
    x: number;
    y: number;
}

interface SnakeData {
    id: string;
    color: string;
    body: Location[];
}

interface SnakeMessage {
    type: 'join' | 'leave' | 'update' | 'dead' | 'kill';
    data?: SnakeData[];
    id?: string;
}

class Snake {
    snakeBody: Location[] = [];
    color: string = '';

    constructor(color: string, body: Location[]) {
        this.color = color;
        this.snakeBody = body;
    }

    draw(context: CanvasRenderingContext2D, gridSize: number): void {
        for (const segment of this.snakeBody) {
            context.fillStyle = this.color;
            context.fillRect(segment.x, segment.y, gridSize, gridSize);
        }
    }
}
type TimeoutHandle = ReturnType<typeof setTimeout>;
class Game {
    fps = 30;
    centrifuge: Centrifuge | null = null;
    nextFrame: (() => void) | null = null;
    interval: TimeoutHandle | null = null;
    direction = 'none';
    gridSize = 10;
    entities: { [key: string]: Snake } = {};
    context: CanvasRenderingContext2D | null = null;
    playerId: string;
    isConnected = false;
    hasJoined = false;

    constructor() {
        this.playerId = uuidv4();
    }

    initialize(): void {
        const canvas = document.getElementById('playground') as HTMLCanvasElement;
        if (!canvas.getContext) {
            Console.log('Error: 2d canvas not supported by this browser.');
            return;
        }
        this.context = canvas.getContext('2d');

        // Setup keyboard event listeners
        window.addEventListener('keydown', (e) => {
            const code = e.code;
            if ((code === 'ArrowLeft' || code === 'ArrowUp' || code === 'ArrowRight' || code === 'ArrowDown') && this.hasJoined) {
                e.preventDefault();
                switch (code) {
                    case 'ArrowLeft':
                        if (this.direction !== 'east') this.setDirection('west');
                        break;
                    case 'ArrowUp':
                        if (this.direction !== 'south') this.setDirection('north');
                        break;
                    case 'ArrowRight':
                        if (this.direction !== 'west') this.setDirection('east');
                        break;
                    case 'ArrowDown':
                        if (this.direction !== 'north') this.setDirection('south');
                        break;
                }
            }
        }, false);

        // Setup join button
        const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
        joinBtn.addEventListener('click', () => {
            if (this.isConnected && !this.hasJoined) {
                this.joinGame();
            }
        });

        this.connect();
    }

    setDirection(direction: string): void {
        this.direction = direction;

        // Send direction change to server
        fetch(`${import.meta.env.VITE_SERVER_URL}/direction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerId: this.playerId,
                direction: direction
            })
        }).catch(error => {
            Console.log('Error sending direction: ' + error);
        });
    }

    async joinGame(): Promise<void> {
        try {
            const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({playerId: this.playerId})
            });

            if (response.ok) {
                this.hasJoined = true;
                const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
                joinBtn.textContent = 'Joined Game';
                joinBtn.disabled = true;
                this.startGameLoop();
            } else {
                Console.log('Failed to join game');
            }
        } catch (error) {
            Console.log('Error joining game: ' + error);
        }
    }

    async leaveGame(): Promise<void> {
        if (this.hasJoined) {
            try {
                await fetch(`${import.meta.env.VITE_SERVER_URL}/leave`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({playerId: this.playerId})
                });
                this.hasJoined = false;
            } catch (error) {
                Console.log('Error leaving game: ' + error);
            }
        }
    }

    startGameLoop(): void {
        if (typeof window.requestAnimationFrame === 'function') {
            this.nextFrame = () => {
                requestAnimationFrame(() => this.run());
            };
        } else {
            this.interval = setInterval(() => this.run(), 1000 / this.fps);
        }
        if (this.nextFrame !== null) {
            this.nextFrame();
        }
    }

    stopGameLoop(): void {
        this.nextFrame = null;
        if (this.interval !== null) {
            clearInterval(this.interval);
        }
    }

    draw(): void {
        if (this.context) {
            this.context.clearRect(0, 0, 640, 480);
            for (const id in this.entities) {
                this.entities[id].draw(this.context, this.gridSize);
            }
        }
    }

    addSnake(id: string, color: string, body: Location[]): void {
        this.entities[id] = new Snake(color, body);
    }

    updateSnake(id: string, snakeBody: Location[]): void {
        if (typeof this.entities[id] !== "undefined") {
            this.entities[id].snakeBody = snakeBody;
        }
    }

    removeSnake(id: string): void {
        delete this.entities[id];
    }

    run(): void {
        this.draw();
        if (this.nextFrame !== null) {
            this.nextFrame();
        }
    }

    transports(): TransportEndpoint[] {
        return [
            {
                transport: 'websocket',
                endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`
            },
            {
                transport: 'http_stream',
                endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`
            },
            {
                transport: 'sse',
                endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`
            }
        ];
    }

    async connect(): Promise<void> {
        try {
            // Get JWT token from server
            const tokenResponse = await fetch(`${import.meta.env.VITE_SERVER_URL}/token`);
            const token = await tokenResponse.text();

            this.centrifuge = new Centrifuge(this.transports(), {
                token: token
            });

            this.centrifuge.on('connecting', () => {
                this.updateStatus('Connecting...', false);
            });

            this.centrifuge.on('connected', () => {
                this.isConnected = true;
                this.updateStatus('Connected', true);

                const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
                joinBtn.disabled = false;
            });

            this.centrifuge.on('disconnected', () => {
                this.isConnected = false;
                this.updateStatus('Disconnected', false);
                this.stopGameLoop();

                const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
                joinBtn.disabled = true;

                if (this.hasJoined) {
                    this.leaveGame();
                }
            });

            this.centrifuge.on('error', (error: any) => {
                Console.log('Connection error: ' + error.message);
            });

            // Subscribe to snake channel
            const subscription = this.centrifuge.newSubscription('snake');

            subscription.on('publication', (ctx: any) => {
                const packet = ctx.data as SnakeMessage;

                switch (packet.type) {
                    case 'update':
                        if (packet.data) {
                            for (const snakeData of packet.data) {
                                this.updateSnake(snakeData.id, snakeData.body);
                            }
                        }
                        break;
                    case 'join':
                        if (packet.data) {
                            for (const snakeData of packet.data) {
                                this.addSnake(snakeData.id, snakeData.color, snakeData.body);
                            }
                        }
                        break;
                    case 'leave':
                        if (packet.id) {
                            this.removeSnake(packet.id);
                        }
                        break;
                    case 'dead':
                        Console.log('Your snake is dead!');
                        this.direction = 'none';
                        break;
                    case 'kill':
                        Console.log('Head shot!');
                        break;
                }
            });

            subscription.subscribe();
            this.centrifuge.connect();

        } catch (error) {
            Console.log('Failed to connect: ' + error);
            this.updateStatus('Connection failed', false);
        }
    }

    updateStatus(message: string, connected: boolean): void {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.innerHTML = `<span class="${connected ? 'connected' : 'disconnected'}">${message}</span>`;
        }
    }
}

class Console {
    static log(message: string): void {
        const console = document.getElementById('console');
        if (console) {
            const p = document.createElement('p');
            p.style.overflowWrap = 'break-word';
            p.innerHTML = message;
            console.appendChild(p);
            while (console.childNodes.length > 25) {
                const firstChild = console.firstChild;
                if (firstChild) {
                    console.removeChild(firstChild);
                }
            }
            console.scrollTop = console.scrollHeight;
        }
    }
}

// Initialize game when DOM is loaded
const game = new Game();
game.initialize();

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
    game.leaveGame();
});
