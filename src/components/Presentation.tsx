import React, { useEffect, useCallback, useRef } from "react";
import { evenHubService } from "../services/evenHubService";
import { logger } from "../utils/logger";
import type { PresentationProps, PresentationStyle } from "./Presentation/types";
import { GESTURE_DEBOUNCE_MS } from "./Presentation/types";
import { usePresentationState } from "./Presentation/usePresentationState";
import { usePrerenderSlides } from "./Presentation/usePrerenderSlides";
import { usePresentationInit } from "./Presentation/usePresentationInit";
import { useEventCallbackRegistration } from "./Presentation/useEventCallbackRegistration";
import {
  useFullscreenSync,
  useLandscapeLock,
  useLogsUpdates,
  useTimerEffect,
} from "./Presentation/usePresentationEffects";
import { useDisplaySlideEffect } from "./Presentation/useDisplaySlideEffect";
import { createPresentationEventHandler } from "./Presentation/presentationEventHandlers";
import { PresentationControls } from "./Presentation/PresentationControls";
import { PresentationLogsOverlay } from "./Presentation/PresentationLogsOverlay";
import "./Presentation.css";

export const Presentation: React.FC<PresentationProps> = ({ show, onExit }) => {
  const state = usePresentationState(show);
  const {
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
    totalSlides,
    currentSlide,
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
  } = state;

  const style: PresentationStyle = { fontFamily, fontSize, lineHeight, opacity };
  const lastImuActionRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    imageVisibleOnGlassesRef.current = state.imageVisibleOnGlasses;
  }, [state.imageVisibleOnGlasses, imageVisibleOnGlassesRef]);
  
  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex;
  }, [currentSlideIndex, currentSlideIndexRef]);

  usePrerenderSlides(show, style, prerenderCacheRef, prerenderShowIdRef);

  const handleNextSlide = useCallback(() => {
    if (slideDisplayLockedRef.current) {
      logger.device("⏸️ Next slide blocked — display in progress");
      return;
    }
    lastGestureTimeRef.current = Date.now();
    logger.device("▶️ handleNextSlide called");
    setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides, setCurrentSlideIndex, lastGestureTimeRef, slideDisplayLockedRef]);

  const handlePreviousSlide = useCallback(() => {
    if (slideDisplayLockedRef.current) {
      logger.device("⏸️ Previous slide blocked — display in progress");
      return;
    }
    lastGestureTimeRef.current = Date.now();
    logger.device("◀️ handlePreviousSlide called");
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, [setCurrentSlideIndex, lastGestureTimeRef, slideDisplayLockedRef]);

  const handleEvent = useCallback(
    createPresentationEventHandler({
      lastGestureTimeRef,
      slideDisplayLockedRef,
      gestureDebounceMs: GESTURE_DEBOUNCE_MS,
      onNextSlide: handleNextSlide,
      onPreviousSlide: handlePreviousSlide,
    }),
    [handleNextSlide, handlePreviousSlide, lastGestureTimeRef, slideDisplayLockedRef],
  );

  usePresentationInit(
    show,
    setSdkInitialized,
    hasDisplayedFirstSlideRef,
    timerIntervalRef,
    exitTimeoutRef,
  );

  useEventCallbackRegistration(handleEvent, handleEventRef);

  const displaySlide = useCallback(
    async (index: number): Promise<boolean> => {
      if (index < 0 || index >= totalSlides) return false;

      const isEndScreenSlide = index >= show.slides.length;
      const content = isEndScreenSlide ? "End :)" : show.slides[index].content;
      const fullStyle = { ...show.style, fontSize, lineHeight, opacity, fontFamily };

      try {
        const prerendered = prerenderCacheRef.current.get(index);
        const result = prerendered
          ? await evenHubService.displaySlideWithPreRenderedQuadrants(prerendered, "both")
          : await evenHubService.displaySlide(content, fullStyle, "both");

        if (result) setImageVisibleOnGlasses(true);
        return result;
      } catch (error) {
        console.error("[Presentation] Exception displaying slide:", error);
        return false;
      }
    },
    [show, totalSlides, fontSize, lineHeight, opacity, fontFamily, prerenderCacheRef, setImageVisibleOnGlasses],
  );

  useEffect(() => {
    displaySlideRef.current = displaySlide;
    return () => {
      displaySlideRef.current = null;
    };
  }, [displaySlide, displaySlideRef]);

  useDisplaySlideEffect(
    currentSlideIndex,
    totalSlides,
    sdkInitialized,
    displaySlide,
    displayOperationRef,
    slideDisplayLockedRef,
    displayQueueRef,
    hasDisplayedFirstSlideRef,
  );

  useFullscreenSync(setIsFullscreen);
  useLandscapeLock();
  useLogsUpdates(logsVisible, setLogs, setShouldAutoScroll);
  useTimerEffect(timerRunning, setTimerSeconds, timerIntervalRef);

  useEffect(() => {
    if (!sdkInitialized) return;

    const IMU_DEBOUNCE_MS = 500;
    const IMU_TILT_THRESHOLD = 4.0;

    evenHubService.setImuDataCallback(({ x }) => {
      const now = Date.now();
      if (now - lastImuActionRef.current < IMU_DEBOUNCE_MS) return;
      if (x >= IMU_TILT_THRESHOLD) {
        lastImuActionRef.current = now;
        logger.device("IMU tilt → next slide", { x });
        handleNextSlide();
        return;
      }
      if (x <= -IMU_TILT_THRESHOLD) {
        lastImuActionRef.current = now;
        logger.device("IMU tilt → previous slide", { x });
        handlePreviousSlide();
      }
    });

    evenHubService.enableImu().catch(() => {});
    return () => {
      evenHubService.setImuDataCallback(null);
      evenHubService.disableImu().catch(() => {});
    };
  }, [sdkInitialized, handleNextSlide, handlePreviousSlide]);

  useEffect(() => {
    if (!logsVisible || !shouldAutoScroll || !logsEndRef.current || !consoleContentRef.current) return;
    logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs, logsVisible, shouldAutoScroll, logsEndRef, consoleContentRef]);

  const handleConsoleScroll = useCallback(() => {
    if (!consoleContentRef.current) return;
    const el = consoleContentRef.current;
    setShouldAutoScroll(el.scrollHeight - el.scrollTop <= el.clientHeight + 50);
  }, [setShouldAutoScroll, consoleContentRef]);

  const handleExit = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      exitTimeoutRef.current = window.setTimeout(() => setIsExiting(false), 20000);
      await evenHubService.shutdown();
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      onExit();
    } catch (error) {
      console.error("[Presentation] Error during exit:", error);
      setIsExiting(false);
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    }
  }, [onExit, setIsExiting, exitTimeoutRef]);

  const handleControlsClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  if (!show?.slides?.length) {
    return (
      <div className="presentation">
        <div className="error-message" style={{ padding: "40px", textAlign: "center" }}>
          שגיאה: המופע אינו מכיל שקופיות
        </div>
        <button onClick={onExit} className="btn btn-danger" style={{ margin: "20px auto", display: "block" }}>
          חזור
        </button>
      </div>
    );
  }

  return (
    <div className="presentation" ref={presentationRef}>
      <PresentationControls
        controlsRef={controlsRef}
        presentationRef={presentationRef}
        isFullscreen={isFullscreen}
        controlsVisible={controlsVisible}
        setControlsVisible={setControlsVisible}
        isExiting={isExiting}
        onExit={handleExit}
        logsVisible={logsVisible}
        setLogsVisible={setLogsVisible}
        logsCount={logs.length}
        onControlsClick={handleControlsClick}
      />

      <PresentationLogsOverlay
        logsVisible={logsVisible}
        setLogsVisible={setLogsVisible}
        logs={logs}
        consoleContentRef={consoleContentRef}
        logsEndRef={logsEndRef}
        onConsoleScroll={handleConsoleScroll}
      />

      <div className="slide-preview">
        {!evenHubService.isInitialized() && (
          <div className="connection-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>לא מחובר למשקפיים</strong>
              <p>האפליקציה חייבת להיפתח דרך Even App, לא דרך דפדפן רגיל</p>
              <p>השתמש ב-<code>npm run qr</code> כדי ליצור QR code</p>
            </div>
          </div>
        )}
        <div
          className="slide-content"
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight,
            opacity: opacity / 100,
          }}
        >
          {currentSlide?.content}
        </div>
      </div>
    </div>
  );
};
