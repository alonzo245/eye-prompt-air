/**
 * Renders Hebrew (or any) text to a 24-bit BMP image.
 * Canvas is drawn with white background and black text for clear display on glasses.
 */

import type { TextStyle } from "./types";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;

/**
 * Encode canvas ImageData (RGBA) to 24-bit BMP (BGR, bottom-up, row-padded).
 */
function imageDataToBmp(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const bytesPerPixel = 3;
  const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const fileSize = fileHeaderSize + dibHeaderSize + pixelDataSize;

  const bmp = new Uint8Array(fileSize);
  const view = new DataView(bmp.buffer);
  let offset = 0;

  // BMP file header (14 bytes)
  bmp[offset++] = 0x42; // 'B'
  bmp[offset++] = 0x4d; // 'M'
  view.setUint32(offset, fileSize, true);
  offset += 4;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint32(offset, fileHeaderSize + dibHeaderSize, true);
  offset += 4;

  // DIB header (BITMAPINFOHEADER, 40 bytes)
  view.setUint32(offset, dibHeaderSize, true);
  offset += 4;
  view.setInt32(offset, width, true);
  offset += 4;
  view.setInt32(offset, -height, true);
  offset += 4; // top-down
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 24, true);
  offset += 2;
  view.setUint32(offset, 0, true);
  offset += 4;
  view.setUint32(offset, pixelDataSize, true);
  offset += 4;
  view.setInt32(offset, 0, true);
  offset += 4;
  view.setInt32(offset, 0, true);
  offset += 4;
  view.setUint32(offset, 0, true);
  offset += 4;
  view.setUint32(offset, 0, true);
  offset += 4;

  // Pixel data: Canvas is RGBA, BMP is BGR (no alpha). Canvas row 0 = top, we write top-down.
  for (let y = 0; y < height; y++) {
    let rowPad = rowSize - width * bytesPerPixel;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      bmp[offset++] = data[i + 2]; // B
      bmp[offset++] = data[i + 1]; // G
      bmp[offset++] = data[i]; // R
    }
    while (rowPad--) bmp[offset++] = 0;
  }

  return bmp;
}

/**
 * Extract a region from RGBA ImageData and return it as a 24-bit BMP.
 */
function extractRegionToBmp(
  fullData: Uint8ClampedArray,
  fullWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8Array {
  const extracted = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcOffset = ((y + row) * fullWidth + x) * 4;
    const dstOffset = row * w * 4;
    for (let i = 0; i < w * 4; i++) {
      extracted[dstOffset + i] = fullData[srcOffset + i];
    }
  }
  return imageDataToBmp(extracted, w, h);
}

/** Full canvas size for 4-quadrant display: 2×2 of 200×100 = 400×200 */
export const QUAD_CANVAS_WIDTH = 400;
export const QUAD_CANVAS_HEIGHT = 200;
export const QUAD_PANEL_WIDTH = 200;
export const QUAD_PANEL_HEIGHT = 100;

/**
 * Render one paragraph to the full "glasses screen" (400×200) and split into 4 quadrant BMPs.
 * Quadrants are [top-left, top-right, bottom-left, bottom-right]; each is 200×100.
 * The paragraph is drawn once across the full area so it flows across all 4 images as one.
 */
export function renderParagraphToFourQuadrants(
  text: string,
  style?: Partial<TextStyle>,
): [Uint8Array, Uint8Array, Uint8Array, Uint8Array] {
  const width = QUAD_CANVAS_WIDTH;
  const height = QUAD_CANVAS_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  const bgColor = style?.inverted ? "#000000" : "#ffffff";
  const textColor = style?.inverted ? "#ffffff" : "#000000";
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const fontSize = style?.fontSize ?? Math.min(width / 12, height / 4, 28);
  const fontFamily =
    style?.fontFamily ?? 'Arial, "Times New Roman", David, serif';
  ctx.font = `${fontSize}px ${getCssFontFamily(fontFamily)}`;
  ctx.fillStyle = textColor;
  const alignment = style?.alignment ?? "right";
  ctx.textAlign =
    alignment === "left" ? "left" : alignment === "right" ? "right" : "center";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";

  const topPadding = 12;
  const sidePadding = 12;
  const maxWidth = width - sidePadding * 2;
  const lineHeightMultiplier = style?.lineHeight ?? 1.0;
  const actualLineHeight = fontSize * lineHeightMultiplier;

  const lines = collectWrappedLines(ctx, text, maxWidth, style);

  if (lines.length === 0) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const tw = QUAD_PANEL_WIDTH;
    const th = QUAD_PANEL_HEIGHT;
    return [
      extractRegionToBmp(imageData.data, width, 0, 0, tw, th),
      extractRegionToBmp(imageData.data, width, tw, 0, tw, th),
      extractRegionToBmp(imageData.data, width, 0, th, tw, th),
      extractRegionToBmp(imageData.data, width, tw, th, tw, th),
    ];
  }

  const startY = topPadding;

  ctx.globalAlpha = (style?.opacity ?? 100) / 100;
  const x =
    alignment === "left"
      ? sidePadding
      : alignment === "right"
        ? width - sidePadding
        : width / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * actualLineHeight, maxWidth);
  });
  ctx.globalAlpha = 1;

  const imageData = ctx.getImageData(0, 0, width, height);
  const tw = QUAD_PANEL_WIDTH;
  const th = QUAD_PANEL_HEIGHT;
  const topLeft = extractRegionToBmp(imageData.data, width, 0, 0, tw, th);
  const topRight = extractRegionToBmp(imageData.data, width, tw, 0, tw, th);
  const bottomLeft = extractRegionToBmp(imageData.data, width, 0, th, tw, th);
  const bottomRight = extractRegionToBmp(imageData.data, width, tw, th, tw, th);
  return [topLeft, topRight, bottomLeft, bottomRight];
}

/**
 * Render one paragraph to the full "glasses screen" (400×200) and split into 3 panel BMPs.
 * Panels: [top-center (200×100), bottom-left (200×100), bottom-right (200×100)].
 */
export function renderParagraphToThreePanels(
  text: string,
  style?: Partial<TextStyle>,
): [Uint8Array, Uint8Array, Uint8Array] {
  const [, topRight, bottomLeft, bottomRight] =
    renderParagraphToFourQuadrants(text, style);
  return [topRight, bottomLeft, bottomRight];
}

function getCssFontFamily(fontFamily: string): string {
  const map: Record<string, string> = {
    Rubik: '"Rubik", Arial, sans-serif',
    "Rubik Black": '"Rubik Black", Arial, sans-serif',
    "Rubik Bold": '"Rubik Bold", Arial, sans-serif',
    "Rubik Light": '"Rubik Light", Arial, sans-serif',
    "Rubik Medium": '"Rubik Medium", Arial, sans-serif',
    "Rubik SemiBold": '"Rubik SemiBold", Arial, sans-serif',
    "Rubik ExtraBold": '"Rubik ExtraBold", Arial, sans-serif',
    "Haim Design": '"Haim Design", "Haim Design Black", Arial, serif',
    "Haim Design Black": '"Haim Design Black", Arial, serif',
    "Haim Design Bold": '"Haim Design Bold", Arial, serif',
    "Noto Sans Hebrew": '"Noto Sans Hebrew", Arial, sans-serif',
    "Noto Sans Hebrew Condensed Black":
      '"Noto Sans Hebrew Condensed Black", Arial, sans-serif',
    "Open Sans Condensed Bold": '"Open Sans Condensed Bold", Arial, sans-serif',
    "Open Sans Condensed ExtraBold":
      '"Open Sans Condensed ExtraBold", Arial, sans-serif',
    "Open Sans SemiCondensed Bold":
      '"Open Sans SemiCondensed Bold", Arial, sans-serif',
    "Joker Bold": '"Joker Bold", Arial, sans-serif',
    "Lunasima Bold": '"Lunasima Bold", Arial, sans-serif',
    "Spacer Bold": '"Spacer Bold", Arial, sans-serif',
  };
  return map[fontFamily] ?? fontFamily;
}

/**
 * Split a string into chunks that each fit within maxWidth (by character).
 * Ensures no character is lost when a word is longer than maxWidth.
 */
function splitToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (ctx.measureText(remaining).width <= maxWidth) {
      chunks.push(remaining);
      break;
    }
    let low = 0;
    let high = remaining.length;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      const prefix = remaining.slice(0, mid);
      if (ctx.measureText(prefix).width <= maxWidth) low = mid;
      else high = mid;
    }
    const fitLen =
      ctx.measureText(remaining.slice(0, low)).width <= maxWidth ? low : 1;
    chunks.push(remaining.slice(0, fitLen));
    remaining = remaining.slice(fitLen);
  }
  return chunks;
}

/**
 * Split text at # markers into wrap units. When preserveNewlines is false, newlines become spaces (legacy).
 */
function splitIntoWrapUnits(
  text: string,
  preserveNewlines: boolean,
): string[] {
  const rawSegments = (text || " ").trim().split(/#/);
  const units: string[] = [];
  for (let i = 0; i < rawSegments.length; i++) {
    let part = rawSegments[i]!;
    if (i < rawSegments.length - 1) part += " #";
    if (preserveNewlines) {
      for (const line of part.split(/\n/)) {
        units.push(line.trim());
      }
    } else {
      units.push(part.replace(/\s*\n\s*/g, " ").trim());
    }
  }
  return units;
}

/**
 * Word-wrap slide text into display lines (# segments and optional hard newlines).
 */
function collectWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style?: Partial<TextStyle>,
  maxLines?: number,
): string[] {
  const preserveNewlines = style?.preserveNewlines ?? false;
  const segments = splitIntoWrapUnits(text, preserveNewlines);
  const cap = maxLines ?? Number.POSITIVE_INFINITY;
  const lines: string[] = [];

  for (const segment of segments) {
    if (lines.length >= cap) break;
    if (segment === "") {
      if (preserveNewlines && lines.length > 0) {
        lines.push("");
        if (lines.length >= cap) break;
      }
      continue;
    }
    const wrapped = wordWrap(ctx, segment, maxWidth);
    for (const line of wrapped) {
      lines.push(line);
      if (lines.length >= cap) break;
    }
  }
  return lines;
}

/**
 * Wrap text to fit within maxWidth using word boundaries. Long words are split by character so nothing is clipped.
 */
function wordWrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(candidate);
    if (metrics.width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      if (ctx.measureText(word).width <= maxWidth) {
        currentLine = word;
      } else {
        const chunks = splitToFit(ctx, word, maxWidth);
        for (let i = 0; i < chunks.length - 1; i++) lines.push(chunks[i]);
        currentLine = chunks[chunks.length - 1];
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Render text (e.g. Hebrew) to a BMP. Returns 24-bit BMP file as Uint8Array.
 * Uses white background and black text for clarity on glasses.
 */
export function renderTextToBmp(
  text: string,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
  style?: Partial<TextStyle>,
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  // Determine colors based on inverted setting
  const bgColor = style?.inverted ? "#000000" : "#ffffff";
  const textColor = style?.inverted ? "#ffffff" : "#000000";

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (!text.trim()) {
    return imageDataToBmp(
      ctx.getImageData(0, 0, width, height).data,
      width,
      height,
    );
  }

  // Font configuration
  const fontSize = style?.fontSize || Math.min(width / 8, height / 2, 24);
  const fontFamily =
    style?.fontFamily || 'Arial, "Times New Roman", David, serif';
  ctx.font = `${fontSize}px ${getCssFontFamily(fontFamily)}`;
  ctx.fillStyle = textColor;

  // Text alignment: start at right top corner (RTL)
  const alignment = style?.alignment || "right";
  ctx.textAlign =
    alignment === "left" ? "left" : alignment === "right" ? "right" : "center";
  ctx.textBaseline = "top";
  ctx.direction = "rtl"; // Hebrew/RTL support

  const topPadding = 10;
  const sidePadding = 10;

  const maxWidth = width - sidePadding * 2;
  const lineHeightMultiplier = style?.lineHeight || 1.0;
  const actualLineHeight = fontSize * lineHeightMultiplier;
  const maxLines = Math.max(
    1,
    Math.floor((height - topPadding * 2) / actualLineHeight),
  );

  const lines = collectWrappedLines(ctx, text, maxWidth, style, maxLines);
  const startY = topPadding;

  // Apply opacity by adjusting alpha
  const opacity = (style?.opacity || 100) / 100;
  ctx.globalAlpha = opacity;

  // Draw lines
  lines.forEach((line, i) => {
    const y = startY + i * actualLineHeight;
    let x: number;

    if (alignment === "left") {
      x = sidePadding;
    } else if (alignment === "right") {
      x = width - sidePadding;
    } else {
      x = width / 2;
    }

    ctx.fillText(line, x, y, maxWidth);
  });

  ctx.globalAlpha = 1.0; // Reset alpha

  const imageData = ctx.getImageData(0, 0, width, height);
  return imageDataToBmp(imageData.data, width, height);
}
