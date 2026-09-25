---
source_id: EXL8mMUXs88
type: source-knowledge-note
source_type: youtube_transcript
title: Your Remote Desktop SUCKS!! Try this instead (FREE + Open Source)
source_url: "https://www.youtube.com/watch?v=EXL8mMUXs88"
video_id: EXL8mMUXs88
channel: NetworkChuck
published: 2025-02-04
transcript_source: auto_captions
captured_at: "2026-09-20T21:12:26+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/EXL8mMUXs88/tubeair-report.md
  - Sources/_raw/EXL8mMUXs88/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a NetworkChuck video (channel host, referred to here as "the presenter") walking through his personal journey away from paid/native remote-desktop tools toward RustDesk, a free and open-source remote access tool, self-hosted on his own server. The core argument: native Windows Remote Desktop (RDP) is good but gated behind a $200 Windows Pro license and can't reach machines off the local network; cross-platform native options don't exist (Windows can't natively remote into Mac); and the well-known commercial alternatives (TeamViewer, AnyDesk) carry cost, guilt-tripping nag screens, or reliance on someone else's servers. RustDesk solves all of this: free, open source, self-hostable, near-native performance including GPU acceleration, and works across Windows/Mac/Linux/phone. It matters to anyone managing multiple machines/editors/remote staff across mixed operating systems who wants performant remote access without recurring license cost or vendor lock-in.

## What the source says

**The RDP status quo and its problems** [00:00–07:00 approx, based on transcript sequence]
The presenter's daily driver is Windows, and Windows' native Remote Desktop Connection (RDC/`mstsc`) is described as "pretty amazing" — fast, built-in, functional. But it has one hard limitation: the machine being remoted *into* must run Windows 11 **Pro**, not Home. The machine doing the remoting can be any edition, but the target requires Pro to expose the "allow remote connections" setting. This forced the presenter to upgrade all his machines (including his video editors' PCs) to Pro at ~$200 each — which he calls "kind of stupid for something that should be guaranteed built into your system."

A second, arguably bigger limitation: native RDP only works over the same local network. Remote editors working from home or while traveling can't reach the office machines this way at all — this is the gap the presenter fills with Twingate (the video's sponsor) for secure cross-network access.

**Cross-platform gaps** [~04:00–08:00]
- Mac → Windows: works fine via Microsoft's own Remote Desktop app for Mac, but still requires the target Windows box to be Pro.
- Windows → Mac: **does not work natively at all.** This became an active problem because NetworkChuck Studios was migrating its entire video-editing operation from PC to Mac, and editors still need to remote into their machines from home.
- Linux: has a GUI sometimes, reachable via `xrdp`, which lets a standard RDP client (Mac/Windows) connect to a Linux box.
- VNC: works cross-platform in principle but is "a big pain to install especially on Linux," may lack polish (clipboard/copy-paste can be troublesome), and doesn't necessarily deliver the GPU performance needed for video editing work.

**COUNTERINTUITIVE REVERSAL — browser-based remote desktop is good but not the answer for heavy work.** The natural assumption might be "just use a browser-based solution and skip clients entirely." The presenter explicitly considered and uses this category (Guacamole and Kasm Workspaces, both free/open source, VNC-based under the hood) — but reverses the expectation that this is a universal fix: they're excellent for **light, no-install access** (an employee in the Philippines logs into a Kasm workspace over Twingate for basic browsing/terminal work) but are explicitly **not sufficient for heavy work like video editing**, because even though Kasm has made strides with GPU-related access, "you can't beat native client support" for that kind of workload. So the two-tier reality is: browser-based = great for thin/casual access; native client = required for performance-sensitive tasks.

**COUNTERINTUITIVE REVERSAL — TeamViewer's reputation vs. its real limitation.** TeamViewer is introduced with a joke about its reputation for being used by hackers/scammers ("if you've ever been hacked, you'll know what TeamViewer is") — but the presenter clarifies this isn't a security dismissal of the tool itself; he actively uses it (e.g., as "unofficial IT guy" for his church, remoting into their desktop with zero VPN setup required — "kind of amazing for what it is"). The real objection isn't malicious use, it's **trust and control**: TeamViewer traffic runs through TeamViewer's own servers, the free tier nags with "this is a sponsored session, buy a license" messages every connection, and the presenter doesn't want that dependency for his business. So the myth to bust is "TeamViewer = hacker tool, therefore bad" → reality is "TeamViewer is easy and legitimately useful, the real issue is who controls the server and how it monetizes/nags you."

**The chosen solution — RustDesk** [~09:00 onward]
RustDesk (named for being written in the Rust programming language) is positioned against its closest competitor, AnyDesk, and wins for the presenter's needs because:
- Free without the guilt-tripping/nag screens.
- **Self-hosting your own relay server is free** in RustDesk. AnyDesk's equivalent self-host capability is a **paid Pro feature only**.
- RustDesk is open source; it also offers an optional paid Pro tier for official support, but the open-source version is fully maintained.
- Provides GPU-accelerated native clients across Windows, Mac, Linux, and phone — near-native performance, comparable to what you'd expect from a first-party client.

**Two connection modes, explained mechanically:**
1. **Direct IP / local network mode** — if RustDesk clients are already installed on machines on the same LAN (or connected via Twingate as if on the same network), they can connect directly by IP address with zero server involved. Setup: enable "direct IP access" under Security settings, set port 21118 (default), set a permanent password. This produces a "direct and unencrypted" connection label when purely local — acceptable on a trusted LAN.
2. **Relay/signaling server mode** — for reaching a machine when you don't have direct network/Twingate access to it (e.g., helping "Uncle Rico" remotely, or reaching your own laptop left in a hotel room). You install a self-hosted RustDesk server (two Docker containers: `hbbs` — signaling — and `hbbr` — relay). The client sends the target's ID to your server, which attempts NAT traversal/hole-punching to establish a **direct and encrypted** connection between the two peers; if that's not possible (bad NAT/firewall), the server **relays** the traffic itself as a middleman, shown as "relayed and encrypted." By default, RustDesk clients use RustDesk's own public servers unless reconfigured — a privacy concern for some, which is the reason to self-host.

**Why self-host in the cloud rather than locally:** A self-hosted server (Docker, on any small VPS — the presenter uses Linode, $5/month, 1GB RAM, Ubuntu 24.04) is reachable from anywhere, which matters for two scenarios: (a) helping people (family/friends) who aren't already on your Twingate network, and (b) redundancy/backup access — e.g., reaching a laptop left powered on in a hotel room that isn't on the Twingate VPN. Local self-hosting is possible too but requires port forwarding and is described as giving a worse experience than a cloud VPS.

**Twingate's role (sponsor content, but functionally integrated into the workflow):** Twingate is a zero-trust network access (ZTNA) product that the presenter uses as his primary way to give remote editors secure access to office machines "as if" on the local network — meaning RustDesk's direct-IP mode can be used even for remote workers, without needing the relay server at all, as long as Twingate connects them into the same logical network. Twingate is free for small teams (up to 5 users), deployable via a lightweight connector (even a Raspberry Pi — the presenter cites installing one at his church to get remote network access), and supports fine-grained access control by resource and security group (e.g., only the "video editor" group can access a specific editor's Mac). The presenter states a preference: use Twingate for local-equivalent direct access whenever possible, and fall back to the relay server only when Twingate access isn't set up for that particular network.

## Mechanisms, methods & implementation detail

**A. Setting up RustDesk client-to-client direct IP access (no server):**
1. Install the RustDesk client on both machines (site linked in video description; choose OS build, e.g., Windows MSI 64-bit).
2. On the target machine, open client settings (the "…" menu near your ID) → unlock Security settings (triggers a UAC prompt) → enable "Direct IP Access" → set port (default 21118) → Apply.
3. Set a permanent password on the target machine.
4. From the connecting machine, connect directly via IP address; enter the password (or use facial/biometric login where offered).
5. Optionally enable "remote modification" in Security settings if you want to be able to change the remote machine's RustDesk settings from your side (grayed out by default).
6. Connection status indicator: "direct and unencrypted" when purely local IP-to-IP — considered fine on a trusted LAN.

**B. Self-hosting a RustDesk server via Docker (for relay/ID-based connections):**
1. Spin up a small cloud VM (example: Linode, Ubuntu 24.04, $5/month/1GB tier).
2. SSH in: `ssh root@<ip>`.
3. `sudo apt update`.
4. Install Docker (two-step copy/paste from Docker's own install instructions — set up Docker's apt repo, then `sudo apt-get install docker...`).
5. Create a working directory: `mkdir rustdesk-docker && cd rustdesk-docker`.
6. Create `docker-compose.yml` (content copied from RustDesk's official self-host documentation, "Docker installation" tab) via `nano docker-compose.yml`, paste, save (Ctrl+X, Y, Enter). This config defines two containers: `hbbs` (signaling/ID server) and `hbbr` (relay server).
7. Bring the stack up: `docker compose up -d`.
8. A `data` folder is created by the compose run; inside it, `cat id_ed25519.pub` reveals the server's **public key**, which every client needs to trust/authenticate against this server.
9. Note the VM's IP address as well.

**C. Pointing RustDesk clients at your own server (instead of RustDesk's public default servers):**
1. On each client: settings ("…") → Network tab → unlock Network settings (UAC-style prompt).
2. Enter the server's IP address as both the **ID/relay server** and the **relay server** field (presenter does this for both, noting he isn't fully certain the relay field is strictly necessary to duplicate).
3. Paste the **public key** (contents of `id_ed25519.pub`, everything up to but excluding the trailing username marker) into the Key field.
4. Save — status changes from a "please set up your own server" warning to "Ready," confirming the client is now using the self-hosted server rather than RustDesk's public infrastructure.
5. Repeat on every client that should use this server.
6. Each client has an **ID** and a rotating **one-time password** (OTP) visible in its UI — the OTP is useful for one-off tech-support-style sessions (ephemeral by design) versus the permanent password for regular repeat access.
7. To connect via ID (not IP): enter the target's ID in the client, use the OTP or permanent password. The server attempts hole-punching for a **direct encrypted** connection; if that fails, it falls back to being a **relay**, shown as "relayed and encrypted" in the connection status indicator.

**D. Using Twingate alongside RustDesk for remote (non-local) direct access:**
1. Install a Twingate connector inside the target network (a Raspberry Pi is sufficient — demonstrated at the presenter's church).
2. In Twingate, create a "Resource" for the target machine, optionally restricted to a specific port (e.g., 21118, RustDesk's port) for tighter scoping.
3. Assign access via security groups (e.g., a "video editors" group that can reach a specific editor's Mac resource) rather than open access to everyone.
4. Once connected via Twingate, the remote user's RustDesk client can reach the target by direct IP as if on the same LAN — bypassing the need for the relay server and its associated "relayed" (non-direct) performance path.

## Tools, people, products & organisations

- **NetworkChuck** — the channel/presenter; runs "NetworkChuck Studios," a video production operation with hired editors; also volunteers as informal IT support for his church ("Reach").
- **RustDesk** — free, open-source remote desktop software written in Rust; the presenter's chosen solution. Offers self-hosted server option (free, via Docker: `hbbs` signaling + `hbbr` relay containers), native GPU-accelerated clients for Windows/Mac/Linux/phone, and an optional paid Pro tier with official support and extra features (address book, login-required access, more polish).
- **Microsoft Remote Desktop Connection (RDC / mstsc)** — Windows' native RDP client/protocol; requires the *target* machine to run Windows Pro edition; local-network only (no native support for reaching machines off-network).
- **Twingate** — this video's sponsor; a Zero Trust Network Access (ZTNA) product providing secure remote connectivity into a private network via a lightweight connector; free for up to 5 users; used here as the mechanism that lets remote workers appear "local" for direct RustDesk access, and separately as a general secure remote-access tool for home labs, Plex, NAS access, and remote IT support for family/friends' networks.
- **xrdp** — open-source RDP server package for Linux, letting standard RDP clients connect to a Linux GUI machine.
- **VNC** — an older, widely available remote-desktop protocol/family of tools; noted as difficult to install (especially on Linux) and sometimes limited (clipboard issues, GPU performance).
- **Guacamole** — free, open-source browser-based remote desktop gateway.
- **Kasm Workspaces (Chasm/Kasm VNC)** — the presenter's preferred browser-based remote access tool; free, open source, VNC-based, cross-platform; used for light/casual access (e.g., an employee in the Philippines accessing "Terry," an AI machine in the server room).
- **TeamViewer** — well-known commercial remote access tool; free for personal use; extremely easy to use (no VPN required); criticized here for routing sessions through its own servers and nagging free-tier users with "buy a license" messages each session. Used by the presenter for church IT support.
- **AnyDesk** — TeamViewer's major competitor and RustDesk's closest direct comparison; similar feature set to RustDesk, but self-hosting your own server is a **paid Pro-only feature**, unlike RustDesk where it's free.
- **Docker** — containerization tool used to install and run the RustDesk server components (`hbbs`/`hbbr`) with minimal manual configuration; presenter references having a separate video explaining Docker basics.
- **Linode** — cloud hosting provider the presenter used for this demo (described as interchangeable with any cloud provider); chose a $5/month, 1GB RAM Ubuntu 24.04 instance.
- **ChatGPT / OpenAI "Tasks" feature** — briefly shown on-screen as an aside/demo of remote desktop performance (scrolling through a new ChatGPT feature) rather than a substantive topic in its own right.

## Examples & use cases

- Presenter remotes from his main Windows machine into a Windows laptop in the next room via native RDC as the opening demonstration of what already works.
- Editors at NetworkChuck Studios needing to remote into their (now Mac) edit machines from home, particularly cited via "Mike," an editor who received one of the first Macs and needed home access during a snowstorm — solved via Twingate + RustDesk.
- An employee in the Philippines accessing "Terry" (an AI server-room machine) via Twingate + Kasm Workspaces browser-based access for lighter tasks.
- The presenter's role as informal IT support for his church: TeamViewer used for ad hoc no-VPN access to the church's Windows desktop; separately, a Twingate connector deployed via Raspberry Pi at the church (referenced as covered in an earlier video) to give the presenter network-level remote access for administering it.
- "Uncle Rico" is used as the recurring hypothetical for the classic remote-tech-support scenario: install RustDesk, read off an ID, remote party connects via the self-hosted relay server without any prior network setup.
- Presenter demonstrates connecting to his own Mac and a headless Linux server via RustDesk, and briefly to a Linux GUI machine.
- Presenter demonstrates leaving a laptop in a hotel room and using the self-hosted RustDesk relay server (rather than Twingate, since the hotel isn't on his network) to reach it remotely from his phone.
- Twingate access-control example: only Isaac and the presenter (both in a "video editors" security group) can access Mike's Mac resource in Twingate's admin panel.

## Claims & confidence

- Windows Remote Desktop (native RDC) requires the target machine to run Windows 11 Pro, not Home. **[fact, high confidence — directly demonstrated and explained by presenter]**
- Native Windows RDP cannot reach machines off the local network without an additional remote-access layer like Twingate. **[fact, high confidence]**
- Windows has no native way to remote into a Mac. **[fact, high confidence — presenter states clearly and shows no native option, though phrased as "not easily and certainly not natively," implying a small amount of hedging]**
- RustDesk supports free self-hosting of your own relay/signaling server; AnyDesk requires its paid Pro tier for the equivalent. **[claim, medium-high confidence — stated plainly by the presenter as a direct comparison, not independently verified in the video against AnyDesk's actual current pricing/docs]**
- RustDesk delivers "near-native" client performance including GPU acceleration. **[opinion/claim, medium confidence — presenter's subjective assessment backed by a brief on-screen demo (scrolling a webpage) rather than a rigorous benchmark]**
- TeamViewer routes sessions through its own servers and nags free users with license-purchase prompts each session. **[fact/claim, medium-high confidence — presented as first-hand experience, plausible and consistent with TeamViewer's known free-tier behavior, but not independently sourced in the video]**
- Twingate is free for teams under 5 users. **[fact, medium confidence — presenter states this but visibly hesitates/checks himself on-screen ("I have to actually look it up"), and it's sponsor-provided information]**
- RustDesk's headless Linux support ("no display attached") exists but is described by the presenter as newly released and not yet polished ("I tested it, it's not great"). **[opinion, high confidence as a report of presenter's direct testing]**
- A direct IP-to-IP local connection in RustDesk is unencrypted by default; ID-based connections through the self-hosted server are encrypted (either direct-encrypted after successful hole-punching, or relayed-encrypted as fallback). **[fact, high confidence — directly demonstrated via the on-screen connection-status indicators]**

## Caveats & source gaps

- This is sponsored content (Twingate is the paid sponsor of the video); while the Twingate segment is clearly delineated ("here comes the ad portion"), the overall narrative structure — presenting a problem that Twingate happens to solve well — should be read with that commercial context in mind.
- No rigorous performance benchmarking is shown for RustDesk vs. AnyDesk vs. native RDP — claims of "near-native performance" rest on the presenter's own subjective experience and a brief screen-share demo, not measured latency/frame-rate data.
- Pricing/licensing claims for AnyDesk's self-hosting restriction and Twingate's free-tier user cap are stated from memory/lookup on-screen rather than cited from a source document; these could have changed since publication or be imprecise.
- The video does not name a publication date; given references to "Ubuntu 24.04" and ChatGPT "Tasks," it appears to be from later 2024 or into 2025, but this is inferred, not stated.
- Security posture of self-hosted RustDesk (e.g., hardening the Docker server, exposure of the signaling/relay ports to the internet, patching cadence) is not discussed at all — the video covers functional setup only, not a security/threat-model review.
- The video doesn't cover RustDesk's paid Pro tier features in any depth beyond noting its existence (official support, being able to pay).
- No discussion of RustDesk's own security/privacy track record (e.g., past CVEs or incidents) — relevant since self-hosting is partly framed as a *privacy* choice, but the source doesn't substantiate why self-hosting is meaningfully more private/secure beyond "not using someone else's server."

## What this means for Fusion247

*(Fusion247 interpretation — not sourced from the video)*

- **Direct relevance to the myPKA/Fusion estate's own remote-access needs**: Warwick runs a mixed-OS estate (Windows primary, references to Mac/Linux tooling elsewhere in the operating record) with remote workers/specialists conceptually analogous to the video's editor-access problem. If there's ever a need for Warwick himself (or a future household/family member) to remotely access a home-lab machine, church-style volunteer IT support, or a travelling laptop, RustDesk + self-hosted Docker server is a low-cost (~$5/month), fully self-owned pattern that avoids per-seat licensing and avoids routing traffic through a third party's servers — consistent with the estate's general preference for self-hosted, owned infrastructure over vendor lock-in.
- **Twingate as a reference pattern for zero-trust access**: Twingate's connector-on-a-Raspberry-Pi model plus per-resource/per-group access control is a clean illustration of "zero trust done simply" that could inform how Fusion247 thinks about exposing any home-lab or self-hosted service (e.g., the Cockpit, capture-gateway, or other local runtimes referenced elsewhere in this session) to Warwick's phone or a remote collaborator securely, rather than opening ports directly.
- **Not an immediate action item** — this is a personal/household IT tooling video with no direct tie to an active Build or Wayfinder plan currently in flight (BUILD-016 CareerAIR, VlogOps, etc.). It is filed as general technical reference for if/when a remote-access need arises for Warwick's own machines, not as a task to schedule.
- **Proportionality note (HOBBY BRAIN rule)**: nothing here rises to a security or governance concern warranting escalation — this is pure product-tooling recall for Warwick's own optional future use.

## Key concepts & takeaways

- Native RDP's real cost isn't the protocol — it's Microsoft's Windows Pro licensing gate on the *receiving* end, which is easy to overlook until you're paying to upgrade every machine you might ever remote into.
- Cross-platform remote desktop has a real, specific hole: Windows cannot natively reach Mac, forcing reliance on third-party tools once an org's editing/production stack shifts to Mac.
- Browser-based remote desktop (Kasm/Guacamole) and native-client remote desktop (RustDesk/TeamViewer/AnyDesk/RDP) solve different problems — thin/casual access vs. performance-critical work — and shouldn't be evaluated as substitutes for each other.
- A tool's popularity with bad actors (TeamViewer) doesn't equate to it being a bad tool; the real evaluation criteria should be server control/trust and monetization friction, not reputation by association.
- RustDesk's competitive edge over AnyDesk, for a self-hoster, comes down to one gating decision: free self-hosted server vs. Pro-only self-hosted server.
- Self-hosting your own relay server (via a cheap VPS + Docker) gives global reachability and redundancy beyond what a pure local-network/VPN (Twingate) solution provides, at minimal cost (~$5/month).
- Zero-trust network access (Twingate) and point-to-point remote desktop (RustDesk) are complementary, not competing: Twingate makes remote machines "network-local," RustDesk then handles the actual screen-sharing/control on top of that.

## Actions & open questions

- No action required unless Warwick has an active or upcoming need for remote access into a home-lab, family-support, or travel scenario — in which case, worth revisiting this note as a starting reference (Docker Compose steps and client config sequence are captured above in enough detail to execute without rewatching).
- Open question (not answered by the source): what is RustDesk's actual security/hardening posture for an internet-exposed self-hosted server (e.g., default port exposure, need for a firewall/reverse proxy, key rotation) — would need separate research (Pax) before actually deploying this for anything consequential.
- Open question: current (2026) pricing/feature parity between RustDesk Pro, AnyDesk Pro, and Twingate's free tier — video's figures may be stale given no publication date was given and pricing pages change.
- No further capture action needed from Cairn on this source; filed as reference-only technical knowledge.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/EXL8mMUXs88/` — `tubeair-report.md` (sha256 `8caa193b37b3…`), `manifest.json` (sha256 `6102dfe6a81c…`). Preserved as captured; never edited or summarised.
