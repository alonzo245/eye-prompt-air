import { useEffect } from "react";
import type { MutableRefObject } from "react";
import { renderParagraphToFourQuadrants } from "../../hebrewToBmp";
import type { Show } from "../../types";
import type { PresentationStyle } from "./types";

/**
 * Pre-render all slides in the background when show is chosen.
 * Fills prerenderCacheRef with 4 quadrant BMPs per slide index (service expects 4).
 */
export function usePrerenderSlides(
  show: Show | null,
  style: PresentationStyle,
  prerenderCacheRef: MutableRefObject<Map<number, Uint8Array[]>>,
  prerenderShowIdRef: MutableRefObject<string | null>,
): void {
  useEffect(() => {
    if (!show?.slides?.length) return;

    const showId = show.id;
    if (prerenderShowIdRef.current !== showId) {
      prerenderCacheRef.current.clear();
      prerenderShowIdRef.current = showId;
    }

    const fullStyle = {
      ...show.style,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      opacity: style.opacity,
      fontFamily: style.fontFamily,
    };

    const total = show.slides.length + 1;
    let index = 0;

    const scheduleNext = () => {
      if (index >= total) return;
      const slideIndex = index;
      const content =
        slideIndex < show.slides.length
          ? show.slides[slideIndex].content.trim() || " "
          : "End :)";
      index += 1;

      const cb = () => {
        try {
          const [q1, q2, q3, q4] = renderParagraphToFourQuadrants(content, fullStyle);
          prerenderCacheRef.current.set(slideIndex, [q1, q2, q3, q4]);
        } catch (e) {
          console.warn("[Presentation] Prerender failed for slide", slideIndex, e);
        }
        if (index < total) {
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(scheduleNext, { timeout: 100 });
          } else {
            setTimeout(scheduleNext, 0);
          }
        }
      };

      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(cb, { timeout: 50 });
      } else {
        setTimeout(cb, 0);
      }
    };

    scheduleNext();
  }, [
    show?.id,
    show?.slides,
    show?.style,
    style.fontSize,
    style.lineHeight,
    style.opacity,
    style.fontFamily,
  ]);
}
