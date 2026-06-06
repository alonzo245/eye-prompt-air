# SDK Event Investigation: Scroll/Swipe vs Double Tap

## Summary

**Yes — scroll/swipe are different from double tap in the SDK.**

| Gesture      | Event wrapper | eventType value        | Notes |
|-------------|----------------|------------------------|--------|
| Single tap  | `sysEvent`     | `undefined` or `0`     | Protobuf omits 0 → arrives as undefined |
| Double tap  | `sysEvent`     | `3` (DOUBLE_CLICK_EVENT) | Only in sysEvent |
| Swipe/scroll| `textEvent` **or** `listEvent` | `1` (SCROLL_TOP) or `2` (SCROLL_BOTTOM) | Same enum, different wrapper |

So:
- **Double tap** is only ever `sysEvent` with `eventType === 3`.
- **Scroll/swipe** can be either `textEvent` or `listEvent`, with `eventType === 1` or `2`.

---

## 1. Where each gesture comes from

### sysEvent (global / device taps)

- **Single tap:** `event.sysEvent.eventType === undefined` or `0` (CLICK_EVENT).
- **Double tap:** `event.sysEvent.eventType === 3` (DOUBLE_CLICK_EVENT).

Scroll does **not** come as `sysEvent`; only tap-like events do.

### textEvent (container with isEventCapture)

- **Swipe backward:** `event.textEvent.eventType === 1` (SCROLL_TOP_EVENT).
- **Swipe forward:** `event.textEvent.eventType === 2` (SCROLL_BOTTOM_EVENT).

Used when the focused/event-capture container is a **text** container.

### listEvent (list container)

- **Scroll:** `event.listEvent.eventType === 1` or `2` (same as textEvent).
- **Click (select item):** `event.listEvent.eventType === undefined` or `0` (CLICK_EVENT).

So list containers can emit **both** scroll and click; you distinguish them by `eventType`:

- `1` or `2` → scroll (track index, navigate list, etc.; do **not** treat as click).
- `undefined` or `0` → click (e.g. select item, confirm).

---

## 2. Reference: OsEventTypeList

```ts
enum OsEventTypeList {
  CLICK_EVENT = 0,           // Single tap (often arrives as undefined)
  SCROLL_TOP_EVENT = 1,     // Swipe backward
  SCROLL_BOTTOM_EVENT = 2,  // Swipe forward
  DOUBLE_CLICK_EVENT = 3,   // Double tap
  FOREGROUND_ENTER_EVENT = 4,
  FOREGROUND_EXIT_EVENT = 5,
  ABNORMAL_EXIT_EVENT = 6,
}
```

Same enum is used for `sysEvent`, `textEvent`, and `listEvent`; the **wrapper** tells you the source (device vs text container vs list container).

---

## 3. Recommended handling (from your snippet)

Your pattern is correct:

1. **listEvent**
   - If `eventType === SCROLL_TOP_EVENT || eventType === SCROLL_BOTTOM_EVENT` → **scroll**: update `lastSelectedIndex` (or similar), do **not** call click handler.
   - If `eventType === undefined || eventType === CLICK_EVENT` → **click**: e.g. `handleClick(lastSelectedIndex)`.

2. **sysEvent**
   - If `eventType === CLICK_EVENT || eventType == null` → single tap, e.g. `handleClick(lastSelectedIndex)`.
   - If `eventType === DOUBLE_CLICK_EVENT` → double tap, e.g. `handleDoubleClick(lastSelectedIndex)`.

So scroll/swipe (1 or 2) are explicitly **not** treated as double tap (3) or as click (0/undefined).

---

## 4. Implications for our app

- **Presentation (slides):**
  - **sysEvent:** single tap → next slide; double tap → next slide (or your chosen action).
  - **textEvent:** eventType 1 → previous slide; eventType 2 → next slide.
  - **listEvent:**
    - eventType 1 or 2 → treat as scroll (e.g. previous/next slide), **not** as item click.
    - eventType undefined or 0 → treat as list item click (e.g. next slide or select item).

- We should **not** treat `listEvent` with `eventType === 1` or `2` as a click; otherwise scroll and click would be confused.

---

## 5. Raw host message format (reference)

- **Single tap:** `sysEvent` with empty `jsonData` (eventType 0 omitted).
- **Double tap:** `sysEvent` with `jsonData: { eventType: 3 }`.
- **Swipe:** `textEvent` (or listEvent) with `jsonData: { containerID, containerName, eventType: 1 or 2 }`.

So scroll/swipe are indeed different from double tap both in wrapper (`textEvent`/`listEvent` vs `sysEvent`) and in `eventType` (1 or 2 vs 3).
