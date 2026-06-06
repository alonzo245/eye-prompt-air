import { useEffect } from "react";
import { evenHubService } from "../../services/evenHubService";
import { logger } from "../../utils/logger";
import type { LogEntry } from "./types";

/**
 * Sync fullscreen state with document.
 */
export function useFullscreenSync(setIsFullscreen: (value: boolean) => void): void {
  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(
        !!(document.fullscreenElement ?? doc.webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    onFullscreenChange();
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [setIsFullscreen]);
}

/**
 * Lock screen orientation to landscape when presentation is active.
 */
export function useLandscapeLock(): void {
  useEffect(() => {
    if (screen.orientation && "lock" in screen.orientation) {
      (screen.orientation as { lock: (mode: string) => Promise<void> })
        .lock("landscape")
        .catch(() => {});
    }
  }, []);
}

/**
 * Update logs state periodically and reset auto-scroll when console opens.
 */
export function useLogsUpdates(
  logsVisible: boolean,
  setLogs: (logs: LogEntry[]) => void,
  setShouldAutoScroll: (value: boolean) => void,
): void {
  useEffect(() => {
    const updateLogs = () => setLogs(logger.getLogs());
    const interval = setInterval(updateLogs, 500);
    updateLogs();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsVisible) {
      setShouldAutoScroll(true);
    }
  }, [logsVisible, setShouldAutoScroll]);
}

/**
 * Timer effect: when timerRunning is true, tick every second and update glasses.
 */
export function useTimerEffect(
  timerRunning: boolean,
  setTimerSeconds: React.Dispatch<React.SetStateAction<number>>,
  timerIntervalRef: React.MutableRefObject<number | null>,
): void {
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => {
          const newSeconds = prev + 1;
          evenHubService.displayTimer(newSeconds);
          return newSeconds;
        });
      }, 1000);
    } else if (timerIntervalRef.current != null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current != null) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning, setTimerSeconds, timerIntervalRef]);
}
