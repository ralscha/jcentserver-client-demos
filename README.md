# jcentserver-client demos

Runnable examples for [`jcentserver-client`](https://github.com/ralscha/jcentserver-client) and Centrifugo 6.

| Demo | What it demonstrates | Server port | Client port |
| --- | --- | ---: | ---: |
| `chat` | Multi-room chat with cached history | 8080 | 5173 |
| `datachannel` | WebRTC data-channel signaling | 8080 | 5173 |
| `gauge` | Live gauge telemetry | 8080 | 5173 |
| `iss` | ISS tracking with a server-side subscription | 8080 | 5173 |
| `map-cursors` | Ephemeral map-subscription cursors and server-side clear | 8094 | 4177 |
| `maps` | Live vehicle positions on a map | 8080 | 5173 |
| `pg-orders` | Transactional PostgreSQL stream broker and state recovery | 8096 | 4179 |
| `poll` | Persistent live poll | 8080 | 5173 |
| `presence-dashboard` | Presence, presence stats, and join/leave events | 8093 | 4176 |
| `recovery-lab` | Reconnect and publication recovery | 8092 | 4175 |
| `shared-poll-votes` | HMAC-authorized shared-poll tracking and publishing | 8095 | 4178 |
| `simple-chat` | Minimal real-time chat | 8080 | 5173 |
| `simple-chat-2` | Chat with participant counts and typing indicators | 8080 | 5173 |
| `smoothie` | Scrolling CPU telemetry charts | 8080 | 5173 |
| `snake` | Multiplayer snake game | 8080 | 5173 |
| `tennis-delta` | Plain versus Fossil delta-compressed match feeds | 8091 | 4174 |
| `whiteboard` | Collaborative pointer, touch, and pen drawing | 8080 | 5173 |

## Requirements

- Java 25
- Node.js 20.19+ or 22.12+
- Docker Compose
- A MapTiler API key for `iss` and `maps`

## Run a demo

Start the shared Centrifugo and PostgreSQL services from the repository root:

```shell
docker compose up -d
```

Then start one server and its matching client in separate terminals. For example:

```shell
cd chat/server
./mvnw spring-boot:run
```

```shell
cd chat/client
npm install
npm run dev
```

On Windows, use `mvnw.cmd` instead of `./mvnw`. The older demos share ports 8080 and 5173, so run only one of those pairs at a time. The six Centrifugo 6.8 feature demos use the dedicated ports in the table and can run together.

For `iss` and `maps`, create a client `.env.local` file containing:

```dotenv
VITE_MAPTILER_API_KEY=your-key
```

Every client also supports optional endpoint overrides:

```dotenv
VITE_SERVER_URL=http://localhost:8080
VITE_CENTRIFUGO_BASE_ADDRESS=localhost:8000
```

`pg-orders` requires the PostgreSQL service from the root Compose stack. Centrifugo creates its `cf_stream_*` functions and controller schema when it starts.
