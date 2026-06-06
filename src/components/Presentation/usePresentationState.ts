import { useState, useRef } from "react";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";
import type { Show } from "../../types";
import type { LogEntry } from "./types";

export function usePresentationState(show: Show) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [fontFamily] = useState(show.style.fontFamily);
  const [fontSize] = useState(show.style.fontSize);
  const [lineHeight] = useState(show.style.lineHeight);
  const [opacity] = useState(show.style.opacity);
  const [timerRunning] = useState(false);
  const [, setTimerSeconds] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVisibleOnGlasses, setImageVisibleOnGlasses] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [sdkInitialized, setSdkInitialized] = useState(false);

  const imageVisibleOnGlassesRef = useRef(true);
  const hasDisplayedFirstSlideRef = useRef(false);
  const timerIntervalRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const consoleContentRef = useRef<HTMLDivElement>(null);
  const currentSlideIndexRef = useRef(0);
  const displaySlideRef = useRef<((index: number) => Promise<boolean>) | null>(null);
  const handleEventRef = useRef<((event: EvenHubEvent) => void) | null>(null);
  const lastGestureTimeRef = useRef<number>(0);
  const displayOperationRef = useRef<{ index: number; cancelled: boolean } | null>(null);
  const slideDisplayLockedRef = useRef(false);
  const displayQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const prerenderCacheRef = useRef<Map<number, Uint8Array[]>>(new Map());
  const prerenderShowIdRef = useRef<string | null>(null);

  const totalSlides = show.slides.length + 1;
  const isEndScreen = currentSlideIndex >= show.slides.length;
  const currentSlide = isEndScreen
    ? { content: "End :)" }
    : show.slides[currentSlideIndex];

  return {
    // State
    currentSlideIndex,
    setCurrentSlideIndex,
    fontFamily,
    fontSize,
    lineHeight,
    opacity,
    timerRunning,
    setTimerSeconds,
    controlsVisible,
    setControlsVisible,
    isFullscreen,
    setIsFullscreen,
    imageVisibleOnGlasses,
    setImageVisibleOnGlasses,
    isExiting,
    setIsExiting,
    logsVisible,
    setLogsVisible,
    logs,
    setLogs,
    shouldAutoScroll,
    setShouldAutoScroll,
    sdkInitialized,
    setSdkInitialized,
    // Derived
    totalSlides,
    isEndScreen,
    currentSlide,
    // Refs
    imageVisibleOnGlassesRef,
    hasDisplayedFirstSlideRef,
    timerIntervalRef,
    exitTimeoutRef,
    controlsRef,
    presentationRef,
    logsEndRef,
    consoleContentRef,
    currentSlideIndexRef,
    displaySlideRef,
    handleEventRef,
    lastGestureTimeRef,
    displayOperationRef,
    slideDisplayLockedRef,
    displayQueueRef,
    prerenderCacheRef,
    prerenderShowIdRef,
  };
}
