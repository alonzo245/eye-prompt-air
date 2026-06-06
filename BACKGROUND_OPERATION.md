# Background Operation & Phone Lock Support

## Overview

This document explains how to keep slides advancing even when the phone is locked or the screen is off.

## Current Implementation

### Wake Lock API
The app uses the **Screen Wake Lock API** to prevent the screen from sleeping during presentation:

```typescript
// Automatically acquired when presentation starts
const wakeLock = await navigator.wakeLock.request("screen");
```

**What it does:**
- ✅ Prevents screen from dimming/turning off while app is active
- ✅ Keeps screen on during presentation
- ✅ Automatically reacquires when page becomes visible again

**Limitations:**
- ⚠️ Only works when document is **visible** and **active**
- ⚠️ Automatically released when phone is locked
- ⚠️ Automatically released when app goes to background
- ⚠️ Cannot prevent phone lock screen

### Event Listeners
The SDK event listeners (`bridge.onEvenHubEvent()`) continue working as long as:
- Even App (native wrapper) stays active
- Web view remains connected to SDK bridge
- Phone doesn't kill the app process

## Solutions for Phone Lock

### Option 1: Keep Screen On (Recommended)
**Use Wake Lock API** - Already implemented!

**How it works:**
1. App automatically requests Wake Lock when presentation starts
2. Screen stays on during presentation
3. User can manually lock phone, but Wake Lock prevents auto-sleep

**User Instructions:**
- Keep phone unlocked during presentation
- Or set phone to "Never Lock" during presentation
- Wake Lock prevents auto-sleep, but manual lock still works

### Option 2: Even App Background Mode
**Requires Even App native support**

If Even App supports background operation:
- Events from ring/glasses may continue working
- SDK bridge may stay active in background
- Check Even App settings for background permissions

**To enable:**
1. Check Even App settings
2. Enable "Background App Refresh" (iOS) or "Background Activity" (Android)
3. Grant necessary permissions

### Option 3: Keep App in Foreground
**Simple solution**

**User Instructions:**
1. Start presentation
2. Keep Even App open and visible
3. Don't lock phone manually
4. Wake Lock will prevent auto-sleep

## Technical Details

### Wake Lock Implementation

**Location:** `src/components/Presentation.tsx`

```typescript
// Acquire wake lock on mount
useEffect(() => {
  const requestWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request("screen");
        // Screen will stay on
      } catch (err) {
        // Handle error
      }
    }
  };
  
  requestWakeLock();
  
  // Reacquire when page becomes visible
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      await requestWakeLock();
    }
  });
}, []);
```

### Visibility Monitoring

The app monitors page visibility to detect when it goes to background:

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    const isVisible = document.visibilityState === "visible";
    if (!isVisible) {
      // App went to background - events may pause
    }
  };
  
  document.addEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

## Browser Support

**Wake Lock API Support:**
- ✅ Chrome 85+
- ✅ Safari 16.4+
- ✅ Firefox 126+
- ✅ Edge 90+
- ✅ Most modern mobile browsers

**Check support:**
```javascript
if ("wakeLock" in navigator) {
  // Supported
} else {
  // Not supported - fallback needed
}
```

## Limitations

### What Wake Lock CANNOT Do:
1. ❌ Prevent manual phone lock (user pressing lock button)
2. ❌ Keep app active when phone is locked
3. ❌ Prevent app from going to background
4. ❌ Work when document is not visible

### What Wake Lock CAN Do:
1. ✅ Prevent auto-sleep (screen timeout)
2. ✅ Keep screen on while app is active
3. ✅ Reacquire lock when page becomes visible

## Best Practices

### For Users:
1. **Keep phone unlocked** during presentation
2. **Disable auto-lock** temporarily (Settings → Display → Sleep → Never)
3. **Keep Even App in foreground** - don't switch to other apps
4. **Keep phone plugged in** to prevent battery-saving mode

### For Developers:
1. Monitor visibility changes
2. Log when app goes to background
3. Reacquire Wake Lock when page becomes visible
4. Handle Wake Lock errors gracefully

## Troubleshooting

### Issue: Slides stop advancing when phone locks
**Cause:** Wake Lock is released when phone locks

**Solutions:**
1. Keep phone unlocked during presentation
2. Check if Even App supports background operation
3. Verify Wake Lock is being acquired (check logs)

### Issue: Screen still turns off
**Possible causes:**
1. Wake Lock API not supported
2. Battery saver mode enabled
3. Low battery (< 20%)
4. User manually locked phone

**Solutions:**
1. Check browser support
2. Disable battery saver
3. Charge phone
4. Keep phone unlocked

### Issue: Events stop working
**Possible causes:**
1. App went to background
2. Even App was killed by OS
3. SDK bridge disconnected

**Solutions:**
1. Keep app in foreground
2. Check Even App background permissions
3. Reinitialize SDK if needed

## Future Enhancements

### Potential Improvements:
1. **Native Wake Lock** - If Even App provides native API
2. **Background Service Worker** - Keep events active in background
3. **Foreground Service** - Android foreground service for continuous operation
4. **Notification API** - Show notification to keep app active

### Even App Integration:
- Check if Even App has native background mode
- Request background permissions if available
- Use native APIs if provided by Even App SDK

## Summary

**Current Status:**
- ✅ Wake Lock API implemented
- ✅ Visibility monitoring active
- ⚠️ Cannot prevent manual phone lock
- ⚠️ Events pause when phone locks

**Recommendation:**
- Keep phone unlocked during presentation
- Use Wake Lock to prevent auto-sleep
- Monitor logs for visibility changes
- Check Even App settings for background support
