# Hosting and runtime options for a hobby-scale 1v1 backend / signaling layer

- Ticket: GitHub issue #2 "Research hosting and runtime options" (parent map: #1)
- Research date: 2026-11-17. All facts below were read from the vendor's own docs or pricing pages on that date. Prices, free tiers and limits change; re-check before committing.
- Scope: findings and trade-offs only, no recommendation.
- Convention for gaps: where a primary page did not state something, it is listed as "not stated" rather than filled in from memory.

## 1. Summary table

| Option | Type | Free tier (today) | Cheapest paid | WebSocket | Notes |
|---|---|---|---|---|---|
| Trystero (nostr/mqtt/torrent) | P2P, no own server | Free, uses public relays | n/a | n/a (WebRTC data channels; relays do signaling only) | About 10-15% of connections may need TURN (Trystero's estimate) |
| PeerJS + PeerServer | P2P, free cloud or self-host | "free cloud server" (limits not documented on peerjs.com) | self-host | n/a | Public cloud server SLA/limits not stated |
| Cloudflare Workers + Durable Objects | Serverless, room per DO | Yes, SQLite-backed DOs only: 100k req/day | $5/month Workers Paid | Yes, Hibernation API | Effect v4 has no first-party Cloudflare platform package |
| Fly.io | Server-full | No free tier ($1 trial credit, 7 days) | About $2.19/month (shared-cpu-1x 256MB) | Not stated on the pages read | Bill under $5/month waived for personal orgs |
| Railway | Server-full | Free plan $1/month credit; one-time $5 trial credit | Hobby $5/month incl. $5 usage | Yes | |
| Render | Server-full | Free web service, 750 h/month, spins down after 15 min | Starter $7/month | Yes | Cold start about 1 minute on free |
| Hetzner Cloud VPS | Server-full | None | From EUR 5.49/month (EU) | Whatever you run | You operate it |
| Home machine + Cloudflare Tunnel | Server-full | Pricing not stated on page read | n/a | Not stated on pages read | Quick tunnels: no uptime guarantee, 200 in-flight requests |
| Supabase Realtime / Pusher / Ably | Hosted realtime relay | Supabase 200 conns; Pusher 100 conns, 200k msgs/day; Ably 500 MAU | Pusher $49, Ably $29, Supabase Pro | Yes (their SDKs) | Relay, not game logic |

## 2. Peer-to-peer, no own server

### 2.1 Trystero

Source: <https://github.com/dmotz/trystero> and its `docs/` (`signaling.md`, `troubleshooting.md`, `server-side.md`).

- Described as "Instant peer-to-peer multiplayer for the web, no server required". Peers are introduced through "decentralized public relays"; app data then goes peer to peer.
- Signaling strategies and client sizes (`signaling.md`, Brotli):
  - Nostr: zero setup, 5 default relays, about 46.3 KB.
  - MQTT: zero setup, 4 default brokers, about 122.0 KB.
  - BitTorrent: zero setup, 3 default trackers, about 42.6 KB.
  - Supabase (about 85.8 KB) and Firebase (about 81.6 KB): your own project.
  - `ws-relay`: self-hosted Node WebSocket pub/sub relay (Node 22+), about 41.5 KB, with optional rate guards.
- The docs give no explicit availability warning for the public relays; they rely on redundancy across several relays. The relay URL list is in `defaultRelayUrls` and was not listed in the docs read. Treat public relays as best-effort with no SLA.
- Relays only see hashed room topics and encrypted SDP/ICE handshakes. `appId` should be namespaced (a domain you control) to avoid topic collisions on shared relays.
- NAT traversal (`troubleshooting.md`):
  - Defaults use Google and Cloudflare STUN servers.
  - The docs estimate "roughly 10-15%" of connections block UDP hole punching (corporate firewalls, dorm networks, carrier-grade NAT, some VPNs). This is Trystero's own estimate, not an independently measured figure.
  - TURN is configured via `turnConfig`. Listed hosted options: Cloudflare Realtime TURN, Metered Open Relay. Self-hosted: coturn, eturnal, Pion TURN, Violet.
  - Docs advise short-lived TURN credentials, minted by a small serverless function, rather than long-lived credentials in frontend code. This implies a minimal server component if TURN is wanted.
- Headless use (`server-side.md`): Node 22+/Bun/Deno work with a WebRTC polyfill (e.g. `werift`). A headless peer can act as an authoritative referee using `roles()`. This is a possible path to add a server peer later without changing the transport.
- Maintenance: copyright 2026, 1,424 commits, 2 open issues; an "Upgrading to 0.27.0" guide exists. Exact latest version not stated on the page read.
- Trade-off: no infrastructure to run, but connection reliability depends on third-party public relays and on STUN/TURN; there is no server-side authority unless one peer acts as host.

### 2.2 PeerJS

Sources: <https://peerjs.com/>, <https://peerjs.com/docs/>, <https://github.com/peers/peerjs-server>.

- MIT-licensed WebRTC wrapper; the site says "use our free cloud server or host your own PeerServer". PeerServer provides "session metadata and candidate signaling".
- The pages read give no availability guarantee, usage limits or hostname for the free cloud server, and no default STUN/TURN config or TURN example (not stated).
- Self-hosting: `npm install peer -g` then `peerjs --port 9000 --key peerjs --path /myapp`, or `docker run -p 9000:9000 -d peerjs/peerjs-server`. Defaults include `concurrent_limit` 5000, `alive_timeout` 60000 ms, `expire_timeout` 5000 ms.
- Trade-off: simpler API and a ready signaling server, but the free public server is a third-party service with no documented SLA, and a self-hosted PeerServer is a stateful Node process that needs one of the server-full options below.

### 2.3 STUN/TURN reliability

- Cloudflare Realtime TURN: <https://developers.cloudflare.com/realtime/turn/> and <https://developers.cloudflare.com/realtime/sfu/pricing/>.
  - STUN: `stun.cloudflare.com:3478` over UDP.
  - TURN is billed at $0.05 per GB egress; the first 1,000 GB per month is free, shared between SFU and TURN. (The TURN page says TURN is "free of charge when used together with the Realtime SFU"; the pricing page states the shared 1,000 GB allowance. Confirm which applies to TURN-only use.)
  - Per-allocation limits: roughly 5-10 kpps and 50-100 Mbps; exceeding drops packets. A card game's traffic is far below this.
- webrtc.org (<https://webrtc.org/getting-started/turn-server>) says most WebRTC apps need a relay because clients often cannot connect directly (exception: same local network). It gives no figures.
- The only quantitative number found in primary sources is Trystero's 10-15% estimate (2.1). No vendor-neutral measurement was found; treat it as an order of magnitude.
- Implication: pure P2P with STUN only leaves roughly one pairing in 7-10 potentially unable to connect; closing this gap needs a TURN service and some way to mint credentials.

## 3. Server-full and serverless options

### 3.1 Cloudflare Workers + Durable Objects (one DO per Room)

Sources: <https://developers.cloudflare.com/durable-objects/platform/pricing/>, <https://developers.cloudflare.com/durable-objects/platform/limits/>, <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>, <https://developers.cloudflare.com/workers/platform/pricing/>.

- Free plan: Durable Objects are available on Workers Free with the SQLite storage backend only (the key-value backend needs Paid). Free daily limits (reset 00:00 UTC): 100,000 requests, 13,000 GB-s duration, 5 M rows read, 100,000 rows written, 5 GB SQL storage. Exceeding a limit makes further operations of that type fail with an error.
- Workers Free: 100,000 requests/day, 10 ms CPU per invocation. Paid: $5/month minimum (10 M requests and 30 M CPU-ms included).
- DO paid pricing: 1 M requests/month included then $0.15/M; 400,000 GB-s included then $12.50/M GB-s; SQLite storage billing began January 2026.
- WebSocket billing: the upgrade counts as one request; incoming messages are billed 20:1 (100 messages = 5 requests); outgoing messages are free; idle hibernatable objects are not billed for duration. Using plain `accept()` instead of hibernation bills duration for the whole connection.
- The WebSocket Hibernation API is the recommended path; "thousands of clients per instance". No numeric connection cap is documented. Per-connection attachment limit is 16,384 bytes. In-memory state is lost on hibernation, so game state would live in DO storage or be rebuilt. Docs suggest batching messages every 50-100 ms.
- Limits: 1,000 requests/second soft limit per object; WebSocket message size 32 MiB; 30 s CPU per request by default. (The limits page is inconsistent about SQLite storage per DO on Free, 10 GB vs 1 GB; irrelevant at game scale.)
- Rough scale check: a 1v1 Room is 2 sockets and a few hundred small messages per Game. The free daily budget (100k requests, with 20:1 message billing) is large relative to hobby traffic, but a hard-stop failure at the cap is the failure mode on free. This is an estimate, not a documented figure.
- Room library: `cloudflare/partykit` (PartyServer) provides a DO base class with WebSocket handling, lifecycle hooks and broadcast; the README marks it work in progress and does not spell out the default room-to-DO mapping.
- Trade-off: no servers to operate, naturally one authority per Room, cheap; locks the backend to Cloudflare's runtime (workerd), and hibernation shapes the code.

### 3.2 Fly.io

Sources: <https://docs.fly.io/about/pricing>, <https://docs.fly.io/launch/autostop-autostart/>.

- No free tier. New orgs get $1 of credit lasting 7 days or until used; a credit card is then required. Personal orgs with a monthly bill under $5 have it waived.
- shared-cpu-1x 256MB: $2.19/month (30 days continuous) in `iad`/`ewr`, billed per second. Outbound $0.02/GB in North America/Europe; inbound free. Volumes $0.15/GB/month.
- Auto stop/start (`auto_stop_machines`, `auto_start_machines`, `min_machines_running`) allows scale-to-zero with about 2 s+ cold start. The pages read do not mention WebSockets or say how open connections interact with stopping (not verified from primary docs here).

### 3.3 Railway

Sources: <https://railway.com/pricing>, <https://docs.railway.com/networking/public-networking/specs-and-limits>.

- Plans: Free Trial ($5 one-time credit, 30 days, no card); Free ($1/month credit, 1 vCPU / 0.5 GB max per service); Hobby $5/month including $5 usage; Pro $20/workspace.
- Usage: about $20/vCPU-month, $10/GB-month memory, egress $0.05/GB, metered per second.
- WebSockets are supported over HTTP/1.1 and exempt from request duration/inactivity limits ("can stay open indefinitely, even while idle").

### 3.4 Render

Sources: <https://render.com/docs/free>, <https://render.com/docs/websocket>, <https://render.com/docs/compute-plans>, <https://render.com/pricing>.

- Free web service: 750 instance hours per workspace per month. Spins down after 15 minutes without inbound traffic (WebSocket messages on existing connections count); spin-up on the next HTTP request or new WebSocket connection takes about one minute. Single instance, ephemeral filesystem, 0.1 CPU / 512 MB.
- Starter: 0.5 CPU / 512 MB, $7/month (read from search results for render.com/pricing; the fetched pricing page body rendered without amounts).
- WebSockets supported, no maximum connection duration; Render recommends ping/pong keepalives and reconnect with backoff.
- Trade-off: the cold start is a real UX problem for a link-sharing flow on the free tier; a paid plan removes it.

### 3.5 Small VPS (Hetzner as example)

Sources: <https://www.hetzner.com/cloud/regular-performance/>, <https://docs.hetzner.com/cloud/servers/overview/>.

- From EUR 5.49/month excl. VAT for CPX02 (1 vCPU, 1 GB, 20 GB NVMe, 20 TB traffic) in the EU (HEL1). US locations are much pricier on the page (CPX11 at EUR 17.99 with 1 TB). A primary IPv4 costs EUR 0.50/month extra.
- You operate the OS, TLS, restarts and deploys. Maximum flexibility (any runtime, long-lived in-memory Room state).

### 3.6 Home machine behind a tunnel

Sources: <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/> and its `trycloudflare` page.

- `cloudflared` makes outbound-only connections, so no open inbound ports. Quick Tunnels (`trycloudflare.com`) need no account but have no uptime guarantee, a new hostname per run, a 200 in-flight request limit (429 beyond), and no SSE support.
- The pages read do not state whether WebSockets work through Tunnels or whether Tunnel is free (not verified). Needs testing.
- Trade-off: zero cost and full control, but availability is whatever your home machine and network provide.

### 3.7 Hosted realtime relays (no game logic hosted)

- Supabase Realtime (<https://supabase.com/docs/guides/realtime/limits>): Free 200 concurrent connections, 100 messages/s, 256 KB broadcast payload; Pro 500 connections, 500 msg/s, 3,000 KB.
- Pusher Channels Sandbox (<https://pusher.com/channels/pricing/>): 100 concurrent connections, 200k messages/day; next plan Startup $49/month (500 connections, 1 M messages/day).
- Ably (<https://ably.com/pricing>): Free 500 monthly active users; Pro from $29/month (1K MAU). Message/connection limits for Free were not on the fetched page.
- These relay messages but do not host rules or validate decks; a peer would still have to act as authority unless paired with a server. Trystero can also use Supabase as a signaling strategy.

## 4. Effect v4 status and runtime fit

Sources: <https://effect.website/blog>, <https://effect.website/blog/releases/effect/40>, <https://github.com/Effect-TS/effect> (README, `MIGRATION.md`).

- Status: Effect 4.0 went stable on 30 September 2026 (blog post "Effect 4.0"). Effect 4.1 released 20 October 2026; 4.1.3 and 4.1.4 are mentioned in "This Week in Effect" #144 (16 November 2026). `effect-smol` is archived; v4 now lives on `main` of `Effect-TS/effect`, v3 on the `v3` branch.
- Support: 4.x is an LTS release. Bug fixes until September 2029 or one year after 5.0, whichever is later; security fixes until September 2029 or two years after 5.0.
- Maturity caveats: the 4.0 post says some newer modules are tagged `@stability unstable`/`experimental` and may change in minor or patch releases. `MIGRATION.md` lists as unstable: `ai`, `cli`, `cluster`, `devtools`, `eventlog`, `http`, `http-api`, `jsonschema`, `observability`, `persistence`, `process`, `reactivity`, `rpc`, `schema`, `socket`, `sql`, `workflow`, `workers`. That includes `rpc` and `socket`, the modules a multiplayer server would most likely use. Secondary coverage (InfoQ, seen via search only) reports some modules shipped untagged in 4.0 and a patch release followed on 8 October; not verified against the blog.
- Size/dependencies: a minimal program is 7.1 kB min+gzip vs 35.6 kB in v3 (blog); core `effect` has zero runtime dependencies. Performance claims in the post are Effect's own figures.
- Runtime support (README): Node.js 22.19+ is the general minimum; TypeScript 5.9+ required (TS 7 recommended), `strict` required. Platform packages exist for browser, Bun, Deno and Node.
- Node: covered by `@effect/platform-node` (plus Bun/Deno). Fits all the server-full options above (Fly, Railway, Render, VPS, home).
- Cloudflare Workers/Durable Objects: the README lists no dedicated first-party Cloudflare platform package; Cloudflare appears only as D1, Durable Objects SQLite and AI provider packages. The 4.0 post and migration guide do not mention Workers. Community libraries exist (`effect-cf`, `effectful-cloudflare`, Alchemy; seen via web search only, not verified). The `effect` core being dependency-free and small makes workerd plausible, but that is inferred, not documented by Effect on the pages read.
- Client side: the client is a static, no-build vanilla JS site, so Effect would only enter the client if a build step and TypeScript were introduced; the parent map says to add Effect only once a server is chosen.

## 5. Static hosting for the client

### 5.1 GitHub Pages

Source: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>.

- Limits: published site up to 1 GB; 100 GB/month soft bandwidth cap; 10 builds/hour soft cap (not applicable with a custom Actions workflow); 10-minute deployment timeout.
- Terms: not intended for commercial sites (online business, e-commerce, commercial SaaS). A free hobby game falls outside that, but worth keeping in mind if monetised. The page read did not state repo visibility requirements for free plans.
- A backend would be on another origin, so it needs CORS and a `wss://` URL.

### 5.2 Cloudflare Pages / Workers static assets

Sources: <https://developers.cloudflare.com/pages/platform/limits/>, <https://developers.cloudflare.com/pages/framework-guides/>, <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>.

- Pages Free: 500 builds/month, 20,000 files per site, 25 MiB per asset, 100 projects. No bandwidth or static-request limits listed.
- Cloudflare's Pages docs now say "Start new projects with Workers" and that Workers supports most Pages use cases. Static-asset requests on Workers are "free and unlimited".
- If the backend is Durable Objects, the static client and the Room Worker can be one Workers project on the same origin (no CORS).

## 6. Trade-offs at a glance

- P2P (Trystero/PeerJS) vs server: P2P needs no hosting and fits the static-client constraint, but there is no neutral authority (hidden hand, shuffle and deck validation would have to be peer-enforced), public signaling relays are best-effort, and roughly 10-15% of pairings (Trystero's estimate) need TURN, which needs credentials minted by something server-like.
- Cheapest always-on server: Fly ($2.19/month shared-cpu-1x) or Hetzner (EUR 5.49/month); Railway Hobby $5/month; Render Starter $7/month. Free server tiers exist (Render free, Railway free credit) but with cold starts or a tiny credit.
- Serverless: Durable Objects give a natural Room per DO, hibernation and a usable free tier, at the cost of Cloudflare lock-in and a weaker Effect v4 story.
- Effect v4: stable and LTS as of Sep 2026, but `rpc`/`socket`/`http` are still unstable-tagged; Node is first-class; Workers is community-supported only.
- Static client: GitHub Pages is adequate with no backend; Cloudflare static assets make most sense if Cloudflare is also chosen for the backend.

## 7. Open items not verifiable from primary sources read

- Fly.io WebSocket support and its interaction with autostop (pages read were silent).
- Cloudflare Tunnel (named, non-quick) pricing and WebSocket behaviour.
- PeerJS free cloud server limits/SLA.
- Whether TURN-only use on Cloudflare Realtime is free up to 1,000 GB or only alongside the SFU.
- Effect on Cloudflare Workers: no first-party documentation found; a test is needed.
- Ably free plan message/connection limits.
- Render Starter price was read from search results for render.com/pricing; the fetched pricing page rendered without amounts.
