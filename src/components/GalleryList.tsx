import React, { useState, useEffect } from "react";
import type { Show } from "../types";
import { storageService } from "../services/storageService";
import "./GalleryList.css";

interface GalleryListProps {
  onCreateShow: () => void;
  onEditShow: (show: Show) => void;
  onStartPresentation: (show: Show) => void;
}

export const GalleryList: React.FC<GalleryListProps> = ({
  onCreateShow,
  onEditShow,
  onStartPresentation,
}) => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShows = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedShows = await storageService.getAllShows();
      setShows(loadedShows);
    } catch (err) {
      setError("Failed to load shows");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShows();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המופע הזה?")) {
      return;
    }

    try {
      await storageService.deleteShow(id);
      await loadShows();
    } catch (err) {
      setError("Failed to delete show");
      console.error(err);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="gallery-list">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="gallery-list">
      <div className="gallery-header">
        <h1>גלריית מופעים</h1>
        <div className="gallery-actions">
          <button onClick={loadShows} className="btn btn-secondary">
            רענן
          </button>
          <button onClick={onCreateShow} className="btn btn-primary">
            צור מופע חדש
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {shows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
          <h2>אין מופעים שמורים</h2>
          <p>צור מופע ראשון כדי להתחיל להציג טקסט במשקפיים.</p>
          <button onClick={onCreateShow} className="btn btn-primary">
            צור מופע ראשון
          </button>
        </div>
      ) : (
        <div className="shows-grid">
          {shows.map((show) => {
            // Remove timestamp suffix from show name if present
            const displayName = show.name.replace(/\s*-\s*\d+$/, "");
            return (
              <div key={show.id} className="show-card">
                <div className="show-card-header">
                  <h3>{displayName}</h3>
                  <span className="show-date">
                    {formatDate(show.createdAt)}
                  </span>
                </div>
                <div className="show-card-actions">
                  <button
                    onClick={() => {
                      console.log(
                        "[GalleryList] Start presentation clicked for show:",
                        show,
                      );
                      console.log("[GalleryList] Show details:", {
                        id: show.id,
                        name: show.name,
                        slidesCount: show.slides?.length || 0,
                        slides: show.slides,
                      });
                      onStartPresentation(show);
                    }}
                    className="btn btn-action btn-primary"
                    title="התחל הצגה"
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => onEditShow(show)}
                    className="btn btn-action btn-secondary"
                    title="ערוך"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => handleDelete(show.id)}
                    className="btn  btn-danger width-20"
                    title="מחק"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
