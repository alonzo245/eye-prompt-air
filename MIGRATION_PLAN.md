# Eye Prompt - Product Description & G2/R1 Migration Plan

## Product Description

### Overview
**Eye Prompt** is a professional teleprompter application designed for Even Realities G1 glasses, enabling performers, presenters, and content creators to display text and image content directly in their field of view. The app transforms traditional teleprompting workflows by leveraging AR glasses technology, allowing hands-free, natural presentation delivery.

### Core Value Proposition
- **Hands-Free Teleprompting**: Display scripts, jokes, and content directly in the glasses display
- **Professional Presentation Tools**: Timer, brightness control, and customizable text rendering
- **Multi-Format Support**: Text-only shows, image galleries, or mixed content
- **Hebrew & RTL Support**: Full support for Hebrew text with proper right-to-left rendering
- **Offline-First**: Generate and manage content locally without requiring constant internet connectivity

---

## Key Features (G1 Implementation)

### 1. Content Management
- **Gallery Creation**: Create shows from text input with automatic paragraph splitting
- **Text-to-Image Generation**: Convert text to monochrome BMP images optimized for glasses display (576x136px)
- **Local Storage**: Save shows locally with metadata (name, timestamp, text content)
- **Show Preview**: Preview galleries before presentation
- **Show Management**: Delete, organize, and refresh show lists

### 2. Text Rendering Engine
- **Font Selection**: 16+ font options including Hebrew fonts (Rubik, Haim Design, Noto Sans Hebrew, etc.)
- **Font Size Control**: Adjustable from 20-50px during creation, 12-300px during presentation
- **Text Alignment**: Left, center, or right alignment
- **Text Stretching**: Option to stretch text to full width of display
- **Safe Viewing Area**: Automatically positions text to avoid glasses frame obstruction (top 25% margin)
- **Text Inversion**: White text on black background option
- **Line Height Control**: Adjustable spacing between lines (0.5x to 1.3x)

### 3. Presentation Controls
- **Image Navigation**: Tap screen to advance to next slide/image
- **Double-Tap Actions**: Multi-state double-tap for cycling display modes
- **Display Modes**: Show content on both eyes, left eye only, or right eye only
- **Pause/Resume**: Pause presentation and resume from same position
- **Text Overlay Mode**: Display text directly rendered in app (alternative to BMP images)
- **Text Opacity Control**: Adjust text transparency during presentation (30%, 60%, 100%)
- **Screen Brightness Control**: Dim app screen brightness via right-edge tap area (30% width, bottom=dim, top=bright)

### 4. Timer Features
- **Count-Up Timer**: Display elapsed time in top-left corner of glasses view
- **Timer Controls**: Start/stop timer, long-press to reset
- **Auto-Reset**: Timer automatically resets when entering/exiting presentation mode
- **Semi-Transparent Display**: Timer shown with 30% opacity background and 60% opacity text

### 5. Technical Implementation (G1)
- **Bluetooth Low Energy (BLE)**: Direct communication with G1 glasses
- **BMP Protocol**: Custom protocol for sending monochrome bitmap images
- **Sequential Updates**: Queue-based image updates to prevent BLE congestion
- **Heartbeat Mechanism**: Maintains connection stability during presentation
- **Cross-Platform**: Flutter app supporting Android, iOS, macOS, Linux, Windows

---

## Migration Plan: G1 → G2 Glasses + R1 Ring

### Architecture Changes

#### Current Architecture (G1)
```
Flutter App → BLE Manager → Custom Protocol → G1 Glasses
```

#### Target Architecture (G2/R1)
```
Web App (React/Vue) → EvenHub SDK → Even App Bridge → G2 Glasses / R1 Ring
```

### Technology Stack Migration

| Component | G1 (Current) | G2/R1 (Target) |
|-----------|--------------|----------------|
| **Framework** | Flutter (Dart) | Web (React/Vue/TypeScript) |
| **Communication** | Custom BLE Protocol | EvenHub SDK (`@evenrealities/even_hub_sdk`) |
| **Device API** | Direct BLE commands | Even App Bridge API |
| **Image Format** | 1-bit BMP (576x136) | Image containers via SDK |
| **Text Rendering** | Canvas-based BMP generation | Text containers via SDK |
| **Development** | Flutter CLI | EvenHub CLI (`@evenrealities/evenhub-cli`) |

---

## Implementation Plan

### Phase 1: Project Setup & SDK Integration

#### 1.1 Initialize Web Project
```bash
# Create new web project
npm create vite@latest eye-prompt-g2 -- --template react-ts
cd eye-prompt-g2

# Install EvenHub SDK
npm install @evenrealities/even_hub_sdk

# Install EvenHub CLI
npm install -D @evenrealities/evenhub-cli

# Initialize EvenHub config
npx evenhub init
```

#### 1.2 Project Structure
```
eye-prompt-g2/
├── src/
│   ├── components/          # React components
│   │   ├── GalleryList.tsx
│   │   ├── ShowCreator.tsx
│   │   ├── PresentationView.tsx
│   │   └── Controls.tsx
│   ├── services/
│   │   ├── evenHubBridge.ts    # SDK bridge wrapper
│   │   ├── contentGenerator.ts  # Text-to-image conversion
│   │   └── storageService.ts    # Local storage management
│   ├── hooks/
│   │   ├── useEvenHub.ts        # SDK initialization hook
│   │   ├── useDeviceStatus.ts   # Device status monitoring
│   │   └── usePresentation.ts   # Presentation state management
│   ├── types/
│   │   └── index.ts             # TypeScript definitions
│   └── App.tsx
├── app.json                    # EvenHub app configuration
├── package.json
└── vite.config.ts
```

#### 1.3 SDK Integration Setup
```typescript
// src/services/evenHubBridge.ts
import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk';

class EvenHubService {
  private bridge: EvenAppBridge | null = null;
  
  async initialize() {
    this.bridge = await waitForEvenAppBridge();
    return this.bridge;
  }
  
  getBridge() {
    return this.bridge;
  }
}

export const evenHubService = new EvenHubService();
```

---

### Phase 2: Core Feature Migration

#### 2.1 Content Management System

**Migration Strategy:**
- Replace Flutter's `path_provider` with browser `localStorage` or `IndexedDB`
- Migrate gallery data structure to JSON format
- Implement show metadata storage using SDK's `setLocalStorage`/`getLocalStorage`

**Implementation:**
```typescript
// src/services/storageService.ts
import { evenHubService } from './evenHubBridge';

export interface ShowMetadata {
  id: string;
  name: string;
  createdAt: number;
  textContent: string;
  settings: ShowSettings;
}

export class StorageService {
  async saveShow(show: ShowMetadata) {
    const bridge = evenHubService.getBridge();
    if (bridge) {
      await bridge.setLocalStorage(`show_${show.id}`, JSON.stringify(show));
    }
    // Also store in browser localStorage as backup
    localStorage.setItem(`show_${show.id}`, JSON.stringify(show));
  }
  
  async loadShows(): Promise<ShowMetadata[]> {
    // Load from EvenHub storage or localStorage
  }
}
```

#### 2.2 Text-to-Image Generation

**Migration Strategy:**
- Replace Flutter's `Canvas` API with HTML5 Canvas or SVG
- Generate image data compatible with SDK's `ImageRawDataUpdate` format
- Maintain same text rendering logic (fonts, alignment, stretching)

**Implementation:**
```typescript
// src/services/contentGenerator.ts
export class ContentGenerator {
  async generateImageFromText(
    text: string,
    options: TextRenderOptions
  ): Promise<Uint8Array> {
    // Use HTML5 Canvas to render text
    const canvas = document.createElement('canvas');
    canvas.width = 576;
    canvas.height = 136;
    
    const ctx = canvas.getContext('2d');
    // Render text with same logic as Flutter version
    // Convert to Uint8Array format for SDK
    return canvasToImageData(canvas);
  }
  
  async generateTextContainer(
    text: string,
    options: TextRenderOptions
  ): Promise<TextContainerProperty> {
    // Create text container using SDK types
    return {
      xPosition: 0,
      yPosition: 50, // Avoid top 25% safe area
      width: 576,
      height: 136,
      containerID: generateContainerID(),
      containerName: 'prompt-text',
      content: text,
      isEventCapture: 1,
    };
  }
}
```

#### 2.3 Presentation System

**Migration Strategy:**
- Replace BLE-based image sending with SDK's `createStartUpPageContainer`/`rebuildPageContainer`
- Use SDK's event system (`onEvenHubEvent`) for user interactions
- Implement navigation via list containers or gesture events

**Implementation:**
```typescript
// src/hooks/usePresentation.ts
import { evenHubService } from '../services/evenHubBridge';
import { EvenHubEvent } from '@evenrealities/even_hub_sdk';

export function usePresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  
  const startPresentation = async (show: ShowMetadata) => {
    const bridge = evenHubService.getBridge();
    if (!bridge) return;
    
    // Create initial page with first slide
    await bridge.createStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [/* first slide text container */],
    });
    
    // Listen for navigation events
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      if (event.sysEvent) {
        // Handle navigation gestures
        handleNavigation(event.sysEvent);
      }
    });
  };
  
  return { startPresentation, currentSlide, isPresenting };
}
```

---

### Phase 3: Advanced Features Migration

#### 3.1 Timer Feature

**Migration Strategy:**
- Display timer as text container overlay
- Update timer text via `textContainerUpgrade` every second
- Position in top-left using SDK coordinates (0, 20)

**Implementation:**
```typescript
// src/components/TimerOverlay.tsx
export function TimerOverlay({ elapsedSeconds }: { elapsedSeconds: number }) {
  const bridge = evenHubService.getBridge();
  
  useEffect(() => {
    if (!bridge) return;
    
    const updateTimer = async () => {
      const timeStr = formatTime(elapsedSeconds);
      await bridge.textContainerUpgrade({
        containerID: TIMER_CONTAINER_ID,
        containerName: 'timer',
        content: timeStr,
      });
    };
    
    updateTimer();
  }, [elapsedSeconds]);
  
  return null; // Timer rendered on glasses, not in web UI
}
```

#### 3.2 Brightness Control

**Migration Strategy:**
- G2 glasses may have native brightness control via SDK
- If not available, implement as CSS overlay on web view
- Use R1 ring gestures for brightness adjustment (if supported)

**Implementation:**
```typescript
// Check if SDK provides brightness control
const bridge = await waitForEvenAppBridge();
// Use SDK method if available, otherwise CSS overlay
```

#### 3.3 Display Mode (Both/Left/Right)

**Migration Strategy:**
- G2 may support per-eye control via SDK
- Implement as separate containers for left/right eyes
- Use `rebuildPageContainer` to switch between modes

---

### Phase 4: R1 Ring Integration

#### 4.1 Ring Gesture Support

**Implementation:**
```typescript
// Listen for ring gestures via SDK events
bridge.onEvenHubEvent((event) => {
  if (event.sysEvent) {
    // Map ring gestures to navigation actions
    // - Tap: Next slide
    // - Double tap: Previous slide
    // - Long press: Pause/resume
  }
});
```

#### 4.2 Ring-Specific Features
- Use ring for discrete navigation during presentation
- Ring battery status display
- Ring connection status monitoring

---

### Phase 5: UI/UX Migration

#### 5.1 Web Interface Design
- **Design System**: Maintain dark theme from Flutter app
- **Hebrew Support**: Ensure RTL layout works in web
- **Responsive Design**: Optimize for mobile, tablet, desktop
- **Touch Gestures**: Support swipe navigation

#### 5.2 Development Workflow
```bash
# Start dev server
npm run dev

# Generate QR code for Even App
npx evenhub qr --port 5173

# Test on G2 glasses via Even App
# Scan QR code in Even App to load web view
```

---

## Key Differences & Considerations

### 1. Image Format
- **G1**: 1-bit monochrome BMP (576x136px)
- **G2**: Image containers via SDK (check supported formats/sizes)

### 2. Text Rendering
- **G1**: Pre-rendered BMP images sent via BLE
- **G2**: Text containers rendered natively by glasses OS

### 3. Navigation
- **G1**: Tap screen in Flutter app
- **G2**: Gesture events from glasses or R1 ring

### 4. Storage
- **G1**: File system via `path_provider`
- **G2**: EvenHub storage API + browser localStorage

### 5. Device Communication
- **G1**: Direct BLE protocol
- **G2**: Even App Bridge (WebView-based)

---

## Testing Strategy

### 1. Unit Tests
- Content generation logic
- Storage service
- Text rendering calculations

### 2. Integration Tests
- SDK bridge initialization
- Container creation/updates
- Event handling

### 3. Device Testing
- G2 glasses display accuracy
- R1 ring gesture recognition
- Performance with large shows

### 4. Compatibility Testing
- Different browsers (Chrome, Safari, Edge)
- Mobile vs desktop web views
- Network connectivity scenarios

---

## Deployment

### 1. Development Mode
```bash
# Use EvenHub CLI QR code generation
npx evenhub qr --port 5173
```

### 2. Production Build
```bash
# Build web app
npm run build

# Pack for EvenHub
npx evenhub pack app.json ./dist --output eye-prompt-g2.ehpk
```

### 3. App Submission
- Upload `.ehpk` file via Even App
- Configure app metadata in `app.json`
- Test on physical G2/R1 devices

---

## Migration Checklist

### Core Features
- [ ] Project setup with EvenHub SDK
- [ ] SDK bridge initialization
- [ ] Content storage migration
- [ ] Text rendering engine
- [ ] Image generation
- [ ] Show creation UI
- [ ] Gallery list UI
- [ ] Presentation mode
- [ ] Navigation controls

### Advanced Features
- [ ] Timer overlay
- [ ] Brightness control
- [ ] Display mode switching
- [ ] Text opacity control
- [ ] Font selection
- [ ] Text alignment
- [ ] Text stretching

### R1 Ring Integration
- [ ] Ring gesture detection
- [ ] Ring navigation mapping
- [ ] Ring status display

### Polish
- [ ] Hebrew/RTL support
- [ ] Dark theme
- [ ] Error handling
- [ ] Loading states
- [ ] Performance optimization

---

## Resources

- **EvenHub SDK Docs**: https://www.npmjs.com/package/@evenrealities/even_hub_sdk
- **EvenHub CLI Docs**: https://www.npmjs.com/package/@evenrealities/evenhub-cli
- **Current G1 App**: `/Users/alonalush/research/eye_prompt`

---

## Notes

1. **Coordinate System**: G2 uses (0,0) at top-left, X right, Y down (same as G1)
2. **Container Limits**: Maximum 4 containers per page
3. **Event Capture**: Only one container can have `isEventCapture=1`
4. **Image Updates**: Must be queued (no concurrent sends)
5. **Memory Constraints**: Glasses have limited memory - optimize image sizes

---

**Created**: January 27, 2026
**Target Completion**: TBD
