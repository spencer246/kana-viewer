import type { Font } from "harfbuzzjs";
import type { GlyphRun } from "./font";

const svgNS = "http://www.w3.org/2000/svg";
const defaultColor = "#89898A";
const horizontalColor = "#DA0066";
const verticalColor = "#0089DF";

function element<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const result = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    result.setAttribute(name, String(value));
  }
  return result;
}

function text(
  x: number,
  y: number,
  value: string,
  attrs: Record<string, string | number> = {},
) {
  const node = element("text", { x, y, ...attrs });
  node.textContent = value;
  return node;
}

interface Outline {
  path: string;
  x: number;
  y: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function outlines(font: Font, run: GlyphRun): Outline[] {
  const first = run[0];
  let x = -(first.xOffset ?? 0);
  let y = -(first.yOffset ?? 0);
  const results: Outline[] = [];
  for (const glyph of run) {
    const path = font.glyphToPath(glyph.codepoint);
    const bounds = font.glyphExtents(glyph.codepoint);
    if (path && bounds) {
      const px = x + (glyph.xOffset ?? 0);
      const py = y + (glyph.yOffset ?? 0);
      const left = px + bounds.xBearing;
      const top = py + bounds.yBearing;
      results.push({
        path,
        x: px,
        y: py,
        left,
        top,
        right: left + bounds.width,
        bottom: top + bounds.height,
      });
    }
    x += glyph.xAdvance ?? 0;
    y += glyph.yAdvance ?? 0;
  }
  return results;
}

export function sameGlyphs(a: GlyphRun, b: GlyphRun): boolean {
  return (
    a.length === b.length &&
    a.every((glyph, i) => glyph.codepoint === b[i].codepoint)
  );
}

interface FigureOptions {
  showLabels: boolean;
  outline: Record<"default" | "vert" | "horizontal" | "vertical", boolean>;
  alternateLabels: { horizontal: string; vertical: string };
}

export function makeFigure(
  font: Font,
  name: string,
  kana: string,
  runs: {
    horizontal: GlyphRun;
    vertical: GlyphRun;
    horizontalAlternate: GlyphRun;
    verticalAlternate: GlyphRun;
  },
  options: FigureOptions,
) {
  const side = 200;
  const header = 29;
  const showVertical =
    !sameGlyphs(runs.horizontal, runs.vertical) ||
    options.outline.default !== options.outline.vert;
  const isDefault = (run: GlyphRun) =>
    sameGlyphs(run, runs.horizontal) || sameGlyphs(run, runs.vertical);
  const horizontalRepeatsDefault = isDefault(runs.horizontalAlternate);
  const verticalRepeatsDefault = isDefault(runs.verticalAlternate);
  const alternatesMatch = sameGlyphs(
    runs.horizontalAlternate,
    runs.verticalAlternate,
  );
  const height = header + 3 * side + 1;
  const svg = element("svg", {
    viewBox: `0 0 ${side * 3 + 1} ${height}`,
    width: side * 3 + 1,
    height,
    role: "img",
    "aria-label": `${name}: kana outline comparison for ${kana}`,
    "font-family": "system-ui, sans-serif",
  });
  svg.append(
    element("rect", { width: side * 3 + 1, height, fill: "white" }),
    text(1, 18, name, { "font-size": 15 }),
  );

  const horizontal = {
    label: "Default",
    run: runs.horizontal,
    strokeOnly: options.outline.default,
    color: defaultColor,
    outlines: outlines(font, runs.horizontal),
  };
  const vertical = {
    label: "vert",
    run: runs.vertical,
    strokeOnly: options.outline.vert,
    color: defaultColor,
    outlines: outlines(font, runs.vertical),
  };
  const horizontalAlternate = {
    label: horizontalRepeatsDefault
      ? `(${options.alternateLabels.horizontal})`
      : options.alternateLabels.horizontal,
    run: runs.horizontalAlternate,
    strokeOnly: options.outline.horizontal,
    color: horizontalRepeatsDefault ? defaultColor : horizontalColor,
    outlines: outlines(font, runs.horizontalAlternate),
  };
  const verticalAlternate = {
    label:
      verticalRepeatsDefault || alternatesMatch
        ? `(${options.alternateLabels.vertical})`
        : options.alternateLabels.vertical,
    run: runs.verticalAlternate,
    strokeOnly: options.outline.vertical,
    color: verticalRepeatsDefault
      ? defaultColor
      : alternatesMatch
        ? horizontalAlternate.color
        : verticalColor,
    outlines: outlines(font, runs.verticalAlternate),
  };
  const all = [
    horizontal,
    vertical,
    horizontalAlternate,
    verticalAlternate,
  ].flatMap((layer) => layer.outlines);
  if (!all.length)
    throw new Error("This kana has no drawable outline in the font.");

  const left = Math.min(...all.map((outline) => outline.left));
  const right = Math.max(...all.map((outline) => outline.right));
  const bottom = Math.min(...all.map((outline) => outline.bottom));
  const top = Math.max(...all.map((outline) => outline.top));
  const scale = 160 / Math.max(right - left, top - bottom, 1);
  const originX = side / 2 - ((left + right) / 2) * scale;
  const originY = side / 2 + ((bottom + top) / 2) * scale;
  type Layer = typeof horizontal;
  const panel = (
    column: number,
    row: number,
    first: Layer,
    second?: Layer,
    equalsRotation = 0,
  ) => {
    const layers = second ? [first, second] : [first];
    const cell = element("g", {
      transform: `translate(${column * side + 0.5} ${row * side + header + 0.5})`,
    });
    if (second && sameGlyphs(first.run, second.run)) {
      const title = element("title");
      title.textContent = `${first.label} and ${second.label} use the same glyphs`;
      const center = side / 2;
      const rotation = equalsRotation ? " rotate(" + equalsRotation + ")" : "";
      cell.append(
        title,
        element("path", {
          d: "M-12 -4h24 M-12 4h24",
          transform: `translate(${center} ${center})${rotation}`,
          fill: "none",
          stroke: defaultColor,
          "stroke-width": 3,
        }),
      );
      svg.append(cell);
      return;
    }
    cell.append(
      element("rect", {
        width: side,
        height: side,
        fill: "white",
        stroke: "#222",
      }),
    );
    const geometry = element("g", {
      transform: `translate(${originX} ${originY}) scale(${scale} ${-scale})`,
      style: "isolation:isolate",
    });
    for (const [index, layer] of layers.entries()) {
      const duplicate = layers.slice(0, index).some(
        (previous) =>
          previous.color === layer.color &&
          previous.strokeOnly === layer.strokeOnly &&
          previous.outlines.length === layer.outlines.length &&
          previous.outlines.every((outline, i) => {
            const other = layer.outlines[i];
            return (
              outline.path === other.path &&
              outline.x === other.x &&
              outline.y === other.y
            );
          }),
      );
      if (duplicate) continue;

      const ink = element("g", {
        fill: layer.strokeOnly ? "none" : layer.color,
        stroke: layer.strokeOnly ? layer.color : "none",
        "stroke-linejoin": "round",
        style: "mix-blend-mode:multiply",
      });
      for (const outline of layer.outlines) {
        ink.append(
          element("path", {
            d: outline.path,
            "vector-effect": "non-scaling-stroke",
            "stroke-width": 1.5,
            transform: `translate(${outline.x} ${outline.y})`,
          }),
        );
      }
      geometry.append(ink);
    }
    cell.append(geometry);
    if (!options.showLabels) {
      svg.append(cell);
      return;
    }
    for (const layer of layers) {
      const isHorizontalAlternate = layer === horizontalAlternate;
      cell.append(
        text(
          isHorizontalAlternate ? side - 6 : 6,
          layer === verticalAlternate ? side - 7 : 16,
          layer.label,
          {
            "text-anchor": isHorizontalAlternate ? "end" : "start",
            "font-size": 13,
            fill: layer.color,
          },
        ),
      );
    }
    svg.append(cell);
  };

  panel(0, 0, horizontal);
  panel(1, 0, horizontal, horizontalAlternate);
  panel(2, 0, horizontalAlternate);
  if (!showVertical) panel(0, 1, horizontal, verticalAlternate, 90);
  panel(1, 1, horizontalAlternate, verticalAlternate, -45);
  panel(0, 2, verticalAlternate);
  if (showVertical) {
    panel(1, 2, vertical, verticalAlternate);
    panel(2, 2, vertical);
  }
  return {
    svg,
    alternateColors: {
      horizontal: horizontalRepeatsDefault
        ? undefined
        : horizontalAlternate.color,
      vertical: verticalRepeatsDefault ? undefined : verticalAlternate.color,
    },
  };
}
