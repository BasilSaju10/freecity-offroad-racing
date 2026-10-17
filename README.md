# FreeCity Offroad Racing

Offroad driving with 15 selectable vehicles, shared free roam and private races for up to five drivers.

## Run

Install Node.js 22 or newer, then run:

```sh
npm ci
npm start
```

Open http://localhost:5173. For another device on the same network, use the host computer's LAN address and port 5173.

## Online modes

- **Free roam:** one shared map, up to 32 connected drivers. Enter a driver name and choose Free roam.
- **Race rooms:** create a room, share its code or invite link, and invite up to four other drivers. Everyone selects a vehicle and marks ready. The host launches a five-second countdown and a mountain sprint. There must be at least two ready, connected players.
- Race gates must be reached in order. The server owns room membership, countdown timing, checkpoint progress and results. Reset and vehicle changes are locked during the race. The host can end a race and open a rematch. Host ownership transfers if the host leaves.
- Sessions reconnect automatically, retaining their room slot for 20 seconds. After that the disconnected driver is removed. Rooms and results live in server memory and reset after a server restart or deploy.

Driving controls: WASD/arrows, Space handbrake, Space + W for a low-speed burnout, F driver camera, C camera cycle, V vehicle selection, R nearest-track reset outside races. Click the scene for mouse look; Escape releases it.

## Network model

One Node server serves the game and the `/multiplayer` WebSocket endpoint. Clients send bounded 20 Hz vehicle snapshots. Other cars interpolate position and rotation, with animated wheels, steering and helmeted drivers. The four nearest cars within 160 m use full vehicle models; farther drivers use lightweight silhouettes. Player cars are non-colliding ghosts to avoid latency-induced impacts; map collisions remain local to each browser. Physics is client-simulated, with server-side packet bounds, ordering and checkpoint validation. This is casual multiplayer, not a competitive anti-cheat system.

No external database or realtime service is required. Keep **one server instance** unless a shared multiplayer backend is added. The service uses `PORT` and binds `0.0.0.0`. It sends heartbeat pings, retries client connections, and closes connections on shutdown.

## Render

Create a **Node web service** from this repository, using the Free compute plan, a single instance, build `npm ci --omit=dev`, start `npm start`, health check `/healthz`. `render.yaml` records the same configuration. TLS connections automatically use WSS. Free services can sleep when idle, so the first load can take longer; in-memory sessions do not persist through sleep/restarts. Large car assets also take time to download on slower connections.

Editable Blender source files remain in the local project and are excluded from Git; runtime GLB models are committed.

## Checks

`npm test` runs the existing vehicle/map checks and the multiplayer integration suite. `node validate-multiplayer.mjs` independently tests shared free roam, private-room isolation, the five-player limit, host-only ready starts, ordered checkpoints, results, rematches, reconnects and host transfer using real WebSocket clients.

Vehicle/model editing details, supplied asset information and original rights notices are preserved in [VEHICLE-NOTES.md](VEHICLE-NOTES.md).
