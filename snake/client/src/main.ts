import {Centrifuge, TransportEndpoint} from 'centrifuge';
import {v4 as uuidv4} from 'uuid';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

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

interface JoinGameResponse {
    snakeId: string;
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
    snakeId: string | null = null;
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
        void fetch(`${serverUrl}/direction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerId: this.playerId,
                direction: direction
            })
        }).then((response) => {
            if (!response.ok) {
                throw new Error(`Direction change failed with status ${response.status}`);
            }
        }).catch(error => {
            Console.log('Error sending direction: ' + error);
        });
    }

    async joinGame(): Promise<void> {
        const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
        joinBtn.disabled = true;
        try {
            const response = await fetch(`${serverUrl}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({playerId: this.playerId})
            });

            if (response.ok) {
                const result = await response.json() as JoinGameResponse;
                this.snakeId = result.snakeId;
                this.hasJoined = true;
                joinBtn.textContent = 'Joined Game';
                this.startGameLoop();
            } else {
                throw new Error(`Join failed with status ${response.status}`);
            }
        } catch (error) {
            Console.log('Error joining game: ' + error);
            joinBtn.disabled = !this.isConnected;
        }
    }

    async leaveGame(): Promise<void> {
        if (this.hasJoined) {
            try {
                const response = await fetch(`${serverUrl}/leave?playerId=${encodeURIComponent(this.playerId)}`, {
                    method: 'POST'
                });
                if (!response.ok) {
                    throw new Error(`Leave failed with status ${response.status}`);
                }
                this.hasJoined = false;
                this.snakeId = null;
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
            this.interval = null;
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
                endpoint: `ws://${centrifugoBase}/connection/websocket`
            },
            {
                transport: 'http_stream',
                endpoint: `http://${centrifugoBase}/connection/http_stream`
            },
            {
                transport: 'sse',
                endpoint: `http://${centrifugoBase}/connection/sse`
            }
        ];
    }

    async connect(): Promise<void> {
        try {
            // Get JWT token from server
            const tokenResponse = await fetch(`${serverUrl}/token`);
            if (!tokenResponse.ok) {
                throw new Error(`Could not fetch token: ${tokenResponse.status}`);
            }
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
                    void this.leaveGame();
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
                        if (packet.id === this.snakeId) {
                            Console.log('Your snake is dead!');
                            this.direction = 'none';
                        }
                        break;
                    case 'kill':
                        if (packet.id === this.snakeId) {
                            Console.log('Head shot!');
                        }
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
            const status = document.createElement('span');
            status.className = connected ? 'connected' : 'disconnected';
            status.textContent = message;
            statusElement.replaceChildren(status);
        }
    }
}

class Console {
    static log(message: string): void {
        const console = document.getElementById('console');
        if (console) {
            const p = document.createElement('p');
            p.style.overflowWrap = 'break-word';
            p.textContent = message;
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
    if (game.hasJoined) {
        navigator.sendBeacon(`${serverUrl}/leave?playerId=${encodeURIComponent(game.playerId)}`);
    }
});
