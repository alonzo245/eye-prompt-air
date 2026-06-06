// Type definitions for Eye Prompt app

export type FontFamily =
  | "Rubik"
  | "Rubik Black"
  | "Rubik Bold"
  | "Rubik Light"
  | "Rubik Medium"
  | "Rubik SemiBold"
  | "Rubik ExtraBold"
  | "Haim Design"
  | "Haim Design Black"
  | "Haim Design Bold"
  | "Joker Bold"
  | "Lunasima Bold"
  | "Noto Sans Hebrew"
  | "Noto Sans Hebrew Condensed Black"
  | "Open Sans Condensed Bold"
  | "Open Sans Condensed ExtraBold"
  | "Open Sans SemiCondensed Bold"
  | "Spacer Bold"
  | "Arial"
  | "Times New Roman"
  | "David"
  | "serif"
  | string; // Allow any string for custom fonts

export type TextAlignment = "left" | "center" | "right";

export type DisplayMode = "both" | "left" | "right";

export type TextOpacity = 30 | 60 | 100;

export interface TextStyle {
  fontFamily: FontFamily;
  fontSize: number; // 12-300px
  alignment: TextAlignment;
  stretch: boolean; // Fill full width
  lineHeight: number; // 0.5x to 1.3x
  opacity: TextOpacity;
  inverted: boolean; // White text on black background
  /** When true, single newlines in slide text become line breaks on glasses (default: collapse to spaces). */
  preserveNewlines: boolean;
}

export interface Slide {
  id: string;
  content: string;
  order: number;
}

export interface Show {
  id: string;
  name: string;
  createdAt: number; // Timestamp
  slides: Slide[];
  style: TextStyle;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Rubik",
  fontSize: 20,
  alignment: "right",
  stretch: false,
  lineHeight: 1.0,
  opacity: 100,
  inverted: true,
  preserveNewlines: false,
};

export const CANVAS_WIDTH = 576;
export const CANVAS_HEIGHT = 288;
