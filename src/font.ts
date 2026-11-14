import {
  Blob,
  Buffer,
  Direction,
  Face,
  Feature,
  Font,
  shape,
} from "harfbuzzjs";
import { decompressWoff } from "./woff";
import { decompressWoff2 } from "./woff2";

export interface LoadedFont {
  name: string;
  font: Font;
  featureTags: Set<string>;
  glyphLabel: (gid: number) => string;
}

export async function loadFont(file: File): Promise<LoadedFont> {
  let data = await file.arrayBuffer();
  if (data.byteLength < 12)
    throw new Error("This file is too short to be a font.");
  const container = new DataView(data).getUint32(0);
  if (container === 0x774f4646) data = await decompressWoff(data);
  if (container === 0x774f4632) data = await decompressWoff2(data);
  const signature = new DataView(data).getUint32(0);
  if (
    signature !== 0x4f54544f &&
    signature !== 0x00010000 &&
    signature !== 0x74727565
  ) {
    throw new Error("Choose a single-face OTF, TTF, WOFF, or WOFF2 font.");
  }

  const face = new Face(new Blob(data));
  if (
    !face.referenceTable("cmap")?.length ||
    !face.referenceTable("head")?.length ||
    !["glyf", "CFF ", "CFF2"].some((tag) => face.referenceTable(tag)?.length)
  ) {
    throw new Error("This font does not have readable OpenType outlines.");
  }
  const font = new Font(face);
  // HarfBuzz returns a GID fallback for CID-keyed CFF fonts.
  let cidForGlyph: ((gid: number) => number | undefined) | undefined;
  if (face.referenceTable("CFF ")?.length) {
    try {
      const { parse } = await import("opentype.js");
      const parsed = parse(data, { lowMemory: true });
      if (parsed.isCIDFont) {
        cidForGlyph = (gid) => {
          const name = parsed.glyphs.get(gid).name;
          const cid =
            typeof name === "number"
              ? name
              : /^cid(\d+)$/i.exec(name ?? "")?.[1];
          return cid === undefined ? undefined : Number(cid);
        };
      }
    } catch {
      // Use HarfBuzz names or GIDs when the CFF metadata parser cannot read the font.
    }
  }

  return {
    glyphLabel(gid) {
      const cid = cidForGlyph?.(gid);
      if (cid !== undefined) return "CID " + cid;
      const name = font.glyphName(gid);
      return name && name !== "gid" + gid ? name : "GID " + gid;
    },
    name: face.getName(4, "en") || file.name,
    font,
    featureTags: new Set(face.getTableFeatureTags("GSUB")),
  };
}

export function shapeKana(
  font: Font,
  kana: string,
  vertical: boolean,
  feature?: "hkna" | "vkna" | "ruby",
) {
  const buffer = new Buffer();
  buffer.addText(kana);
  buffer.setDirection(vertical ? Direction.TTB : Direction.LTR);
  buffer.setScript("Kana");
  buffer.setLanguage("ja");
  shape(font, buffer, feature ? [new Feature(feature, 1)] : []);
  return buffer.getGlyphInfosAndPositions();
}

export type GlyphRun = ReturnType<typeof shapeKana>;
