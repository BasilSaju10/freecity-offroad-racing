# Complete OFFRIDE game snapshot

This branch contains the current game with Gambler's Gutter, its full-resolution textures, 25 cars/trucks, 2 motorcycles, sounds, minimap, high/low gear, and automatic day/night weather. The current map uses 50% fewer standing trees.

To run the source: install Node.js 22 or newer, run `npm ci --include=dev`, then `npm run build`, then `npm start`. Open `http://127.0.0.1:5173`. For a solo loopback preview set `HOST=127.0.0.1` and `OFFRIDE_LOCAL_ONLY=1` before starting.

The complete ready-to-run ZIP is attached to the GitHub release. Extract it, install Node.js if needed, and use `START-OFFRIDE.cmd`; it opens the local game on port 5177 without requiring npm install or a build.

The latest loading preparation downloads all 27 vehicle files and the required map textures before play, decodes all six sounds, and reuses valid versioned files on later visits. `npm test` validates the full game.

This snapshot is on a separate branch; the Render production branch is unchanged. Original source and asset notices are retained below and in VEHICLE-NOTES.md.

---

# OFFRIDE

Play online: https://awd-offroad.onrender.com/

Offroad driving with 15 selectable vehicles, shared free roam and private races for up to five drivers.

## Run

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run build
npm start
```

Open http://localhost:5173. For another device on the same network, use the host computer's LAN address and port 5173.

## Online modes

- **Free roam:** one shared map, up to 32 connected drivers. Enter a driver name and choose Free roam.
- **Race rooms:** create a room, share its code or invite link, and invite up to four other drivers. Everyone selects a vehicle and marks ready. The host launches a five-second countdown and a randomly selected mountain sprint with exactly 10 ordered checkpoints. Each race and rematch selects a fresh continuous trail section for everyone in the room. There must be at least two ready, connected players.
- Race gates must be reached in order. The server owns room membership, countdown timing, checkpoint progress and results. Reset and vehicle changes are locked during the race. The host can end a race and open a rematch. Host ownership transfers if the host leaves.
- Sessions reconnect automatically, retaining their room slot for 20 seconds. After that the disconnected driver is removed. Rooms and results live in server memory and reset after a server restart or deploy.

Driving controls: WASD/arrows, Space handbrake, Space + W for a low-speed burnout, F driver camera, C camera cycle, V vehicle selection, R nearest-track reset outside races. Click the scene for mouse look; Escape releases it.

## Network model

One Node server serves the game and the `/multiplayer` WebSocket endpoint. One persistent browser identity owns one active connection. Opening another tab takes over the same car; the old tab stops publishing. Reconnects restore position instead of spawning a second car. Clients send bounded 20 Hz vehicle snapshots independently of rendering. Idle drivers have a server-seeded pose immediately; invalid cosmetic wheel values cannot discard a valid car pose. Other cars interpolate position and rotation, with animated wheels, steering and helmeted drivers. The four nearest cars within 160 m use full vehicle models; farther drivers use lightweight silhouettes. Player cars are non-colliding ghosts to avoid latency-induced impacts; map collisions remain local to each browser. Physics is client-simulated, with server-side packet bounds, ordering and checkpoint validation. This is casual multiplayer, not a competitive anti-cheat system.

No external database or realtime service is required. Keep **one server instance** unless a shared multiplayer backend is added. The service uses `PORT` and binds `0.0.0.0`. It sends heartbeat pings, retries client connections, automatically rejoins free roam after a server restart, and closes connections on shutdown.

## Render

Create a **Node web service** from this repository, using the Free compute plan, a single instance, build `npm ci --omit=dev`, start `npm start`, health check `/healthz`. `render.yaml` records the same configuration. TLS connections automatically use WSS. Free services can sleep when idle, so the first load can take longer; in-memory sessions do not persist through sleep/restarts. Large car assets also take time to download on slower connections.

Editable Blender source files remain in the local project and are excluded from Git; runtime GLB models are committed.

## Checks

`npm test` runs the existing vehicle/map checks and the multiplayer integration suite. `node validate-multiplayer.mjs` independently tests shared free roam, private-room isolation, the five-player limit, host-only ready starts, ordered checkpoints, results, rematches, reconnects and host transfer using real WebSocket clients.

Vehicle/model editing details, supplied asset information and original rights notices are preserved in [VEHICLE-NOTES.md](VEHICLE-NOTES.md).

## This release

- The player-count button opens the current online driver list. Lobby hosts can invite free-roam drivers; invitations expire after 30 seconds and offer Accept and Reject.
- A genuine byte-counted loader downloads the world, engine bundle and all 15 car GLBs before play. Hashed URLs and a persistent service-worker cache reuse unchanged car files on future visits and releases. Only three full local car models remain resident at once.
- The engine is bundled into one 3.4 MB module, and all heavy transfers use lossless gzip. The build report records the actual byte totals. The car on the loading screen follows that measured progress; 100% waits for initialization and the first rendered frame.
- The 2.95 km perimeter trail has five links to the existing route network, with matching terrain/colliders. Fixed START/FINISH arches and their colliders are removed.
- Spatial render chunks are hidden beyond 265 m behind fog that becomes opaque at 240 m; camera clipping is 280 m. Shadow resolution/distance, reflections, mud, dust, smoke, water and vehicle physics retain their existing settings.

Run `npm run build` after editing source/assets. `npm start` builds automatically only if the generated manifest or bundle is missing. Render's build command is `npm ci --include=dev && npm run build`; start command is `npm start`. Generated bundles and compressed transfers are build outputs, not source-control assets.


Active local map: Gambler’s Gutter by OwnTheBanks, supplied by the user. The standing-tree placements are reduced from 5,410 to 2,705. Assets live in assets/gamblers; the old map is retained as an unused reference and is excluded from downloads. Original texture resolution is retained, BC7 blocks/mipmaps are used directly when supported, and BC4/BC5 texture channels are shared without RGBA expansion. Two source references are absent from the uploaded ZIP: t_gray_bt.png and garbage_n.dds; those channels use neutral/geometric fallback values. Terrain rendering uses OFFRIDE’s renderer rather than BeamNG’s shader implementation. Fog ends at 145 m, scenery chunks cull at 170 m, and the camera clips at 180 m. Run npm run test:map for active-map collision, reset, asset, and race-course checks.


Loading optimization: the loading screen now waits for all 27 vehicle files, all map geometry, the active GPU texture format, six decoded audio clips, fonts, and the first frame. Completed versioned downloads are retained across launches, partial files are rejected, and an embedded-browser compatible buffered cache write is available when streaming cache writes are unsupported. Stale entries are pruned only inside the game cache. Run npm run test:loading for dependency coverage, warm-cache reuse, incomplete-download rejection, storage fallback, and audio preparation checks. Rendering settings, map textures, vehicle handling, gear limits and HUD are unchanged.
