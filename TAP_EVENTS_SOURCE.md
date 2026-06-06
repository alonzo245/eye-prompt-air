# Tap Events Source - Complete Flow

## Event Source Chain

```
Hardware (Ring/Glasses)
    ↓
Even App (Native Mobile App)
    ↓
EvenHub SDK Bridge (@evenrealities/even_hub_sdk)
    ↓
waitForEvenAppBridge() → bridge object
    ↓
bridge.onEvenHubEvent() ← PRIMARY SOURCE
    ↓
EvenHubService.startEventListening()
    ↓
EvenHubService.onEventCallback
    ↓
App/Component Event Handlers
```

---

## 1. Hardware Source

**Physical Input:**
- **R1 Ring**: User taps the ring hardware
- **G2 Glasses**: User taps on glasses hardware

**What Happens:**
- Hardware detects physical tap/gesture
- Sends signal to Even App (mobile app)

---

## 2. Even App (Native Mobile App)

**Location:** Native iOS/Android app (Even App)

**What It Does:**
- Receives hardware signals from ring/glasses
- Processes gestures
- Communicates with web app via bridge

**Note:** The web app MUST be opened from Even App, not a regular browser!

---

## 3. SDK Bridge - The Primary Source

**Location:** `@evenrealities/even_hub_sdk` package

**Key Function:** `waitForEvenAppBridge()`

**File:** `src/services/evenHubService.ts` (line 76)

```typescript
this.bridge = await waitForEvenAppBridge();
```

**What It Returns:**
- A `bridge` object that provides access to SDK methods
- This bridge is the connection between Even App and your web app

---

## 4. Event Listener Registration - THE SOURCE

**Location:** `src/services/evenHubService.ts` (line 720)

**Code:**
```typescript
startEventListening() {
  if (!this.bridge) {
    logger.deviceError("Cannot start event listening - bridge not initialized");
    return;
  }

  // THIS IS WHERE TAP EVENTS COME FROM!
  this.eventUnsubscribe = this.bridge.onEvenHubEvent(
    (event: EvenHubEvent) => {
      // All tap/gesture events arrive here!
      
      // Log the raw event
      logger.device("📱 RING/DEVICE EVENT (full raw)", { raw: event });
      
      // Forward to callback
      if (this.onEventCallback) {
        this.onEventCallback(event);
      }
    }
  );
}
```

**Key Point:** `bridge.onEvenHubEvent()` is the **PRIMARY SOURCE** of all tap events!

**When It's Called:**
- Once during `evenHubService.initialize()` (line 111)
- Registered automatically when SDK initializes
- Stays active for the entire app session

---

## 5. Event Flow to Components

### Step 1: Service Receives Event
**File:** `src/services/evenHubService.ts` (line 720-772)

```typescript
this.bridge.onEvenHubEvent((event: EvenHubEvent) => {
  // Event arrives here from SDK
  
  if (this.onEventCallback) {
    this.onEventCallback(event); // Forward to component
  }
});
```

### Step 2: Component Registers Callback
**File:** `src/components/Presentation.tsx` (line 477-493)

```typescript
useEffect(() => {
  const wrapperCallback = (event: EvenHubEvent) => {
    if (handleEventRef.current) {
      handleEventRef.current(event); // Handle event
    }
  };
  
  evenHubService.setEventCallback(wrapperCallback);
  
  return () => {
    evenHubService.setEventCallback(() => {}); // Cleanup
  };
}, [handleEvent]);
```

### Step 3: Component Handles Event
**File:** `src/components/Presentation.tsx` (line 167-324)

```typescript
const handleEvent = useCallback((event: EvenHubEvent) => {
  if (event.sysEvent) {
    const eventType = event.sysEvent.eventType;
    
    // Single tap: eventType === undefined
    if (eventType === undefined || eventType === null || eventTypeNum === 0) {
      handleNextSlide(); // Move to next slide!
      return;
    }
    
    // Double tap: eventType === 3
    if (eventType === 3) {
      handleNextSlide();
      return;
    }
  }
}, [handleNextSlide]);
```

---

## Complete Initialization Flow

**File:** `src/App.tsx` (line 20-53)

```typescript
useEffect(() => {
  const initSDK = async () => {
    // 1. Initialize SDK bridge
    const initialized = await evenHubService.initialize();
    
    // 2. Inside initialize():
    //    - waitForEvenAppBridge() → gets bridge object
    //    - bridge.onEvenHubEvent() → registers event listener
    //    - Events now flow from SDK → service → components
  };
  
  initSDK();
}, []);
```

**File:** `src/services/evenHubService.ts` (line 58-125)

```typescript
async initialize(): Promise<boolean> {
  // 1. Get bridge from SDK
  this.bridge = await waitForEvenAppBridge();
  
  // 2. Start listening for events
  this.startEventListening(); // ← Registers bridge.onEvenHubEvent()
  
  return true;
}
```

---

## Event Object Structure

**Type:** `EvenHubEvent` from `@evenrealities/even_hub_sdk`

**Structure:**
```typescript
{
  sysEvent?: {
    eventType?: number | undefined  // undefined = single tap, 3 = double tap
  },
  textEvent?: {
    containerID?: number,
    containerName?: string,
    eventType?: number  // 1 = scroll up, 2 = scroll down
  },
  listEvent?: {
    containerID?: number,
    currentSelectItemName?: string,
    eventType?: number
  }
}
```

**Single Tap Event:**
```typescript
{
  sysEvent: {
    eventType: undefined  // ← This is the key!
  }
}
```

---

## Summary: Where Tap Events Come From

1. **Hardware** (Ring/Glasses) → Physical tap
2. **Even App** (Native mobile app) → Receives hardware signal
3. **SDK Bridge** (`waitForEvenAppBridge()`) → Connection to web app
4. **`bridge.onEvenHubEvent()`** ← **THIS IS THE SOURCE!**
   - Registered in: `src/services/evenHubService.ts` line 720
   - Called once during initialization
   - Receives ALL events from hardware
5. **Service Callback** (`onEventCallback`) → Forwards to components
6. **Component Handler** (`handleEvent`) → Processes tap → Moves slide

---

## Key Files

| File | Line | Purpose |
|------|------|---------|
| `src/services/evenHubService.ts` | 76 | Gets bridge: `waitForEvenAppBridge()` |
| `src/services/evenHubService.ts` | 111 | Calls `startEventListening()` |
| `src/services/evenHubService.ts` | 720 | **SOURCE:** `bridge.onEvenHubEvent()` |
| `src/services/evenHubService.ts` | 766 | Forwards to `onEventCallback` |
| `src/components/Presentation.tsx` | 477 | Registers callback with service |
| `src/components/Presentation.tsx` | 167 | Handles event → moves slide |

---

## Important Notes

1. **Only ONE listener:** `bridge.onEvenHubEvent()` is registered **once** during initialization
2. **Global events:** `sysEvent` works without containers - it's a system-level event
3. **No containers needed:** Single tap from ring/glasses works immediately after initialization
4. **Event forwarding:** Service forwards events to components via `setEventCallback()`
5. **Multiple components:** Can register callbacks, but only one listener exists at SDK level

---

## Debugging: See Events in Logs

All events are logged at multiple levels:

1. **SDK Level** (in service):
   ```typescript
   logger.device("📱 RING/DEVICE EVENT (full raw)", { raw: event });
   ```

2. **Component Level** (in Presentation):
   ```typescript
   logger.device("📱 Ring system event", { eventType, eventTypeName });
   ```

Check browser console or LogsPanel to see all incoming events!
