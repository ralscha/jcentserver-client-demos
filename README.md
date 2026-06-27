# Demos with https://github.com/ralscha/jcentserver-client

Additional Centrifugo-focused demos in this repository:

- `tennis-delta`: live tennis match center that compares the same match feed with and without Centrifugo delta compression.
- `recovery-lab`: reconnect and stream recovery demo that shows how missed publications are restored after a short disconnect.
- `presence-dashboard`: live presence roster that uses Centrifugo presence, presence stats, and join/leave events.
- `map-cursors`: Centrifugo 6.8 map subscription demo with ephemeral cursor state, server-assigned keys, TTL cleanup, and `sync`/`update` client events.
- `shared-poll-votes`: Centrifugo 6.8 shared poll demo with HMAC-authorized key tracking, backend refresh polling, and `shared_poll_publish` for immediate vote updates.
- `pg-orders`: Centrifugo 6.8 PostgreSQL stream broker demo. The Spring server writes kitchen orders to PostgreSQL and calls `cf_stream_publish` in the same transaction; the client uses SDK `getState` to load the database snapshot from a stream position.

These demos expect the root Centrifugo instance from `docker-compose.yml` and `config.json`.

Suggested local ports:

- `tennis-delta/server`: `8091`
- `recovery-lab/server`: `8092`
- `presence-dashboard/server`: `8093`
- `map-cursors/server`: `8094`
- `shared-poll-votes/server`: `8095`
- `pg-orders/server`: `8096`
- `tennis-delta/client`: `4174`
- `recovery-lab/client`: `4175`
- `presence-dashboard/client`: `4176`
- `map-cursors/client`: `4177`
- `shared-poll-votes/client`: `4178`
- `pg-orders/client`: `4179`

The demo clients are hardcoded for the local ports above and the root Centrifugo instance at
`localhost:8000`, so they can be started with `npm run dev` directly.

`pg-orders` additionally expects the root Docker Compose stack to be running. It uses `postgres:18-alpine`
on port `5432`, and Centrifugo creates the `cf_stream_*` and controller schema automatically on startup.
