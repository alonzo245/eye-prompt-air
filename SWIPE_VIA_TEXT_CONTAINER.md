# Swipe Events via Text Container

## Short answer

**Yes.** If you put an **event-capture text container** on the glasses (or use a list container with `isEventCapture: 1`), swipe events will be delivered as **textEvent** (or **listEvent**) with `eventType` 1 or 2. The slide content itself can stay in image containers; you only need one container whose job is to capture gestures.

## How it works

- **Taps** (single/double) → always **sysEvent** (global). No container needed.
- **Swipes** → **textEvent** or **listEvent**, and only if there is a container with **isEventCapture: 1**.

So:

- **No** event-capture container → no `textEvent`/`listEvent` → **no swipe events**.
- **Yes** event-capture container (e.g. a text container wrapper) → **swipe events are available** as `textEvent` (or `listEvent` with the same `eventType` values).

## SDK constraints

- **Max 4 containers** per page (`createStartUpPageContainer` / `rebuildPageContainer`).
- **Only one** container may have `isEventCapture: 1`.

**Implemented:** We use **3** image containers (top-left, top-right, bottom-left) and **1** full-screen text container with `isEventCapture: 1`, so swipe events are now available as `textEvent`.

## Ways to get swipes

### Option A: 3 image + 1 text (event capture)

- Use **3** image containers for the slide (e.g. 3 quadrants).
- Use **1** text container:
  - Full canvas (e.g. 576×288).
  - `content: ''` (or minimal).
  - **isEventCapture: 1**.
- Result: slide in 3 regions + **swipe events** as `textEvent`.

### Option B: 1 full-screen image + 1 text (event capture)

- Use **1** image container for the whole slide (576×288) if you have (or add) a full-screen render.
- Use **1** text container:
  - Full canvas, `content: ''`, **isEventCapture: 1**.
- Result: one full-screen slide + **swipe events** as `textEvent**.

In both cases, the “text container wrapper” is just the container that has **isEventCapture: 1**. It doesn’t have to show the slide text; it only has to exist so the SDK sends swipe events.

## Summary

- Putting the “slides” in a **text container wrapper** (i.e. having a text container with **isEventCapture: 1** on the page) is exactly what makes **swipe events available**.
- Today we don’t have that wrapper (we use 4 image containers only), so swipes are not sent.
- To enable swipes we must use at most 3 containers for slide content and reserve 1 for an event-capture text (or list) container.
