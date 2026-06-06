# Even Hub App

A starter application built with `@evenrealities/even_hub_sdk` for developing WebView apps that communicate with Even App.

## Features

- ✅ User information retrieval
- ✅ Device information and status monitoring
- ✅ Local storage operations
- ✅ Real-time device status change events
- ✅ EvenHub event listening
- ✅ Modern TypeScript + Vite setup

## Prerequisites

- Node.js `^20.0.0 || >=22.0.0`
- npm, yarn, or pnpm

## Installation

```bash
npm install
```

## Development

### 1. Start the Development Server

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Generate QR Code for Even App

In a **separate terminal**, generate a QR code to load your app in the Even App:

```bash
npm run qr
```

Or use npx:

```bash
npx evenhub qr
```

The CLI will:
- Automatically detect your local IP address
- Prompt you for the port (default: 3000)
- Generate a QR code in your terminal

### 3. Scan QR Code with Even App

1. Open the **Even App** on your mobile device
2. Use the app's QR code scanner to scan the generated QR code
3. Your web app will load inside the Even App's WebView
4. Connect your G2 glasses to the Even App (if not already connected)

**Alternative**: You can also specify the URL directly:

```bash
evenhub qr --url http://192.168.1.100:3000
```

Replace `192.168.1.100` with your computer's local IP address.

## Building

Build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
.
├── src/
│   ├── main.ts          # Entry point
│   └── app.ts           # Main app logic
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md           # This file
```

## Usage in Even App WebView

This app is designed to run inside the Even App WebView environment. The SDK will automatically initialize the bridge when running in the Even App context.

**Important**: The app must run inside the Even App's WebView. It will NOT work in a regular browser. Use the `evenhub qr` command to easily load your development server in the Even App.

### Key Features Demonstrated

1. **User Information**: Displays current logged-in user details
2. **Device Information**: Shows connected device model, serial number, and status
3. **Device Status Monitoring**: Real-time updates when device status changes
4. **Local Storage**: Test storage operations
5. **Event Logging**: All SDK events are logged to the UI

## Next Steps

To extend this app with EvenHub features:

1. **Create Glasses UI**: Use `createStartUpPageContainer()` to create UI containers
2. **Handle Events**: Listen to `onEvenHubEvent()` for user interactions
3. **Audio Control**: Use `audioControl()` to enable microphone input
4. **Update Containers**: Use `rebuildPageContainer()` and `textContainerUpgrade()` to update UI

See the [SDK documentation](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) for detailed API reference.

## License

MIT
