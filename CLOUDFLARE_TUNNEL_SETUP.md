# Cloudflare Tunnel Setup

This project uses a shared Cloudflare Tunnel to load `main.js` from the local Mac during development. When the tunnel is unavailable, Webflow loads the production copy from jsDelivr.

One single tunnel (called **`tunnel`** in Cloudflare) serves **every** local project on this Mac. Each project just gets its own subdomain and its own local port — you never need to create a new tunnel or install a second service.

## Projects currently using this tunnel

Add a row here whenever a new project joins the shared tunnel, so it's easy to see which ports are already taken.

| Project | Domain | Local port |
|---|---|---|
| byeribalance (this repo) | `byeribalance.studioprimal.com` | `8080` |
| Community | `community.studioprimal.com` | `5500` |

## Adding a new project to the tunnel

Do this once per new project — not per Mac, and not by creating a new tunnel.

1. Pick a local port that isn't already used by another project in the table above.
2. In Cloudflare, go to:
   ```text
   Tunnels → tunnel → Routes → Add route → Published application
   Subdomain: <new project name>
   Domain: studioprimal.com
   Service URL: http://localhost:<the port you picked>
   ```
3. Add a row for it to the table above.
4. Set up that project's daily workflow and Webflow loader the same way this document does for `byeribalance` below, swapping in its own domain, port, and folder.

**Never run `cloudflared service install` again.** Only one of those services can exist on a Mac at a time — that's what the shared tunnel is for. If you ever see a "service is already installed" error, that's the signal to add a route instead of installing anything new.

## This project's setup (byeribalance)

The sections below show how the tunnel is used day-to-day for this specific project. Use them as the template when setting up a new project (step 4 above).

### Daily workflow

Open Terminal and run:

```bash
cd ~/Desktop/byeribalance
python3 -m http.server 8080
```

Keep this Terminal window open while you develop. Stop it with `Control + C` when you're done — Webflow will then fall back to the CDN version.

Test the tunnel by opening:

```text
https://byeribalance.studioprimal.com/main.js
```

### Configure Webflow

In **Webflow → Site settings → Custom code → Footer**, paste this before publishing:

```html
<!--
  Webflow: Site settings → Custom code → Footer
  Loads the local Cloudflare version first, then falls back to jsDelivr.
  Keep the local Python server running while developing.
-->
<script>
(() => {
  if (document.querySelector('[data-cloudflare-loader]')) return

  const DEV_URL = 'https://byeribalance.studioprimal.com/main.js'
  const CDN_URL = 'https://cdn.jsdelivr.net/gh/LukasJurcik/byeribalance@main/main.js'

  const loadScript = (url, label, onError) => {
    const script = document.createElement('script')
    script.dataset.cloudflareLoader = ''
    script.src = `${url}?t=${Date.now()}`
    script.async = false
    script.onload = () => console.log(`[${label}] main.js loaded`)
    script.onerror = onError
    document.head.appendChild(script)
  }

  loadScript(DEV_URL, 'cloudflare', () => {
    console.log('[cloudflare] Tunnel unavailable, loading CDN')
    loadScript(CDN_URL, 'cdn')
  })
})()
</script>
```

Publish the Webflow site after changing the custom code.

### Switch to production mode

When the code is final and pushed to GitHub, replace the loader above with this CDN-only version. This removes the local dependency from the published Webflow site:

```html
<!--
  Webflow production code: Site settings → Custom code → Footer
  Loads the published main.js from jsDelivr only.
-->
<script>
(() => {
  const CDN_URL = 'https://cdn.jsdelivr.net/gh/LukasJurcik/byeribalance@main/main.js'
  const script = document.createElement('script')
  script.src = `${CDN_URL}?t=${Date.now()}`
  script.defer = true
  script.onload = () => console.log('[cdn] main.js loaded')
  script.onerror = () => console.error('[cdn] main.js failed to load')
  document.head.appendChild(script)
})()
</script>
```

Before switching to production mode:

1. Push the final `main.js` to the `main` branch on GitHub.
2. Open the CDN URL directly and confirm it contains the latest code.
3. Replace the development loader in Webflow with the CDN-only loader above.
4. Publish the Webflow site.

The local server can then be stopped. To resume local testing later, replace the CDN-only loader with the development loader again and restart the Python server.

## Troubleshooting

- **"cloudflared service is already installed" error:** don't uninstall/reinstall the service. Add a route to the existing `tunnel` tunnel instead (see "Adding a new project to the tunnel" above).
- **Cloudflare error 1033 ("unable to resolve"):** the DNS record for your subdomain points at a tunnel that no longer exists (often left over from an old, deleted tunnel). Delete that DNS record, then re-save the route in **Tunnels → tunnel → Routes** to recreate it correctly.
- **"An A, AAAA, or CNAME record with that host already exists":** an old DNS record for that subdomain is in the way. Find it under **Domains → studioprimal.com → DNS → Records** and delete it, then re-add the route.
