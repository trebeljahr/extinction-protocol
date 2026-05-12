# Dev URL setup (`https://extinction-protocol.local.ricoslabs.com/`)

This project ships with the **hatchkit local-dev** integration: when you run
`pnpm dev`, the dev server is reachable from any Tailscale peer (phone,
tablet, other laptop) at:

```
https://extinction-protocol.local.ricoslabs.com/
```

Caddy on your host terminates TLS with a real Cloudflare-issued wildcard
cert, and tailscale serve forwards inbound port-443 traffic from the
tailnet to Caddy. No per-project DNS work, no port juggling, no
framework `base` / `basePath` config.

## One-time host setup

Do this **once per machine**, not per project. After it's wired,
every hatchkit project that opts in just works.

### 1. Cloudflare DNS — wildcard CNAME

Add this record to the `ricoslabs.com` zone in Cloudflare:

```
*.local.ricoslabs.com   CNAME   laptop.tail4a5428.ts.net.
```

The record is **DNS only** (not proxied — orange-cloud OFF). Proxying
would terminate TLS at Cloudflare and break the SNI chain.

### 2. Cloudflare API token

Caddy needs a Cloudflare token to fetch the wildcard cert via DNS-01
ACME. `hatchkit config add dns` already prompts for one — if you ran
`hatchkit setup`, you've got it. Otherwise:

```
hatchkit config add dns
```

Permissions: `Zone:DNS:Edit` + `Zone:Zone:Read` scoped to
`ricoslabs.com`. The token gets embedded in the launchd plist
during `dev-setup init`.

### 3. Caddy with the Cloudflare DNS plugin

```
brew install caddy
caddy list-modules | grep cloudflare
```

If `dns.providers.cloudflare` isn't in the module list, rebuild with
xcaddy:

```
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
xcaddy build --with github.com/caddy-dns/cloudflare
```

### 4. Wire it all up

```
hatchkit dev-setup init
```

This writes `~/.config/dev/Caddyfile`, a launchd plist that runs Caddy
on a free port (default 9443, auto-bumps if taken), loads the launchd
job, and registers `tailscale serve --tcp=443 → localhost:<caddyPort>`.
Idempotent — safe to re-run.

### 5. Verify

```
hatchkit doctor
```

Look for the **Local-dev** rows. All six should be green:

- Tailscale daemon
- Caddy installed
- Caddy cloudflare plugin
- Cloudflare API token in plist
- Caddy launchd job
- Tailscale serve bridge

## Per-project bits

This project's slug is **`extinction-protocol`**, recorded in
`.hatchkit.json` under `localDev.slug`. When `pnpm dev` starts, the
hatchkit dev plugin:

1. Reads the slug + the live dev port from the running server.
2. Writes/updates `~/.config/dev/projects/extinction-protocol.caddy` pointing at
   that port. Caddy's `--watch` picks it up without a restart.
3. Probes `tailscale serve status` for the TCP=443 bridge.
4. Prints a banner:

```
➜  Local:     http://localhost:<port>/
➜  Tailscale: https://extinction-protocol.local.ricoslabs.com/
```

`HATCHKIT_LOCAL_DEV=0` in the environment disables the plugin entirely;
the dev server falls back to its default banner.

## Cleanup

If you tear down this project:

```
hatchkit destroy
```

…also removes `~/.config/dev/projects/extinction-protocol.caddy`. Other projects'
fragments stay put.
