import { useEffect } from "react";
import { evenHubService } from "../../services/evenHubService";
import { logger } from "../../utils/logger";

/**
 * When slide index or SDK init state changes, queue displaying that slide on the glasses.
 * Runs display operations sequentially and cancels stale ones.
 */
export function useDisplaySlideEffect(
  currentSlideIndex: number,
  totalSlides: number,
  sdkInitialized: boolean,
  displaySlide: (index: number) => Promise<boolean>,
  displayOperationRef: React.MutableRefObject<{ index: number; cancelled: boolean } | null>,
  slideDisplayLockedRef: React.MutableRefObject<boolean>,
  displayQueueRef: React.MutableRefObject<Promise<boolean>>,
  hasDisplayedFirstSlideRef: React.MutableRefObject<boolean>,
): void {
  useEffect(() => {
    if (!sdkInitialized) {
      return;
    }

    slideDisplayLockedRef.current = true;

    if (displayOperationRef.current) {
      displayOperationRef.current.cancelled = true;
      logger.device(
        `⏭️ Cancelling stale display operation for slide ${displayOperationRef.current.index + 1}`,
      );
    }

    const operation = { index: currentSlideIndex, cancelled: false };
    displayOperationRef.current = operation;

    const slideIndexToDisplay = currentSlideIndex;
    displayQueueRef.current = displayQueueRef.current.then(async () => {
      if (operation.cancelled) {
        logger.device(`⏭️ Skipping cancelled display for slide ${slideIndexToDisplay + 1}`);
        return false;
      }

      try {
        await evenHubService.showLoadingOnGlasses(slideIndexToDisplay + 1, totalSlides);
        logger.device(`📺 Displaying slide ${slideIndexToDisplay + 1}/${totalSlides}`);

        const success = await displaySlide(slideIndexToDisplay);

        if (displayOperationRef.current === operation) {
          await evenHubService.clearLoadingOnGlasses();
          slideDisplayLockedRef.current = false;
        }

        if (operation.cancelled || displayOperationRef.current !== operation) {
          return false;
        }

        if (success) {
          if (slideIndexToDisplay === 0 && !hasDisplayedFirstSlideRef.current) {
            hasDisplayedFirstSlideRef.current = true;
            logger.deviceSuccess("First slide displayed successfully");
          }
          logger.deviceSuccess(`✅ Slide ${slideIndexToDisplay + 1} displayed on glasses`);
        } else {
          logger.deviceError(`❌ Failed to display slide ${slideIndexToDisplay + 1}`);
        }
        return success;
      } catch (error) {
        if (displayOperationRef.current === operation) {
          await evenHubService.clearLoadingOnGlasses();
          slideDisplayLockedRef.current = false;
        }
        if (!operation.cancelled && displayOperationRef.current === operation) {
          logger.deviceError("Error displaying slide", {
            error: error instanceof Error ? error.message : String(error),
            slideIndex: slideIndexToDisplay,
          });
        }
        return false;
      }
    });
  }, [
    currentSlideIndex,
    totalSlides,
    sdkInitialized,
    displaySlide,
    displayOperationRef,
    slideDisplayLockedRef,
    displayQueueRef,
    hasDisplayedFirstSlideRef,
  ]);
}
