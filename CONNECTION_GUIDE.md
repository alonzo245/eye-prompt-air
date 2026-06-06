# How to Connect Your G2 Glasses

## Overview

The G2 glasses connect through the **Even App** (the native mobile app), not directly from the web application. Your web app runs inside a WebView within the Even App and communicates with the glasses through the SDK bridge.

## Connection Steps

### 1. Install Even App
- Download and install the **Even App** on your mobile device (iOS or Android)
- Make sure you're logged into your Even account

### 2. Connect Glasses to Even App
- Open the Even App on your device
- Ensure your G2 glasses are powered on and in pairing mode
- In the Even App, navigate to device settings/connection
- Pair and connect your G2 glasses via Bluetooth
- Wait for the connection status to show "Connected" in the Even App

### 3. Open Your Web App in Even App
- Your web app needs to be loaded inside the Even App's WebView
- The Even App should provide a way to load web apps/WebViews
- Navigate to your app URL (e.g., `http://localhost:3000` for development, or your deployed URL)

### 4. Verify Connection in Your App
Once your web app is running inside the Even App WebView:

1. **Check the Status**: The app will automatically try to connect to the bridge
2. **Device Information**: Click "Refresh Info" to see if device info loads
3. **Connection Status**: Check the "Device Information" section for:
   - Connection status (should show "connected")
   - Device model and serial number
   - Battery level
   - Wearing status

## Connection Status Indicators

Your app displays connection status in several ways:

### Device Information Section
- **Connection**: Shows one of:
  - `none` - Not initialized
  - `connecting` - Attempting to connect
  - `connected` - Successfully connected ✅
  - `disconnected` - Not connected
  - `connectionFailed` - Connection attempt failed

### Event Log
- Look for messages like:
  - `"Device connected! Battery: X%, Wearing: true/false"` ✅
  - `"Device status changed: connected"` ✅
  - `"Loaded device info: [model] ([serial])"` ✅

### Status Bar
- Green "Connected to Even App" = Bridge is ready
- If device shows "No device connected", the glasses aren't paired/connected in Even App

## Troubleshooting

### "Bridge not initialized" or "No device connected"

**Possible causes:**
1. **Not running in Even App WebView**: The SDK only works inside the Even App's WebView environment
   - ❌ Won't work: Opening `http://localhost:3000` in a regular browser
   - ✅ Will work: Opening the URL inside Even App's WebView

2. **Glasses not connected to Even App**: 
   - Check Even App's device connection status
   - Ensure Bluetooth is enabled
   - Try disconnecting and reconnecting in Even App

3. **Even App not logged in**:
   - Make sure you're logged into your Even account in the app

### Device Status Shows "disconnected" or "connectionFailed"

1. **Check Even App**: Verify the glasses are connected in the Even App first
2. **Restart Connection**: 
   - Disconnect glasses in Even App
   - Power cycle the glasses
   - Reconnect in Even App
   - Refresh your web app

3. **Check Battery**: Low battery might cause connection issues

### Development Setup

For local development:

1. **Run your dev server**:
   ```bash
   npm run dev
   ```
   This starts the server at `http://localhost:3000`

2. **Access from Even App**:
   - If testing on a physical device, you may need to:
     - Use your computer's local IP address (e.g., `http://192.168.1.100:3000`)
     - Or use a tunneling service like ngrok
   - Configure Even App to load your web app URL

3. **Check Network**: Ensure your mobile device can reach your development server

## How Connection Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  G2 Glasses │ ◄─────► │  Even App    │ ◄─────► │  Web App    │
│  (Hardware) │ Bluetooth│ (Native App) │ Bridge  │ (WebView)   │
└─────────────┘         └──────────────┘         └─────────────┘
```

1. **G2 Glasses** ↔ **Even App**: Connected via Bluetooth
2. **Even App** ↔ **Web App**: Connected via JavaScript bridge (SDK)
3. Your web app uses the SDK to communicate with Even App, which relays to the glasses

## Testing Connection

Once connected, you can test by:

1. **Click "Show Hello World on Glasses"** - This should display text on your glasses
2. **Monitor Device Status** - Watch for real-time status updates
3. **Check Event Log** - See connection events and status changes

## Next Steps

Once connected:
- ✅ Device info should show model, serial number, battery, etc.
- ✅ You can create UI containers on the glasses
- ✅ You can listen to device status changes
- ✅ You can send content to display on the glasses

If you're still having connection issues, check:
- Even App version (should support WebView apps)
- Glasses firmware is up to date
- Network connectivity between devices
