import { Variation } from "harfbuzzjs";
import { loadFont } from "./font";

interface GoogleFont {
  name: string;
  slug: string;
  filename: string;
  variable?: boolean;
}

const source =
  "https://raw.githubusercontent.com/google/fonts/29b4ec6df2522a8aee279414b78a07910b065874/ofl";

export const googleFonts: GoogleFont[] = [
  {
    name: "IBM Plex Sans JP",
    slug: "ibmplexsansjp",
    filename: "IBMPlexSansJP-Regular.ttf",
  },
  {
    name: "Klee One",
    slug: "kleeone",
    filename: "KleeOne-Regular.ttf",
  },
  {
    name: "LINE Seed JP",
    slug: "lineseedjp",
    filename: "LINESeedJP-Regular.ttf",
  },
  {
    name: "M PLUS 1",
    slug: "mplus1",
    filename: "MPLUS1[wght].ttf",
    variable: true,
  },
  {
    name: "M PLUS 2",
    slug: "mplus2",
    filename: "MPLUS2[wght].ttf",
    variable: true,
  },
  {
    name: "Noto Sans JP",
    slug: "notosansjp",
    filename: "NotoSansJP[wght].ttf",
    variable: true,
  },
  {
    name: "Noto Serif JP",
    slug: "notoserifjp",
    filename: "NotoSerifJP[wght].ttf",
    variable: true,
  },
  {
    name: "Shippori Mincho",
    slug: "shipporimincho",
    filename: "ShipporiMincho-Regular.ttf",
  },
  {
    name: "Zen Antique",
    slug: "zenantique",
    filename: "ZenAntique-Regular.ttf",
  },
  {
    name: "Zen Antique Soft",
    slug: "zenantiquesoft",
    filename: "ZenAntiqueSoft-Regular.ttf",
  },
  {
    name: "Zen Kaku Gothic Antique",
    slug: "zenkakugothicantique",
    filename: "ZenKakuGothicAntique-Regular.ttf",
  },
  {
    name: "Zen Kaku Gothic New",
    slug: "zenkakugothicnew",
    filename: "ZenKakuGothicNew-Regular.ttf",
  },
  {
    name: "Zen Kurenaido",
    slug: "zenkurenaido",
    filename: "ZenKurenaido-Regular.ttf",
  },
  {
    name: "Zen Maru Gothic",
    slug: "zenmarugothic",
    filename: "ZenMaruGothic-Regular.ttf",
  },
  {
    name: "Zen Old Mincho",
    slug: "zenoldmincho",
    filename: "ZenOldMincho-Regular.ttf",
  },
];

export async function loadGoogleFont(preset: GoogleFont, signal: AbortSignal) {
  const { filename } = preset;
  const style = filename.endsWith("-Medium.ttf") ? "Medium" : "Regular";
  const response = await fetch(
    `${source}/${preset.slug}/${encodeURIComponent(filename)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error(`Could not download ${preset.name} (${response.status}).`);

  const data = await response.arrayBuffer();
  signal.throwIfAborted();
  const loaded = await loadFont(new File([data], filename));
  if (preset.variable) {
    loaded.font.setVariations([new Variation("wght", 400)]);
  }
  loaded.name = `${preset.name} ${style}`;
  return loaded;
}
