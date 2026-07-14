# Turning on ads (later)

The arcade is **ad-ready but ads are OFF**. There's a reserved slot at the bottom
of the hub that renders *nothing* and takes *no space* until you flip it on — so
right now the site is clean, no clutter.

## Why it's off
Ad networks (Google AdSense is the usual one) need:
1. An account owned by an **adult (18+)** — so this goes under **dad's** account.
2. A **live site with real traffic** — apply *after* it's deployed at
   `play.vaultdigitaltools.com` and getting visits. AdSense reviews new sites and
   often rejects thin/new ones, so don't apply on day one.

## How to turn it on (once approved)
1. Get your AdSense **publisher ID** (`ca-pub-XXXXXXXXXXXXXXXX`) and an **ad-unit
   slot ID** from the AdSense dashboard.
2. In `index.html` `<head>`, add the AdSense loader script (paste from AdSense):
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XX:crossorigin=anonymous"></script>
   <script>window.ARCADE_ADS = true;</script>
   ```
   Setting `window.ARCADE_ADS = true` makes the reserved `.ad-slot` become visible
   (a labelled 728x90-ish box; full width on mobile).
3. In `shell/shell.js`, find the `ad-slot` block in `renderHub()` and drop the
   AdSense `<ins>` unit into the `.ad-slot.live` container, then call
   `(adsbygoogle = window.adsbygoogle || []).push({})`. Example:
   ```js
   if (window.ARCADE_ADS) {
     adSlot.classList.add("live");
     adSlot.innerHTML = '<ins class="adsbygoogle" style="display:block" ' +
       'data-ad-client="ca-pub-XX" data-ad-slot="YYYY" ' +
       'data-ad-format="auto" data-full-width-responsive="true"></ins>';
     (window.adsbygoogle = window.adsbygoogle || []).push({});
   }
   ```

## Where the slot lives
- CSS: `.ad-slot` / `.ad-slot.live` in `shell/theme.css` (hidden until `.live`).
- DOM: created in `renderHub()` in `shell/shell.js`, appended at the bottom of the hub.
- Keep ads to the **hub only** — never over a game's play area (bad UX + against
  most ad policies for interactive content).
