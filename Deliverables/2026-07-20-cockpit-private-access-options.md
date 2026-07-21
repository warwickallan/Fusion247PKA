# Private phone access to the localhost Directus cockpit — options brief

**Author:** Pax (Researcher) · **Date:** 2026-07-20 · **For:** BUILD-014 campaign / Warwick
**Decision:** How to reach the Yoga-hosted Directus cockpit from Warwick's phone — private, authenticated, free-tier, no public exposure — without building anything yet.
**Constraint restated:** Read-only research. The approved boundary forbids public deployment, any purchase, or installing persistent infrastructure without Warwick's explicit approval. This brief recommends; it does not build.

---

## Executive summary

**Yes — one option fits the boundary cleanly: Tailscale (`tailscale serve`).** It is a private WireGuard mesh, genuinely free for one user, runs entirely from the Yoga (no separate host), never exposes anything to the public internet, and reaches the phone over an authenticated tailnet. Its only "asks" are the two the boundary explicitly reserves for Warwick: **approve a free account signup** (via an existing Google/Microsoft/GitHub identity) and **install the Tailscale app on the phone**. **Fallback: VS Code / GitHub dev tunnels** — no phone app at all (browser + a GitHub login he likely already has), private-by-default, free.

Every Yoga-hosted option shares one hard constraint: **the cockpit is reachable only while the Yoga is powered on and connected.** The only way to remove that constraint is to move the cockpit onto an always-on box — which itself trips the "no persistent infra / no purchase" boundary.

---

## Ranked recommendation

### 1. Tailscale — BEST FIT (recommended)
- **URL / auth:** `https://yoga.<tailnet>.ts.net` via `tailscale serve` (HTTPS, tailnet-only), or the plain MagicDNS name `http://yoga:8055`. Authentication is **device + identity based**: only devices logged into *Warwick's own tailnet* can reach it, and each device joins by signing in through an SSO identity provider (Google/Microsoft/GitHub). Nothing is on the public internet — `serve` is tailnet-private (distinct from `funnel`, which is the public mode; we do **not** use funnel). *(Confidence: High — Tailscale Serve docs + independent write-ups.)*
- **Where it deploys:** From the **Yoga**. No separate host. → Yoga-must-be-on applies.
- **Cost:** Free. The Personal plan is a real free tier (not a trial) covering MagicDNS, ACLs, and Serve; for a single user it is comfortably sufficient. *(Confidence: High — pricing page + multiple reviews. The Apr-2026 update reportedly widened it to ~6 users / unlimited personal devices; single-user need is far inside any version of the limit.)*
- **Install:** Yoga → Tailscale client. Phone → **Tailscale app** (App Store / Play Store).
- **Boundary fit:** private ✓ · authenticated ✓ · no public exposure ✓ · no purchase ✓ · no persistent infra ✓ (runs from the Yoga itself).
- **Reliability/latency:** Direct WireGuard mesh, low latency, self-reconnecting — well-suited to casual phone checks. Falls back to relay (DERP) if a direct path can't be made, still private.
- **The two Warwick approvals it needs:** a free account signup, and a phone-app install. Both are inside the boundary's "reserved for Warwick" set — flag, don't assume.

### 2. VS Code / GitHub dev tunnels — FALLBACK
- **URL / auth:** A `*.devtunnels.ms` forwarded-port URL served from Microsoft's edge. **Private by default** — hosting and connecting both require signing in with the same GitHub/Microsoft account; the port stays private unless you deliberately mark it public/`--allow-anonymous`. *(Confidence: High — VS Code + Microsoft Learn docs.)*
- **Where it deploys:** From the **Yoga** (VS Code CLI / Ports view). No separate host. → Yoga-must-be-on applies.
- **Cost:** Free within usage/bandwidth limits (fine for casual single-user checks).
- **Install:** Yoga → VS Code / its CLI (likely already present). Phone → **none** — just a browser + GitHub login. This is its edge over Tailscale: no new phone app.
- **Boundary fit:** private ✓ · authenticated ✓ (GitHub) · no public exposure ~✓ (served from Microsoft's public edge but private/auth-gated by default) · no purchase ✓ · no persistent infra ✓.
- **Weaknesses:** Dev-oriented tool (not a "product" for this), bandwidth caps, and the endpoint lives on a public Microsoft domain gated by auth rather than a true private mesh. Good enough as fallback; not as clean as Tailscale on "no public exposure."

---

## Options that DON'T fit the boundary (and why)

| Route | Where it runs | Auth | Blocking boundary failure |
|---|---|---|---|
| **Cloudflare Tunnel + Access** | `cloudflared` from Yoga | Access SSO (Google/GitHub/email OTP), free ≤50 users | **Needs you to own a domain in Cloudflare DNS** for a stable named tunnel (≈$10/yr = purchase) **and publishes a public hostname** (auth-gated, but internet-reachable at the edge). `TryCloudflare` gives a free random URL but it's **public + ephemeral**, "for testing not production." → fails *no purchase* + *no public exposure*. *(Confidence: High — Cloudflare One docs + community + independent posts.)* |
| **ngrok** | Agent from Yoga | Free tier = **public URL with a mandatory interstitial page**; real auth (OAuth) is a paid/traffic-policy feature | Free tier is 1 endpoint, 1 GB/mo, one static `*.ngrok-free.app` domain — but **public by default**. → fails *no public exposure*. *(Confidence: High — ngrok free-plan docs + pricing.)* |
| **Reverse SSH tunnel → cheap/Oracle-free VPS** | Tunnel originates on Yoga; **a separate always-on VPS is the endpoint** | SSH keys / whatever you harden on the VPS | Requires a **persistent always-on host** (even Oracle's free ARM box is a standing server you signed up for and maintain). → fails *no persistent infra*; also an internet-facing endpoint. *(Confidence: High — multiple 2026 playbooks.)* |
| **Directus Cloud (hosted)** | Directus' infra, **not the Yoga** | Directus-managed | **Paid** (Core ~$99/mo; Community Cloud paused for new projects) and it **moves the cockpit off the Yoga** — doesn't solve "reach my local instance." → fails *no purchase* + not the same cockpit. *(Confidence: High — Directus pricing + Nov-2025 tiers post.)* |
| **Self-host on always-on home box / Raspberry Pi** | A **new always-on box**, not the Yoga | n/a by itself | **Hardware purchase + persistent infra**, and it still needs a remote-access layer (e.g. Tailscale) *on top* to reach the phone off-LAN. Solves "Yoga-must-be-on" only by adding standing infrastructure. → fails *no purchase* + *no persistent infra*. *(Confidence: High.)* |

---

## Anti-pattern to avoid (most surprising finding)

The reflexive tutorial answer to "expose my localhost service" is **Cloudflare Tunnel or ngrok** — and both are the *wrong* tools here. They are built to **publish to the public internet** (then bolt auth on top), and Cloudflare additionally **requires you to own and move a domain**. For a genuinely private, single-user need, that's more attack surface, a purchase, and a public hostname — all to solve a problem a **mesh VPN solves with zero public exposure and zero cost**. The mediocre version of this decision reaches for the popular "tunnel" tool; the right version reaches for the private overlay network (Tailscale). Opinion, but well-supported: for *one person reaching their own laptop*, publishing to the internet is the anti-pattern.

## The one unavoidable material constraint

**Yoga-must-be-powered-on** is not solvable inside the boundary. Every option that keeps the cockpit on the Yoga (Tailscale, dev tunnels, Cloudflare, ngrok) only works while the laptop is on and online. The *only* fix is an always-on host — which requires a purchase and/or persistent infra, i.e. an explicit Warwick decision outside this boundary. Recommend accepting "works when the Yoga is on" for now; revisit an always-on Pi + Tailscale later only if Warwick wants 24/7 availability.

---

## Recommendation to Warwick (single decision)

Adopt **Tailscale `serve`** as the private phone-access path, with **VS Code/GitHub dev tunnels** as the no-phone-app fallback. Neither is built without your go-ahead. Tailscale needs two things the boundary reserves for you: **approve a free Tailscale account** (sign in with an identity you already have) and **install the Tailscale phone app**. If you'd rather install nothing new on the phone, use the dev-tunnels fallback (browser + GitHub login). If you want the cockpit reachable when the Yoga is off, that's a separate, explicit "always-on box" decision — flagged, not assumed.

---

## Methodology & limitations
- Searched vendor primary docs first (Tailscale, Cloudflare One, ngrok, VS Code / Microsoft Learn, Directus), then cross-checked each load-bearing claim against ≥1 independent secondary source (reviews, self-host guides, 2026 playbooks). Free-tier sufficiency, auth model, and public-vs-private behaviour are each multi-source (High). Exact current Tailscale free-tier seat/device numbers shifted in 2026 — the single-user conclusion holds under every version, but the precise cap is Medium confidence and should be confirmed on the pricing page at signup.
- **Not verified (read-only, no install):** actual throughput/latency on Warwick's specific network, and whether the Directus instance binds only to `127.0.0.1` vs `0.0.0.0` (affects the exact `serve`/forward target). No account was created, nothing installed, nothing configured.

## Sources
- Tailscale Serve — https://tailscale.com/docs/features/tailscale-serve · CLI: https://tailscale.com/docs/reference/tailscale-cli/serve · MagicDNS: https://tailscale.com/docs/features/magicdns · free-tier review: https://www.xda-developers.com/tailscale-free-plan-replaced-my-paid-vpn/ · self-host use: https://chameth.com/how-i-use-tailscale/
- VS Code port forwarding — https://code.visualstudio.com/docs/debugtest/port-forwarding · Remote Tunnels: https://code.visualstudio.com/docs/remote/tunnels · Dev tunnels security: https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/security
- Cloudflare Tunnel/Access — https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ · Access: https://www.cloudflare.com/sase/products/access/ · Zero Trust pricing: https://www.cloudflare.com/plans/zero-trust-services/ · domain requirement: https://community.cloudflare.com/t/why-do-i-need-a-domain-to-use-a-tunnel/745349 · Quick/TryCloudflare tunnels: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- ngrok — free-plan limits: https://ngrok.com/docs/pricing-limits/free-plan-limits · static domains: https://ngrok.com/blog/free-static-domains-ngrok-users · pricing: https://ngrok.com/pricing
- Reverse SSH / VPS — https://www.hostmycode.com/blog/reverse-ssh-tunnel-vps-access-2026-playbook · https://vps.do/how-to-set-up-a-reverse-ssh-tunnel-to-access-your-home-server-via-vps/
- Directus Cloud — pricing: https://directus.com/pricing · tier changes Nov-2025: https://directus.io/blog/an-update-to-cloud-tiers-november-2025
