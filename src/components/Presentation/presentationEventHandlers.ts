import type { MutableRefObject } from "react";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { OsEventTypeList } from "@evenrealities/even_hub_sdk";
import { logger } from "../../utils/logger";

export function matchesEventType(
  eventType: unknown,
  targetType: OsEventTypeList | number,
): boolean {
  if (eventType === targetType) return true;
  if (eventType === String(targetType)) return true;

  const enumKey = Object.keys(OsEventTypeList).find(
    (key) =>
      OsEventTypeList[key as keyof typeof OsEventTypeList] === targetType,
  );
  if (eventType === enumKey) return true;

  if (typeof targetType === "number") {
    const targetEnumKey = Object.keys(OsEventTypeList).find(
      (key) =>
        OsEventTypeList[key as keyof typeof OsEventTypeList] === targetType,
    );
    if (
      targetEnumKey &&
      eventType ===
        OsEventTypeList[targetEnumKey as keyof typeof OsEventTypeList]
    ) {
      return true;
    }
  }

  return false;
}

export function getEventTypeName(eventType: unknown): string {
  if (eventType === undefined || eventType === null) return "UNDEFINED";
  return (
    Object.keys(OsEventTypeList).find(
      (key) =>
        OsEventTypeList[key as keyof typeof OsEventTypeList] === eventType,
    ) ?? `UNKNOWN(${eventType})`
  );
}

export function createPresentationEventHandler(deps: {
  lastGestureTimeRef: MutableRefObject<number>;
  slideDisplayLockedRef: MutableRefObject<boolean>;
  gestureDebounceMs: number;
  onNextSlide: () => void;
  onPreviousSlide: () => void;
}): (event: EvenHubEvent) => void {
  const {
    lastGestureTimeRef,
    slideDisplayLockedRef,
    gestureDebounceMs,
    onNextSlide,
    onPreviousSlide,
  } = deps;

  return function handleEvent(event: EvenHubEvent) {
    if (slideDisplayLockedRef.current) {
      logger.device("⏸️ Gesture ignored — slide display in progress");
      return;
    }

    const now = Date.now();
    const timeSinceLastGesture = now - lastGestureTimeRef.current;

    logger.device("📱 Ring/Event received", {
      hasSysEvent: !!event.sysEvent,
      hasTextEvent: !!event.textEvent,
      hasListEvent: !!event.listEvent,
      timeSinceLastGesture,
      debounced: timeSinceLastGesture < gestureDebounceMs,
    });

    if (timeSinceLastGesture < gestureDebounceMs) {
      logger.device(
        `⏸️ Gesture debounced (${timeSinceLastGesture}ms < ${gestureDebounceMs}ms)`,
      );
      return;
    }

    if (event.sysEvent) {
      handleSysEvent(event.sysEvent, onNextSlide, onPreviousSlide);
      return;
    }

    if (event.textEvent) {
      handleTextEvent(event.textEvent, onNextSlide, onPreviousSlide);
      return;
    }

    if (event.listEvent) {
      handleListEvent(event.listEvent, onNextSlide);
    }
  };
}

function handleSysEvent(
  sysEvent: NonNullable<EvenHubEvent["sysEvent"]>,
  onNextSlide: () => void,
  onPreviousSlide: () => void,
): void {
  const eventType = sysEvent.eventType;
  const eventTypeName = getEventTypeName(eventType);

  const eventTypeNum =
    typeof eventType === "number"
      ? eventType
      : parseInt(String(eventType), 10);

  logger.device("📱 Ring system event", {
    eventType,
    eventTypeName,
    rawType: typeof eventType,
    eventTypeNum,
    isScrollTop: eventType === 1 || String(eventType) === "1" || eventTypeNum === 1,
    isScrollBottom: eventType === 2 || String(eventType) === "2" || eventTypeNum === 2,
  });

  if (
    eventType === 3 ||
    String(eventType) === "3" ||
    matchesEventType(eventType, OsEventTypeList.DOUBLE_CLICK_EVENT)
  ) {
    logger.deviceSuccess("✅ Ring DOUBLE_TAP → Next slide");
    onNextSlide();
    return;
  }

  if (
    eventType === 1 ||
    String(eventType) === "1" ||
    matchesEventType(eventType, OsEventTypeList.SCROLL_TOP_EVENT)
  ) {
    logger.deviceSuccess("✅ Ring SCROLL_UP → Next slide");
    onNextSlide();
    return;
  }

  if (
    eventType === 2 ||
    String(eventType) === "2" ||
    matchesEventType(eventType, OsEventTypeList.SCROLL_BOTTOM_EVENT)
  ) {
    logger.deviceSuccess("✅ Ring SCROLL_DOWN → Previous slide");
    onPreviousSlide();
    return;
  }

  // Single tap (CLICK_EVENT / undefined) intentionally ignored — SDK often sends undefined for single tap
  logger.device("📱 Ring SINGLE_TAP or unknown sysEvent — ignored", {
    eventType,
    eventTypeName,
  });
}

function handleTextEvent(
  textEvent: NonNullable<EvenHubEvent["textEvent"]>,
  onNextSlide: () => void,
  onPreviousSlide: () => void,
): void {
  const eventType = textEvent.eventType;
  const eventTypeNum =
    typeof eventType === "number"
      ? eventType
      : parseInt(String(eventType), 10);

  logger.device("📝 Text container event", {
    containerID: textEvent.containerID,
    containerName: textEvent.containerName,
    eventType,
  });

  // if (
  //   eventType === 2 ||
  //   String(eventType) === "2" ||
  //   eventTypeNum === 2 ||
  //   matchesEventType(eventType, OsEventTypeList.SCROLL_BOTTOM_EVENT)
  // ) {
  //   logger.deviceSuccess("✅ TextEvent SCROLL_DOWN → Previous slide");
  //   onPreviousSlide();
  //   return;
  // }

  // if (
  //   eventType === 1 ||
  //   String(eventType) === "1" ||
  //   eventTypeNum === 1 ||
  //   matchesEventType(eventType, OsEventTypeList.SCROLL_TOP_EVENT)
  // ) {
  //   logger.deviceSuccess("✅ TextEvent SCROLL_UP → Next slide");
  //   onNextSlide();
  //   return;
  // }

  if (
    eventType === 3 ||
    String(eventType) === "3" ||
    eventTypeNum === 3 ||
    matchesEventType(eventType, OsEventTypeList.DOUBLE_CLICK_EVENT)
  ) {
    logger.deviceSuccess("✅ TextEvent DOUBLE_TAP → Next slide");
    onNextSlide();
    return;
  }

  // Single tap (CLICK_EVENT / undefined) intentionally ignored
  logger.device("📝 TextEvent SINGLE_TAP or unknown — ignored", { eventType });
}

function handleListEvent(
  listEvent: NonNullable<EvenHubEvent["listEvent"]>,
  onNextSlide: () => void,
): void {
  const listEventType = listEvent.eventType;

  logger.device("📋 List container event", {
    containerID: listEvent.containerID,
    containerName: listEvent.containerName,
    eventType: listEventType,
  });

  if (
    matchesEventType(listEventType, OsEventTypeList.DOUBLE_CLICK_EVENT) ||
    listEventType === 3
  ) {
    logger.deviceSuccess("✅ List container DOUBLE_TAP → Next slide");
    onNextSlide();
  }
}
