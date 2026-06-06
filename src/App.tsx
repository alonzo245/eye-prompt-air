import React, { useState, useEffect } from "react";
import { evenHubService } from "./services/evenHubService";
import { storageService } from "./services/storageService";
import { bmpStorageService } from "./services/bmpStorageService";
import { logger } from "./utils/logger";
import { checkCredentials } from "./credentials";
import { Home } from "./home";
import { RealTextPrompter } from "./realTextPrompter";
import "./App.css";

const AUTH_STORAGE_KEY = "app_auth";
const AUTH_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

type Section = "home" | "realTextPrompter";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function isAuthenticated(): boolean {
  if (isLocalhost()) return true;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const expiry = Number(raw);
    if (!Number.isFinite(expiry) || Date.now() >= expiry) return false;
    return true;
  } catch {
    return false;
  }
}

function setAuthExpiry(): void {
  try {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      String(Date.now() + AUTH_DURATION_MS),
    );
  } catch {}
}

export const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated);
  const [currentSection, setCurrentSection] = useState<Section>("home");
  const [, setSdkInitialized] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [, setLogsTick] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const initSDK = async () => {
      logger.connection("=== App Initialization Started ===");
      logger.connection("Initializing BMP storage (IndexedDB)...");

      try {
        await bmpStorageService.init();
        logger.connectionSuccess("BMP storage initialized");

        logger.connection("Initializing EvenHub SDK...");
        const initialized = await evenHubService.initialize();

        if (initialized) {
          const bridge = evenHubService.getBridge();
          storageService.setBridge(bridge);
          setSdkInitialized(true);
          logger.connectionSuccess("=== App Initialization Complete ===");
          logger.deviceSuccess("SDK bridge ready - glasses connection active");
        } else {
          const errorMsg =
            "SDK initialization failed. App will work in offline mode.";
          logger.connectionError(errorMsg);
          setSdkError(errorMsg);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.connectionError("SDK initialization error", { error: errorMsg });
        setSdkError("SDK initialization error. App will work in offline mode.");
      }
    };

    initSDK();
  }, []);

  // Refresh logs panel when visible (every 1.5s)
  React.useEffect(() => {
    if (!showLogs) return;
    const id = setInterval(() => setLogsTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, [showLogs]);

  if (!authenticated && !isLocalhost()) {
    return (
      <div className="app app-login" dir="rtl">
        <div className="login-box">
          <h1 className="login-title">כניסה</h1>
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLoginError(null);
              const form = e.currentTarget;
              const username =
                (form.elements.namedItem("username") as HTMLInputElement)
                  ?.value ?? "";
              const password =
                (form.elements.namedItem("password") as HTMLInputElement)
                  ?.value ?? "";
              if (checkCredentials(username, password)) {
                setAuthExpiry();
                setAuthenticated(true);
              } else {
                setLoginError("שם משתמש או סיסמה לא נכונים");
              }
            }}
          >
            <label className="login-label">שם משתמש</label>
            <input
              type="text"
              name="username"
              className="login-input"
              autoComplete="username"
              autoFocus
            />
            <label className="login-label">סיסמה</label>
            <input
              type="password"
              name="password"
              className="login-input"
              autoComplete="current-password"
            />
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="login-submit">
              כניסה
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app" dir="rtl">
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav-item ${currentSection === "home" ? "active" : ""}`}
          onClick={() => setCurrentSection("home")}
        >
          בית
        </button>
        {/* <button
          type="button"
          className={`app-nav-item ${currentSection === "realTextPrompter" ? "active" : ""}`}
          onClick={() => setCurrentSection("realTextPrompter")}
        >
          Real Text Prompter
        </button> */}
        <button
          type="button"
          className={`app-nav-item app-nav-logs ${showLogs ? "active" : ""}`}
          onClick={() => setShowLogs((v) => !v)}
          title={showLogs ? "הסתר לוגים" : "הצג לוגים"}
        >
          {showLogs ? "🔽 לוגים" : "📋 לוגים"}
        </button>
        {!isLocalhost() && (
          <button
            type="button"
            className="app-nav-item"
            onClick={() => {
              try {
                localStorage.removeItem(AUTH_STORAGE_KEY);
              } catch {}
              setAuthenticated(false);
            }}
            title="יציאה"
          >
            יציאה
          </button>
        )}
      </nav>

      {showLogs && (
        <div className="app-logs-panel">
          <div className="app-logs-header">
            <span>לוגים</span>
            <div className="app-logs-header-actions">
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => {
                  const lines = logger.getLogs().map((entry) => {
                    const dataStr =
                      entry.data != null
                        ? typeof entry.data === "object"
                          ? JSON.stringify(entry.data)
                          : String(entry.data)
                        : "";
                    return `${entry.timestamp} [${entry.category}] ${entry.message}${dataStr ? " " + dataStr : ""}`;
                  });
                  const text = lines.join("\n");
                  navigator.clipboard.writeText(text).then(
                    () => {
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 1500);
                    },
                    () => {},
                  );
                }}
                title="העתק ללוח"
              >
                {copyFeedback ? "✓ הועתק" : "📋 העתק"}
              </button>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => {
                  logger.clear();
                  setLogsTick((t) => t + 1);
                }}
              >
                נקה
              </button>
            </div>
          </div>
          <div className="app-logs-list">
            {logger.getLogs().map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className={`app-log-line app-log-${entry.level}`}
              >
                <span className="app-log-time">{entry.timestamp}</span>
                <span className="app-log-cat">[{entry.category}]</span>
                <span className="app-log-msg">{entry.message}</span>
                {entry.data != null && (
                  <pre className="app-log-data">
                    {typeof entry.data === "object"
                      ? JSON.stringify(entry.data, null, 0)
                      : String(entry.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sdkError && (
        <div className="sdk-warning">
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
            <h3 style={{ marginBottom: "12px", color: "#ff9800" }}>
              ⚠️ לא מחובר למשקפיים
            </h3>
            <p style={{ marginBottom: "8px" }}>{sdkError}</p>
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                padding: "12px",
                borderRadius: "6px",
                marginTop: "12px",
              }}
            >
              <p style={{ marginBottom: "8px", fontWeight: "bold" }}>
                כדי להתחבר למשקפיים:
              </p>
              <ol style={{ marginRight: "20px", lineHeight: "1.8" }}>
                <li>
                  הפעל את שרת הפיתוח: <code>npm run dev</code>
                </li>
                <li>
                  בטרמינל נפרד, צור QR code: <code>npm run qr</code>
                </li>
                <li>פתח את Even App בטלפון</li>
                <li>סרוק את ה-QR code</li>
                <li>חבר את המשקפיים ל-Even App</li>
              </ol>
              <p
                style={{
                  marginTop: "12px",
                  fontSize: "14px",
                  color: "#bbb",
                }}
              >
                האפליקציה תמשיך לעבוד במצב תצוגה מקדימה ללא חיבור למשקפיים.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        {currentSection === "home" && <Home />}
        {currentSection === "realTextPrompter" && <RealTextPrompter />}
      </main>
    </div>
  );
};
