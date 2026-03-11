# Demos with https://github.com/ralscha/jcentserver-client

Additional Centrifugo-focused demos in this repository:

- `tennis-delta`: live tennis match center that compares the same match feed with and without Centrifugo delta compression.
- `recovery-lab`: reconnect and stream recovery demo that shows how missed publications are restored after a short disconnect.
- `presence-dashboard`: live presence roster that uses Centrifugo presence, presence stats, and join/leave events.

These demos expect the root Centrifugo instance from `docker-compose.yml` and `config.json`.

Suggested local ports:

- `tennis-delta/server`: `8091`
- `recovery-lab/server`: `8092`
- `presence-dashboard/server`: `8093`
- `tennis-delta/client`: `4174`
- `recovery-lab/client`: `4175`
- `presence-dashboard/client`: `4176`

Each client expects two Vite environment variables:

- `VITE_SERVER_URL`: Spring Boot server URL for the demo
- `VITE_CENTRIFUGO_BASE_ADDRESS`: usually `localhost:8000`

Example `.env.local` for `tennis-delta/client`:

```text
VITE_SERVER_URL=http://localhost:8091
VITE_CENTRIFUGO_BASE_ADDRESS=localhost:8000
```

