# Prototype Mode – "Loading..." Stuck

If you see **"Prototype mode loading..."** and it never finishes, the Even App is waiting for your web app to load. Fix it with the steps below.

## 1. Make sure your dev server is running

On your **computer** (same machine where you ran `evenhub qr`):

```bash
npm run dev
```

Leave this running. You should see something like:

```
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

## 2. Phone must reach the dev server

- Your **phone** and **computer** must be on the **same Wi‑Fi**.
- The URL from the QR code uses your computer’s **local IP** (e.g. `http://192.168.1.100:3000`), not `localhost`.

**Quick check:** On the phone, open **Safari (iOS)** or **Chrome (Android)** and go to that same URL (e.g. `http://192.168.x.x:3000`).  
If the Even Hub app page loads there, the phone can reach the dev server. If it doesn’t, fix Wi‑Fi or firewall (see below).

## 3. Allow the dev server through your computer’s firewall

- **macOS:** System Settings → Network → Firewall → Options. Allow your terminal/Node/Vite if it’s blocked.
- **Windows:** Allow Node/vite through the firewall for “Private” networks.

## 4. Regenerate the QR code with the correct URL

If you’re not sure about the URL:

```bash
npx evenhub qr --clear
npx evenhub qr
```

When prompted, use:

- **IP:** Your computer’s local IP (from `npm run dev` under “Network”, or from system settings).
- **Port:** `3000` (or whatever port Vite shows).

Then scan the new QR code again in the Even App.

## 5. After the app loads: connect glasses and show Hello World

1. **Connect G2 glasses** in the Even App (device settings / Bluetooth) so status shows “connected”.
2. In the **web app** (the page that loads after “Prototype mode” finishes), click **“Show Hello World on Glasses”**.
3. Hello World should appear on the glasses display.

## 6. If you still see “Connecting to Even App…” then “Bridge timeout…”

- The WebView is loading your page, but the Even App bridge didn’t become ready in time.
- **Connect the G2 glasses** to the Even App first, then open the prototype again (or refresh the in‑app page).
- Try closing the prototype in the Even App and scanning the QR code again.

## Summary checklist

| Step | Action |
|------|--------|
| 1 | `npm run dev` running on computer |
| 2 | Phone and computer on same Wi‑Fi |
| 3 | Phone can open the app URL in browser (e.g. `http://192.168.x.x:3000`) |
| 4 | Firewall allows connections to the dev server |
| 5 | Scan QR from Even App (after `evenhub qr`) |
| 6 | Connect G2 glasses in Even App |
| 7 | In the loaded web app, click “Show Hello World on Glasses” |

The dev server is now configured with `host: true` so it’s reachable on your network (see `vite.config.ts`). If “Prototype mode loading…” still sticks, the bottleneck is usually network/firewall or the URL/port used in the QR code.
