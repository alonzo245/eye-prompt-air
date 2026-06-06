import React from "react";
import { logger } from "../../utils/logger";
import type { LogEntry } from "./types";

interface PresentationLogsOverlayProps {
  logsVisible: boolean;
  setLogsVisible: (value: boolean) => void;
  logs: LogEntry[];
  consoleContentRef: React.RefObject<HTMLDivElement | null>;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
  onConsoleScroll: () => void;
}

export const PresentationLogsOverlay: React.FC<PresentationLogsOverlayProps> = ({
  logsVisible,
  setLogsVisible,
  logs,
  consoleContentRef,
  logsEndRef,
  onConsoleScroll,
}) => {
  if (!logsVisible) return null;

  const handleCopyLogs = async () => {
    try {
      const logsText = logs
        .map((log) => {
          const time = log.timestamp.split("T")[1].split(".")[0];
          const level = log.level.toUpperCase();
          const category = log.category;
          const message = log.message;
          const data = log.data ? ` ${JSON.stringify(log.data)}` : "";
          return `[${time}] [${category}] ${level}: ${message}${data}`;
        })
        .join("\n");
      await navigator.clipboard.writeText(logsText);
      logger.success("LOGS", "Logs copied to clipboard");
    } catch (error) {
      logger.error("LOGS", "Failed to copy logs", error);
    }
  };

  return (
    <div className="console-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="console-output-fullscreen">
        <div className="console-header-fullscreen">
          <span>לוגי חיבור למשקפיים</span>
          <div className="console-header-actions">
            <button
              onClick={handleCopyLogs}
              className="btn btn-control"
              title="העתק ללוח"
            >
              📋 העתק
            </button>
            <button onClick={() => logger.clear()} className="btn btn-control">
              🗑️ נקה
            </button>
            <button
              onClick={() => setLogsVisible(false)}
              className="btn btn-danger"
            >
              ✕ סגור
            </button>
          </div>
        </div>
        <div
          className="console-content-fullscreen"
          ref={consoleContentRef}
          onScroll={onConsoleScroll}
        >
          {logs.length === 0 ? (
            <div className="console-empty">אין הודעות לוג</div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`console-line console-${log.level}`}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="console-time">
                    {log.timestamp.split("T")[1].split(".")[0]}
                  </span>
                  <span className="console-category">[{log.category}]</span>
                </div>
                <span className="console-message">{log.message}</span>
                {log.data != null && (
                  <span className="console-data">
                    {JSON.stringify(log.data, null, 2)}
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
