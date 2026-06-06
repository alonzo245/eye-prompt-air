import { useEffect } from "react";
import { evenHubService } from "../../services/evenHubService";
import type { Show } from "../../types";

/**
 * Initialize SDK when component mounts or show changes.
 * Resets first-slide flag so first slide displays after init.
 * Cleanup: clear refs and unregister event callback.
 */
export function usePresentationInit(
  show: Show | null,
  setSdkInitialized: (value: boolean) => void,
  hasDisplayedFirstSlideRef: React.MutableRefObject<boolean>,
  timerIntervalRef: React.MutableRefObject<number | null>,
  exitTimeoutRef: React.MutableRefObject<number | null>,
): void {
  useEffect(() => {
    if (!show?.slides || show.slides.length === 0) {
      return;
    }

    const init = async () => {
      try {
        let initialized = evenHubService.isInitialized();
        if (!initialized) {
          initialized = await evenHubService.initialize();
        }
        setSdkInitialized(initialized);
        if (initialized) {
          hasDisplayedFirstSlideRef.current = false;
        }
      } catch (error) {
        console.error("[Presentation] ERROR during initialization:", error);
        setSdkInitialized(false);
      }
    };

    init();

    return () => {
      hasDisplayedFirstSlideRef.current = false;
      if (timerIntervalRef.current != null) {
        clearInterval(timerIntervalRef.current);
      }
      if (exitTimeoutRef.current != null) {
        clearTimeout(exitTimeoutRef.current);
      }
      evenHubService.setEventCallback(() => {});
    };
  }, [show?.id, show?.slides?.length]);
}
