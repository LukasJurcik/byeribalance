# Cloudflare Tunnel Setup

This project uses a Cloudflare Tunnel to load `main.js` from the local Mac during development. When the tunnel is unavailable, Webflow loads the production copy from jsDelivr.

## 1. Install Cloudflare

Install the command-line client with Homebrew:

```bash
brew install cloudflared
```

In Cloudflare, create a tunnel named `community`. Copy the connector install command from the tunnel dashboard and run it in Terminal:

```bash
sudo cloudflared service install YOUR_TUNNEL_TOKEN
```

The token is private. Never commit it or share it. If it is exposed, use **Refresh token** in Cloudflare and reinstall the service with the new token.

## 2. Connect the domain

This project uses:

```text
community.studioprimal.com
```

If `studioprimal.com` is registered at GoDaddy:

1. Add `studioprimal.com` to the Cloudflare account.
2. Keep the imported Webflow, Zoho, and verification DNS records.
3. In GoDaddy, open **DNS → Nameservers → Change nameservers**.
4. Replace the GoDaddy nameservers with the two nameservers Cloudflare assigns. For this setup they are:

   ```text
   heidi.ns.cloudflare.com
   merlin.ns.cloudflare.com
   ```

5. Wait for Cloudflare to show the domain as **Active**.

Do not edit the automatic NS records in GoDaddy's DNS record table. Change nameservers from the Nameservers tab instead.

## 3. Add the tunnel route

In Cloudflare, open:

```text
Tunnels → community → Routes → Add route → Published application
```

Use:

```text
Subdomain: community
Domain: studioprimal.com
Path: leave empty
Service URL: http://localhost:5500
```

This creates the public hostname:

```text
https://community.studioprimal.com
```

## 4. Start local development

Open Terminal and run both commands, in this order:

```bash
cd ~/Desktop/Community
python3 -m http.server 5500
```

The first command changes Terminal into the project folder. The second command starts the local web server on port `5500`. Keep this Terminal window running while you develop.

Test the tunnel by opening:

```text
https://community.studioprimal.com/main.js
```

The Cloudflare connector runs as a background service and should reconnect after a Mac restart. The local Python server still needs to be running whenever local development files should be available.

## 5. Configure Webflow

In **Webflow → Site settings → Custom code → Footer**, paste this code before publishing. Footer placement makes sure the page and Webflow dependencies have loaded first.

```html
<!--
  Webflow: Site settings → Custom code → Footer
  Loads the local Cloudflare version first, then falls back to jsDelivr.
  Keep the local Python server running while developing.
-->
<script>
(() => {
  if (document.querySelector('[data-cloudflare-loader]')) return

  const DEV_URL = 'https://community.studioprimal.com/main.js'
  const CDN_URL = 'https://cdn.jsdelivr.net/gh/LukasJurcik/Community@main/main.js'

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

## 6. Switch to production mode

When the code is final and has been pushed to GitHub, replace the development loader above with this CDN-only loader. This removes the Cloudflare Tunnel dependency from the published Webflow site:

```html
<!--
  Webflow production code: Site settings → Custom code → Footer
  Loads the published main.js from jsDelivr only.
-->
<script>
(() => {
  const CDN_URL = 'https://cdn.jsdelivr.net/gh/LukasJurcik/Community@main/main.js'
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

The Cloudflare Tunnel can then be stopped. To resume local testing later, replace the CDN-only loader with the development loader again.

## Daily workflow

Each time you start working:

```bash
cd ~/Desktop/Community
python3 -m http.server 5500
```

Then:

1. Keep the Terminal window running.
2. Edit `main.js` in VS Code.
3. Refresh the Webflow site.
4. Stop the server when finished by pressing `Control + C` in that Terminal window. Webflow will then fall back to the CDN version.

A VS Code Live Server extension is optional. If used, configure it to use port `5500` and do not run it at the same time as Python's server.
