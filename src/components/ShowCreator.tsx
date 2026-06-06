import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import type { Show, TextStyle, Slide, TextAlignment } from "../types";
import { DEFAULT_TEXT_STYLE } from "../types";
import { storageService } from "../services/storageService";
import "./ShowCreator.css";

interface ShowCreatorProps {
  show?: Show; // Optional: if provided, we're editing an existing show
  onCancel: () => void;
  onSave: (show: Show) => void;
}

/** Content max length per Even OS 2.0 textContainerUpgrade */
const CONTENT_MAX_CHARS = 30000;

/**
 * Max characters per slide that fit on the glasses (one full 320×160 quadrant canvas).
 * Derived from example: 9 lines of "Nל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#" including spaces.
 */
const MAX_CHARS_PER_SLIDE =
  "1ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n2ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n3ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n4ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n5ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n6ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n7ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n8ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#\n8ל תשכחו מה ברוס לי היה אומר: וואטצ׳ה#"
    .length;

/** Given full text and cursor offset, return 0-based slide index (paragraph) that contains that position, or null. */
function getSlideIndexAtCursor(
  text: string,
  cursorOffset: number,
): number | null {
  const re = /\n\s*\n/g;
  const starts: number[] = [0];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    starts.push(m.index + m[0].length);
  }
  let slideIndex = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1]! : text.length;
    const segment = text.slice(starts[i]!, end);
    if (segment.trim()) {
      if (cursorOffset >= starts[i]! && cursorOffset <= end) {
        return slideIndex;
      }
      slideIndex++;
    }
  }
  return null;
}

const FONT_OPTIONS: Array<{ value: TextStyle["fontFamily"]; label: string }> = [
  { value: "Haim Design Bold", label: "Haim Design Bold" },
  { value: "Rubik", label: "Rubik Regular" },
  { value: "Rubik Black", label: "Rubik Black" },
  { value: "Rubik Bold", label: "Rubik Bold" },
  { value: "Rubik Light", label: "Rubik Light" },
  { value: "Rubik Medium", label: "Rubik Medium" },
  { value: "Rubik SemiBold", label: "Rubik SemiBold" },
  { value: "Rubik ExtraBold", label: "Rubik ExtraBold" },
  { value: "Haim Design", label: "Haim Design" },
  { value: "Haim Design Black", label: "Haim Design Black" },
  { value: "Joker Bold", label: "Joker Bold" },
  { value: "Lunasima Bold", label: "Lunasima Bold" },
  { value: "Noto Sans Hebrew", label: "Noto Sans Hebrew" },
  {
    value: "Noto Sans Hebrew Condensed Black",
    label: "Noto Sans Hebrew Condensed Black",
  },
  { value: "Open Sans Condensed Bold", label: "Open Sans Condensed Bold" },
  {
    value: "Open Sans Condensed ExtraBold",
    label: "Open Sans Condensed ExtraBold",
  },
  {
    value: "Open Sans SemiCondensed Bold",
    label: "Open Sans SemiCondensed Bold",
  },
  { value: "Spacer Bold", label: "Spacer Bold" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "David", label: "David" },
  { value: "serif", label: "Serif" },
];

export const ShowCreator: React.FC<ShowCreatorProps> = ({
  show,
  onCancel,
  onSave,
}) => {
  const isEditing = !!show;

  // Initialize state from show if editing, otherwise use defaults
  const [textInput, setTextInput] = useState(() => {
    if (show) {
      // Combine all slide contents with double newlines
      return show.slides.map((slide) => slide.content).join("\n\n");
    }
    return "";
  });

  const [showName, setShowName] = useState(() => {
    if (show) {
      // Remove timestamp suffix if present
      const name = show.name;
      const timestampMatch = name.match(/^(.+?)\s*-\s*\d+$/);
      return timestampMatch ? timestampMatch[1] : name;
    }
    return "";
  });

  const [style, setStyle] = useState<TextStyle>(() => {
    return show
      ? { ...DEFAULT_TEXT_STYLE, ...show.style }
      : DEFAULT_TEXT_STYLE;
  });

  const [textareaFullscreen, setTextareaFullscreen] = useState(false);
  const [cursorSlideIndex, setCursorSlideIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateCursorSlideIndex = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const idx = getSlideIndexAtCursor(textInput, el.selectionStart);
    setCursorSlideIndex(idx);
  }, [textInput]);

  useEffect(() => {
    updateCursorSlideIndex();
  }, [textInput, updateCursorSlideIndex]);

  // Per-slide character counts, row counts, and overflow (same split logic as handleCreateShow)
  const slideStats = useMemo(() => {
    const paragraphs = textInput.split(/\n\s*\n/).filter((p) => p.trim());
    return paragraphs.map((p) => {
      const trimmed = p.trim();
      const len = trimmed.length;
      const rows = trimmed ? trimmed.split(/\n/).length : 0;
      return {
        chars: len,
        rows,
        over: len > MAX_CHARS_PER_SLIDE,
        overBy: Math.max(0, len - MAX_CHARS_PER_SLIDE),
      };
    });
  }, [textInput]);

  const hasAnyOverflow = slideStats.some((s) => s.over);

  // Update state when show prop changes
  useEffect(() => {
    if (show) {
      setTextInput(show.slides.map((slide) => slide.content).join("\n\n"));
      const name = show.name;
      const timestampMatch = name.match(/^(.+?)\s*-\s*\d+$/);
      setShowName(timestampMatch ? timestampMatch[1] : name);
      setStyle({ ...DEFAULT_TEXT_STYLE, ...show.style });
    }
  }, [show]);

  const handleCreateShow = async () => {
    if (!textInput.trim()) {
      alert("אנא הזן טקסט למופע");
      return;
    }

    // Split text by double newlines to create slides
    const paragraphs = textInput.split(/\n\s*\n/).filter((p) => p.trim());

    if (paragraphs.length === 0) {
      alert("אנא הזן לפחות פסקה אחת");
      return;
    }

    const slides: Slide[] = paragraphs.map((content, index) => ({
      id: `slide-${Date.now()}-${index}`,
      content: content.trim(),
      order: index,
    }));

    const name =
      showName.trim() || `מופע ${new Date().toLocaleString("he-IL")}`;
    const finalName = name;

    const updatedShow: Show = {
      id: show?.id || `show-${Date.now()}`, // Preserve ID if editing
      name: finalName,
      createdAt: show?.createdAt || Date.now(), // Preserve creation date if editing
      slides,
      style: { ...style },
    };

    const saved = await storageService.saveShow(updatedShow);
    if (saved) {
      onSave(updatedShow);
    } else {
      alert("שגיאה בשמירת המופע");
    }
  };

  const handleReset = () => {
    if (show) {
      // Reset to original show values
      setTextInput(show.slides.map((slide) => slide.content).join("\n\n"));
      const name = show.name;
      const timestampMatch = name.match(/^(.+?)\s*-\s*\d+$/);
      setShowName(timestampMatch ? timestampMatch[1] : name);
      setStyle({ ...DEFAULT_TEXT_STYLE, ...show.style });
    } else {
      // Reset to defaults
      setTextInput("");
      setShowName("");
      setStyle(DEFAULT_TEXT_STYLE);
    }
  };

  return (
    <div className="show-creator">
      <div className="creator-header">
        <h1>{isEditing ? "ערוך מופע" : "צור מופע חדש"}</h1>
        <div className="creator-actions">
          <button onClick={onCancel} className="btn btn-secondary">
            ביטול
          </button>
          <button onClick={handleReset} className="btn btn-secondary">
            איפוס
          </button>
          <button onClick={handleCreateShow} className="btn btn-primary">
            {isEditing ? "שמור שינויים" : "צור מופע"}
          </button>
        </div>
      </div>

      <div className="creator-content">
        <div className="creator-section">
          <label>
            <span>שם המופע:</span>
            <input
              type="text"
              value={showName}
              onChange={(e) => setShowName(e.target.value)}
              placeholder="הזן שם למופע"
              dir="rtl"
            />
          </label>
        </div>

        <div
          className={`creator-section creator-textarea-wrap ${textareaFullscreen ? "creator-textarea-fullscreen" : ""}`}
        >
          <div className="creator-textarea-header">
            <label className="creator-textarea-label">
              <span>תוכן המופע (הפרד בין שקופיות עם שורה ריקה):</span>
            </label>
            <button
              type="button"
              className="creator-fullscreen-toggle"
              onClick={() => setTextareaFullscreen((v) => !v)}
              title={textareaFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
              aria-label={textareaFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
            >
              {textareaFullscreen ? (
                <>
                  <span className="creator-fullscreen-icon" aria-hidden>
                    ✕
                  </span>
                  <span className="creator-fullscreen-text">
                    יציאה ממסך מלא
                  </span>
                </>
              ) : (
                <>
                  <span className="creator-fullscreen-icon" aria-hidden>
                    ⛶
                  </span>
                  <span className="creator-fullscreen-text">מסך מלא</span>
                </>
              )}
            </button>
          </div>
          {cursorSlideIndex !== null &&
            cursorSlideIndex < slideStats.length &&
            (() => {
              const stat = slideStats[cursorSlideIndex]!;
              return (
                <div
                  className={`creator-current-slide-validation ${stat.over ? "creator-current-slide-validation--over" : ""}`}
                  role="status"
                  aria-live="polite"
                  style={{ direction: "ltr" }}
                >
                  {stat.over
                    ? `(+${stat.overBy}) ${stat.chars}/${MAX_CHARS_PER_SLIDE} · שקופית ${cursorSlideIndex + 1} · ${stat.rows} שורות`
                    : `${stat.chars}/${MAX_CHARS_PER_SLIDE} · שקופית ${cursorSlideIndex + 1} · ${stat.rows} שורות`}
                </div>
              );
            })()}
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onSelect={updateCursorSlideIndex}
            onClick={updateCursorSlideIndex}
            onKeyUp={updateCursorSlideIndex}
            placeholder="הזן את הטקסט כאן...&#10;&#10;שורה ריקה יוצרת שקופית חדשה"
            dir="rtl"
            rows={textareaFullscreen ? 20 : 10}
            maxLength={CONTENT_MAX_CHARS}
            aria-describedby="content-char-count slide-overflow-status"
            className={`creator-content-textarea ${hasAnyOverflow ? "creator-content-textarea--slide-overflow" : ""}`}
          />
          <span
            id="content-char-count"
            className={`char-count ${textInput.length >= CONTENT_MAX_CHARS ? "at-limit" : ""}`}
            aria-live="polite"
          >
            {textInput.length}/{CONTENT_MAX_CHARS}
          </span>
          {slideStats.length > 0 && !textareaFullscreen && (
            <div
              id="slide-overflow-status"
              className={`slide-overflow-indicator ${hasAnyOverflow ? "slide-overflow-indicator--has-overflow" : ""}`}
              aria-live="polite"
              role="status"
            >
              <ul className="slide-overflow-list">
                {slideStats.map((stat, i) => (
                  <li
                    key={i}
                    className={[
                      "slide-overflow-item",
                      stat.over && "slide-overflow-item--over",
                      cursorSlideIndex === i && "slide-overflow-item--current",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ direction: "ltr" }}
                    aria-current={cursorSlideIndex === i ? "true" : undefined}
                  >
                    {stat.over
                      ? `(+${stat.overBy}) ${stat.chars}/${MAX_CHARS_PER_SLIDE} [${stat.rows}] (${i + 1})`
                      : `${stat.chars}/${MAX_CHARS_PER_SLIDE} [${stat.rows}] (${i + 1})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="creator-section">
          <h3>אפשרויות עיצוב</h3>

          <div className="style-controls">
            <div className="control-group">
              <label>
                <span>גופן:</span>
                <select
                  value={style.fontFamily}
                  onChange={(e) =>
                    setStyle({
                      ...style,
                      fontFamily: e.target.value as TextStyle["fontFamily"],
                    })
                  }
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="control-group">
              <label>
                <span>גודל גופן: {style.fontSize}px</span>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={style.fontSize}
                  onChange={(e) =>
                    setStyle({ ...style, fontSize: parseInt(e.target.value) })
                  }
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                <span>יישור:</span>
                <div className="alignment-buttons">
                  {(["left", "center", "right"] as TextAlignment[]).map(
                    (align) => (
                      <button
                        key={align}
                        onClick={() => setStyle({ ...style, alignment: align })}
                        className={`btn btn-small ${
                          style.alignment === align
                            ? "btn-primary"
                            : "btn-secondary"
                        }`}
                      >
                        {align === "left"
                          ? "שמאל"
                          : align === "center"
                            ? "מרכז"
                            : "ימין"}
                      </button>
                    ),
                  )}
                </div>
              </label>
            </div>

            <div className="control-group">
              <label>
                <span>גובה שורה: {style.lineHeight.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.3"
                  step="0.1"
                  value={style.lineHeight}
                  onChange={(e) =>
                    setStyle({
                      ...style,
                      lineHeight: parseFloat(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="control-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={style.stretch}
                  onChange={(e) =>
                    setStyle({ ...style, stretch: e.target.checked })
                  }
                />
                <span>מתיחת טקסט (מלא רוחב)</span>
              </label>
            </div>

            <div className="control-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={style.inverted}
                  onChange={(e) =>
                    setStyle({ ...style, inverted: e.target.checked })
                  }
                />
                <span>היפוך צבעים (טקסט לבן על רקע שחור)</span>
              </label>
            </div>

            <div className="control-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={style.preserveNewlines}
                  onChange={(e) =>
                    setStyle({
                      ...style,
                      preserveNewlines: e.target.checked,
                    })
                  }
                />
                <span>שמור שורות חדשות (Enter בתוך שקופית)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
