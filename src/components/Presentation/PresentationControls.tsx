import React from "react";

interface PresentationControlsProps {
  controlsRef: React.RefObject<HTMLDivElement | null>;
  presentationRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  controlsVisible: boolean;
  setControlsVisible: (value: boolean) => void;
  isExiting: boolean;
  onExit: () => void;
  logsVisible: boolean;
  setLogsVisible: (value: boolean) => void;
  logsCount: number;
  onControlsClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  controlsRef,
  presentationRef,
  isFullscreen,
  controlsVisible,
  setControlsVisible,
  isExiting,
  onExit,
  logsVisible,
  setLogsVisible,
  logsCount,
  onControlsClick,
}) => {
  const toggleFullscreen = () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const inFullscreen = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
    if (inFullscreen) {
      const exitFn = document.exitFullscreen ?? doc.webkitExitFullscreen;
      if (typeof exitFn === "function") exitFn.call(document).catch(() => {});
    } else {
      setControlsVisible(false);
      const el = presentationRef.current ?? document.documentElement;
      const reqFn =
        (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen ??
        (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
      if (typeof reqFn === "function") reqFn.call(el).catch(() => {});
    }
  };

  return (
    <>
      {controlsVisible && (
        <div
          className="presentation-controls"
          ref={controlsRef}
          onClick={onControlsClick}
        >
          <div className="controls-row controls-row-primary">
            <button
              onClick={toggleFullscreen}
              className="btn btn-control presentation-primary-btn"
            >
              {isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
            </button>
            <button
              onClick={onExit}
              className="btn btn-danger presentation-exit-btn"
              disabled={isExiting}
            >
              {isExiting ? "יוצא..." : "יציאה"}
            </button>
          </div>
          <div className="controls-row">
            <button
              onClick={() => setLogsVisible(!logsVisible)}
              className="btn btn-control"
              style={{ flex: "0 0 auto" }}
            >
              {logsVisible ? "🔽 הסתר לוגים" : "🔼 הצג לוגים"}
            </button>
            <span
              style={{
                flex: "1",
                textAlign: "right",
                color: "#999",
                fontSize: "12px",
                padding: "0 12px",
              }}
            >
              {logsCount} הודעות
            </span>
          </div>
        </div>
      )}

      {!controlsVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setControlsVisible(true);
          }}
          className="btn btn-control show-controls-btn"
        >
          הצג פקדים
        </button>
      )}
    </>
  );
};
