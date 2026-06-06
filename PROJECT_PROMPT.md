# Eye Prompt G2 - Project Prompt

## Project Overview

Build **Eye Prompt**, a professional teleprompter application for Even Realities G2 glasses and R1 ring. This app enables performers, presenters, and content creators to display text and image content directly in their field of view through AR glasses, providing hands-free, natural presentation delivery.

## Core Requirements

### 1. Content Management System

- **Show Creation**: Allow users to create "shows" from text input
  - Text input with automatic paragraph splitting (split on double newlines)
  - Each paragraph becomes a separate slide/page
  - Show naming with automatic timestamp suffix
  - Save shows locally using EvenHub SDK storage API (`setLocalStorage`/`getLocalStorage`)
- **Show Gallery**: Display list of saved shows
  - Show name, creation date
  - Preview button to view show content
  - Delete button to remove shows
  - Refresh functionality to reload show list
  - Support for text-only shows (no images)

### 2. Text Rendering & Display

- **Text-to-Glasses Display**: Render text content on G2 glasses using EvenHub SDK text containers
  - Use `createStartUpPageContainer` for initial page setup
  - Use `rebuildPageContainer` for navigation between slides
  - Use `textContainerUpgrade` for dynamic text updates (e.g., timer)
- **Text Styling Options**:
  - Font selection (support Hebrew fonts: Rubik, Haim Design, Noto Sans Hebrew, etc.)
  - Font size control (adjustable during presentation: 12-300px)
  - Text alignment (left, center, right)
  - Text stretching option (fill full width of display)
  - Line height control (0.5x to 1.3x spacing)
  - Text opacity control (30%, 60%, 100% - toggle during presentation)
  - Text inversion (white text on black background option)
- **Safe Viewing Area**: Position text to avoid glasses frame obstruction
  - Reserve top 25% of display area (Y position: 50+ pixels from top)
  - Canvas size: 576x136px (or G2 equivalent)
  - Coordinate system: (0,0) at top-left, X right, Y down

### 3. Presentation Mode

- **Start Presentation**:
  - Select a show from gallery
  - Initialize glasses display with first slide using `createStartUpPageContainer`
  - Enter fullscreen/presentation mode
  - Lock screen orientation (landscape)
- **Navigation Controls**:
  - Tap gesture: Advance to next slide
  - Double tap: Cycle through display modes (both eyes / left only / right only)
  - Long press: Pause/resume presentation
  - Use `onEvenHubEvent` to listen for system events/gestures
  - Use `rebuildPageContainer` to update display with new slide content
- **Display Modes**:
  - Both eyes: Show content on both displays
  - Left eye only: Show on left display
  - Right eye only: Show on right display
  - Implement via separate containers or SDK display mode API

### 4. Timer Feature

- **Count-Up Timer**: Display elapsed time during presentation
  - Show timer in top-left corner of glasses display (X: 20, Y: 20)
  - Format: MM:SS (e.g., "05:23")
  - Update every second using `textContainerUpgrade`
  - Semi-transparent display: 30% opacity background, 60% opacity text
  - Start/stop timer button in controls
  - Long press to reset timer
  - Auto-reset when entering/exiting presentation mode

### 5. Brightness Control

- **Screen Brightness**: Allow users to dim the app screen
  - Right 30% of screen is invisible tap area
  - Tap at bottom = dimmest (70% opacity overlay)
  - Tap at top = brightest (0% opacity overlay)
  - Linear mapping between tap Y position and brightness
  - Implement as CSS overlay on web view if SDK doesn't provide native control

### 6. R1 Ring Integration

- **Ring Gesture Support**:
  - Listen for ring gestures via `onEvenHubEvent` system events
  - Map gestures to navigation:
    - Single tap: Next slide
    - Double tap: Previous slide
    - Long press: Pause/resume
  - Display ring battery status if available
  - Monitor ring connection status

## Technical Specifications

### 2026 Tooling Update

- **SDK 0.0.9**: launch source listening (`appMenu` / `glassesMenu`), max 12 containers, max 8 text containers, max image size 288x144, IMU control/events, and fixed border radius spelling (`borderRadius` replacing old `borderRdaius`).
- **Simulator 0.6.2**: supports 12-container flows, 288x144 image bounds, launch source simulation, and IMU simulation.
- **CLI 0.1.10+**: packaging/validation updates for new SDK configs.

### Technology Stack

- **Framework**: React with TypeScript (or Vue.js)
- **Build Tool**: Vite
- **SDK**: `@evenrealities/even_hub_sdk` (v0.0.9+)
- **CLI**: `@evenrealities/evenhub-cli` (v0.1.10+) for development and packaging
- **Storage**: EvenHub SDK storage API + browser localStorage backup

### SDK Integration

```typescript
import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";

// Initialize SDK bridge
const bridge = await waitForEvenAppBridge();

// Create containers for glasses display
await bridge.createStartUpPageContainer({
  containerTotalNum: 1 - 12, // Max 12 containers (SDK 0.0.9+)
  textObject: [
    /* TextContainerProperty[] */
  ],
  imageObject: [
    /* ImageContainerProperty[] */
  ],
  listObject: [
    /* ListContainerProperty[] */
  ],
});

// Listen for events
bridge.onEvenHubEvent((event) => {
  // Handle listEvent, textEvent, sysEvent, audioEvent
});

// Update text content
await bridge.textContainerUpgrade({
  containerID: number,
  containerName: string,
  content: string, // Max 2000 chars
});
```

### Key Constraints

- **Container Limits**: Maximum 12 containers per page (SDK 0.0.9+)
- **Event Capture**: Only one container can have `isEventCapture=1`
- **Text Length**: Max 2000 characters per text container upgrade
- **Image Updates**: Must be queued (no concurrent sends)
- **Text Containers**: `textObject` supports up to 8 containers
- **Image Containers**: `imageObject` supports up to 4 containers
- **Image Size**: Maximum 288x144 per image container (SDK 0.0.9+)
- **Memory**: Glasses have limited memory - optimize image sizes
- **Coordinate System**: (0,0) at top-left, X right, Y down
- **Canvas Size**: 576x288px (or G2 equivalent)

### Development Workflow

```bash
# Start dev server
npm run dev

# Generate QR code for Even App
npx evenhub qr --port 5173

# Test on G2 glasses via Even App
# Scan QR code in Even App to load web view

# Build for production
npm run build

# Pack for EvenHub
npx evenhub pack app.json ./dist --output eye-prompt-air.ehpk
```

## UI/UX Requirements

### Design System

- **Theme**: Dark theme (black background, grey text)
- **Language**: Hebrew/RTL support (right-to-left text direction)
- **Typography**: Support Hebrew fonts (Rubik, Haim Design, Noto Sans Hebrew)
- **Responsive**: Optimize for mobile, tablet, desktop web views

### Key Screens

1. **Gallery List Screen**
   - List of saved shows
   - "Create New Show" button
   - Show preview button
   - Delete button
   - Refresh button

2. **Show Creator Screen**
   - Text input area (multi-line)
   - Font selection dropdown
   - Font size slider (20-50px)
   - Text alignment buttons
   - Text stretch checkbox
   - Text inversion checkbox
   - Line height control
   - Show name input
   - "Create Show" button
   - "Reset" button

3. **Presentation Screen**
   - Fullscreen overlay
   - Text/content displayed on glasses
   - Control buttons (bottom-left):
     - Font selection dropdown
     - Line height dropdown
     - Text/image toggle button
     - Font size decrease/increase buttons
     - Display mode button (both/left/right)
     - Timer button
     - Text opacity button
     - Close/exit button
   - Timer display (top-left on glasses)
   - Brightness control area (right 30% of screen)

## Feature Parity with G1 Version

Ensure these features from the original G1 Flutter app are implemented:

✅ Show creation from text with paragraph splitting  
✅ Local show storage and management  
✅ Text rendering with multiple font options  
✅ Font size, alignment, stretching controls  
✅ Safe viewing area (top 25% margin)  
✅ Presentation mode with navigation  
✅ Display modes (both/left/right eyes)  
✅ Timer with auto-reset  
✅ Text opacity control  
✅ Screen brightness control  
✅ Hebrew/RTL support  
✅ Dark theme

## Additional G2/R1 Enhancements

Consider these improvements for G2/R1:

- Native text containers (better performance than pre-rendered images)
- R1 ring gesture navigation (more discrete than screen taps)
- Better event handling via SDK event system
- Potential for richer UI with up to 12 containers
- Audio event support (if needed for future features)
- Launch source listening (detect appMenu vs glassesMenu launches)
- IMU control and IMU data events for motion-aware features

## Success Criteria

The app is complete when:

1. ✅ Users can create shows from text input
2. ✅ Shows are saved and can be loaded from storage
3. ✅ Shows can be presented on G2 glasses with proper text rendering
4. ✅ Navigation works via gestures (tap, double tap, long press)
5. ✅ Timer displays and updates correctly
6. ✅ Brightness control works
7. ✅ R1 ring gestures are mapped to navigation
8. ✅ All text styling options work (fonts, sizes, alignment, etc.)
9. ✅ Hebrew text displays correctly with RTL support
10. ✅ App can be packaged and deployed via EvenHub

## Reference Implementation

Original G1 app location: `/Users/alonalush/research/eye_prompt`

Key files to reference:

- `lib/services/bmp_generator.dart` - Text rendering logic
- `lib/views/features/upload_gallery_form_page.dart` - Show creation UI
- `lib/views/features/bmp_page.dart` - Presentation mode
- `lib/services/features_services.dart` - Device communication

## Getting Started

1. Initialize project:

```bash
npm create vite@latest eye-prompt-air -- --template react-ts
cd eye-prompt-air
npm install @evenrealities/even_hub_sdk
npm install -D @evenrealities/evenhub-cli
npx evenhub init
```

2. Set up SDK bridge service
3. Implement storage service
4. Build show creation UI
5. Build gallery list UI
6. Implement presentation mode
7. Add timer feature
8. Add brightness control
9. Integrate R1 ring gestures
10. Polish and test

---

**Start building!** 🚀
