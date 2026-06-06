import { useEffect } from "react";
import { evenHubService } from "../../services/evenHubService";
import { logger } from "../../utils/logger";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";

/**
 * Keep handleEvent ref in sync and register a stable callback with the SDK.
 * The wrapper calls the ref so the latest handleEvent is always used.
 */
export function useEventCallbackRegistration(
  handleEvent: (event: EvenHubEvent) => void,
  handleEventRef: React.MutableRefObject<((event: EvenHubEvent) => void) | null>,
): void {
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent, handleEventRef]);

  useEffect(() => {
    logger.device("Registering event callback wrapper");
    const wrapperCallback = (event: EvenHubEvent) => {
      if (handleEventRef.current) {
        handleEventRef.current(event);
      } else {
        logger.device("⚠️ handleEventRef not set yet");
      }
    };
    evenHubService.setEventCallback(wrapperCallback);
    logger.deviceSuccess("Event callback registered (stable wrapper)");
    return () => {
      logger.device("Cleaning up event callback");
      evenHubService.setEventCallback(() => {});
    };
  }, [handleEventRef]);
}
