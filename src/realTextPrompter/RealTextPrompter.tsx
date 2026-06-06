import React, { useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { evenHubService } from '../services/evenHubService';
import './RealTextPrompter.css';

const STORAGE_KEY_BLOCKS = 'eye_prompt_real_text_blocks';

export interface TextBlock {
  id: string;
  title: string;
  content: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

function loadBlocks(): Promise<TextBlock[]> {
  return storageService.getItem(STORAGE_KEY_BLOCKS).then((raw) => {
    if (!raw?.trim()) return [];
    try {
      const parsed = JSON.parse(raw) as (TextBlock & { title?: string })[];
      const list = Array.isArray(parsed) ? parsed : [];
      const migrated = list.map((b, i) => ({
        ...b,
        title: b.title != null && b.title !== '' ? b.title : (b.content?.trim().split(/\n/)[0]?.slice(0, 32) || `בלוק ${i + 1}`),
      }));
      return migrated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch {
      return [];
    }
  });
}

function saveBlocks(blocks: TextBlock[]): Promise<boolean> {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return storageService.setItem(STORAGE_KEY_BLOCKS, JSON.stringify(sorted));
}

function nextOrder(blocks: TextBlock[]): number {
  if (blocks.length === 0) return 0;
  return Math.max(...blocks.map((b) => b.order), -1) + 1;
}

export const RealTextPrompter: React.FC = () => {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isPresenting, setIsPresenting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadBlocks();
      setBlocks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load blocks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (isPresenting) evenHubService.stopRtpPresentation();
    };
  }, [isPresenting]);

  const handleCreate = async () => {
    const content = newContent.trim();
    if (!content) return;
    const order = nextOrder(blocks);
    const now = Date.now();
    const title = newTitle.trim() || content.split(/\n/)[0]?.slice(0, 32) || `בלוק ${blocks.length + 1}`;
    const block: TextBlock = {
      id: `block-${now}-${Math.random().toString(36).slice(2, 9)}`,
      title,
      content,
      order,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...blocks, block];
    setBlocks(next);
    setNewContent('');
    setNewTitle('');
    setIsAdding(false);
    const ok = await saveBlocks(next);
    if (!ok) {
      setError('Failed to save block');
      setBlocks(blocks);
    }
  };

  const handleUpdate = async (id: string) => {
    const content = editContent.trim();
    const block = blocks.find((b) => b.id === id);
    if (!block) {
      setEditingId(null);
      return;
    }
    const title = editTitle.trim() || content.split(/\n/)[0]?.slice(0, 32) || block.title;
    const now = Date.now();
    const updated: TextBlock = { ...block, title, content, updatedAt: now };
    const next = blocks.map((b) => (b.id === id ? updated : b));
    setBlocks(next);
    setEditingId(null);
    setEditContent('');
    setEditTitle('');
    const ok = await saveBlocks(next);
    if (!ok) {
      setError('Failed to save changes');
      setBlocks(blocks);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק את הבלוק?')) return;
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (editingId === id) {
      setEditingId(null);
      setEditContent('');
    }
    const ok = await saveBlocks(next);
    if (!ok) {
      setError('Failed to delete');
      setBlocks(blocks);
    }
  };

  const startEdit = (block: TextBlock) => {
    setEditingId(block.id);
    setEditContent(block.content);
    setEditTitle(block.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditTitle('');
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewContent('');
    setNewTitle('');
  };

  const handlePresent = async () => {
    if (blocks.length === 0) {
      setError('הוסף לפחות בלוק אחד כדי להציג');
      return;
    }
    setError(null);
    const ok = await evenHubService.startRtpPresentation(blocks);
    if (ok) setIsPresenting(true);
    else setError('לא הצלחנו להציג במשקפיים');
  };

  const handleFinish = async () => {
    const ok = await evenHubService.stopRtpPresentation();
    if (ok) setIsPresenting(false);
  };

  if (loading) {
    return (
      <div className="real-text-prompter">
        <div className="rtp-loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="real-text-prompter">
      <header className="rtp-header">
        <h1 className="rtp-title">Real Text Prompter</h1>
        <p className="rtp-hint">
          הפרד פסקאות בריווח כפול (שורה ריקה) כדי להציג שקופיות. בחר פריט ברשימה → טפיחה/גלילה: הבא • גלילה למטה: הקודם • טפיחה כפולה: חזרה לרשימה.
        </p>
        <div className="rtp-header-actions">
          {isPresenting ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleFinish}
              title="סיים הצגה"
            >
              סיים הצגה
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePresent}
              title="הצג במשקפיים"
              disabled={blocks.length === 0}
            >
              הצג במשקפיים
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAdding(true)}
          >
            + בלוק חדש
          </button>
        </div>
      </header>

      {error && (
        <div className="rtp-error" role="alert">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="rtp-block rtp-block-edit">
          <input
            type="text"
            className="rtp-title-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="כותרת (אופציונלי)"
            dir="rtl"
          />
          <textarea
            className="rtp-textarea"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="הטקסט של הבלוק..."
            rows={4}
            dir="rtl"
          />
          <div className="rtp-actions">
            <button type="button" className="btn btn-secondary" onClick={cancelAdd}>
              ביטול
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!newContent.trim()}
            >
              שמור
            </button>
          </div>
        </div>
      )}

      <ul className="rtp-list">
        {blocks.map((block) => (
          <li key={block.id} className="rtp-block-wrap">
            {editingId === block.id ? (
              <div className="rtp-block rtp-block-edit">
                <input
                  type="text"
                  className="rtp-title-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="כותרת"
                  dir="rtl"
                />
                <textarea
                  className="rtp-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  dir="rtl"
                />
                <div className="rtp-actions">
                  <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                    ביטול
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleUpdate(block.id)}
                  >
                    עדכן
                  </button>
                </div>
              </div>
            ) : (
              <div className="rtp-block rtp-block-view">
                <h3 className="rtp-block-title">{block.title || '\u00A0'}</h3>
                <p className="rtp-block-content">{block.content || '\u00A0'}</p>
                <div className="rtp-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => startEdit(block)}
                    title="ערוך"
                    disabled={isPresenting}
                  >
                    ✏️ ערוך
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(block.id)}
                    title="מחק"
                    disabled={isPresenting}
                  >
                    🗑️ מחק
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {blocks.length === 0 && !isAdding && (
        <div className="rtp-empty">
          <p>אין בלוקים. הוסף בלוק טקסט כדי להתחיל.</p>
        </div>
      )}
    </div>
  );
};
