import type { Show, TextOpacity } from "../../types";

export interface PresentationProps {
  show: Show;
  onExit: () => void;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: unknown;
}

export const GESTURE_DEBOUNCE_MS = 100;

export type PresentationStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  opacity: TextOpacity;
};
