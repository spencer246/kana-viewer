import { makeFigure, sameGlyphs } from "./figure";
import { loadFont, shapeKana, type LoadedFont } from "./font";
import { googleFonts, loadGoogleFont } from "./google-fonts";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#font")!;
const googleFont = document.querySelector<HTMLSelectElement>("#google-font")!;
for (const preset of googleFonts)
  googleFont.add(new Option(preset.name, preset.slug));
const kana = document.querySelector<HTMLInputElement>("#kana")!;
const randomSmallKana =
  document.querySelector<HTMLButtonElement>("#random-small-kana")!;
const randomNonSmallKana = document.querySelector<HTMLButtonElement>(
  "#random-non-small-kana",
)!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const figure = document.querySelector<HTMLDivElement>("#figure")!;
const glyphDetails =
  document.querySelector<HTMLDListElement>("#glyph-details")!;
const labels = document.querySelector<HTMLInputElement>("#panel-labels")!;
const comparison = document.querySelector<HTMLSelectElement>("#comparison")!;
const outlines = {
  default: document.querySelector<HTMLInputElement>("#outline-default")!,
  vert: document.querySelector<HTMLInputElement>("#outline-vert")!,
  horizontal: document.querySelector<HTMLInputElement>("#outline-horizontal")!,
  vertical: document.querySelector<HTMLInputElement>("#outline-vertical")!,
};
const horizontalOutlineLabel = document.querySelector(
  "#outline-horizontal-label",
)!;
const verticalOutlineLabel = document.querySelector("#outline-vertical-label")!;
const download = document.querySelector<HTMLButtonElement>("#download")!;
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
const smallKanaChoices = [
  ..."ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ",
];
const nonSmallKanaChoices = [
  ..."あいうえおかがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもやゆよらりるれろわゐゑをんゔ",
  ..."アイウエオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモヤユヨラリルレロワヰヱヲンヴ",
];
let loaded: LoadedFont | undefined;
let loading = false;
let selection = 0;
let fontRequest: AbortController | undefined;
let downloadName = "";

function message(value: string) {
  status.textContent = value;
  status.hidden = value === "";
}

function render() {
  figure.replaceChildren();
  glyphDetails.replaceChildren();
  download.disabled = true;
  const rubyMode = comparison.value === "ruby";
  const horizontalFeature = rubyMode ? "ruby" : "hkna";
  const verticalFeature = rubyMode ? "ruby" : "vkna";
  const alternateLabels = {
    horizontal: horizontalFeature,
    vertical: rubyMode ? "ruby.vert" : "vkna",
  };
  horizontalOutlineLabel.textContent = alternateLabels.horizontal;
  verticalOutlineLabel.textContent = alternateLabels.vertical;
  if (!loaded || loading) return;

  const value = kana.value.trim().normalize("NFC");
  if (
    [...segmenter.segment(value)].length !== 1 ||
    !/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}][\p{M}]*$/u.test(
      value,
    ) ||
    !/[\p{L}\p{Lm}]/u.test(value)
  ) {
    message("Enter one kana.");
    return;
  }

  try {
    const { font, name, featureTags, glyphLabel } = loaded;
    const runs = {
      horizontal: shapeKana(font, value, false),
      vertical: shapeKana(font, value, true),
      horizontalAlternate: shapeKana(font, value, false, horizontalFeature),
      verticalAlternate: shapeKana(font, value, true, verticalFeature),
    };
    if (
      Object.values(runs).some(
        (run) => !run.length || run.some((glyph) => glyph.codepoint === 0),
      )
    ) {
      message("This kana is missing from the font.");
      return;
    }
    const { svg, alternateColors } = makeFigure(font, name, value, runs, {
      showLabels: labels.checked,
      alternateLabels,
      outline: {
        default: outlines.default.checked,
        vert: outlines.vert.checked,
        horizontal: outlines.horizontal.checked,
        vertical: outlines.vertical.checked,
      },
    });
    figure.append(svg);
    for (const [label, run, color] of [
      ["Default", runs.horizontal],
      ["vert", runs.vertical],
      [
        alternateLabels.horizontal,
        runs.horizontalAlternate,
        alternateColors.horizontal,
      ],
      [
        alternateLabels.vertical,
        runs.verticalAlternate,
        alternateColors.vertical,
      ],
    ] as const) {
      const entry = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      if (color) entry.style.color = color;
      term.textContent = label;
      description.textContent = run
        .map((glyph) => glyphLabel(glyph.codepoint))
        .join(", ");
      entry.append(term, description);
      glyphDetails.append(entry);
    }
    const notes: string[] = [];
    for (const [label, tag, base, alternate] of [
      [
        alternateLabels.horizontal,
        horizontalFeature,
        runs.horizontal,
        runs.horizontalAlternate,
      ],
      [
        alternateLabels.vertical,
        verticalFeature,
        runs.vertical,
        runs.verticalAlternate,
      ],
    ] as const) {
      if (sameGlyphs(base, alternate)) {
        const note = featureTags.has(tag)
          ? `${label} leaves this kana unchanged.`
          : `This font has no ${tag} feature.`;
        if (!notes.includes(note)) notes.push(note);
      }
    }
    message(notes.join(" "));
    downloadName = `${name}-${value}${rubyMode ? "-ruby" : ""}.svg`.replace(
      /[<>:"/\\|?*]/g,
      "_",
    );
    download.disabled = false;
  } catch (error) {
    message(
      error instanceof Error ? error.message : "Could not draw the kana.",
    );
  }
}

async function selectFont(
  read: (signal: AbortSignal) => Promise<LoadedFont>,
  progress: string,
) {
  const request = ++selection;
  fontRequest?.abort();
  fontRequest = new AbortController();
  loaded = undefined;
  loading = true;
  render();
  message(progress);

  try {
    const font = await read(fontRequest.signal);
    if (request !== selection) return;
    loaded = font;
    loading = false;
    render();
  } catch (error) {
    if (request !== selection) return;
    loading = false;
    message(
      error instanceof Error ? error.message : "Could not read the font.",
    );
  }
}

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (!file) return;

  googleFont.value = "";
  void selectFont(() => loadFont(file), "Reading font…");
});

function selectGoogleFont() {
  const preset = googleFonts.find(({ slug }) => slug === googleFont.value);
  if (!preset) {
    ++selection;
    fontRequest?.abort();
    loaded = undefined;
    loading = false;
    render();
    message(
      "Choose a Google Fonts family or open an OTF, TTF, WOFF, or WOFF2 file.",
    );
    return;
  }
  input.value = "";
  void selectFont(
    (signal) => loadGoogleFont(preset, signal),
    `Loading ${preset.name}…`,
  );
}

googleFont.addEventListener("change", selectGoogleFont);

let composing = false;
kana.addEventListener("compositionstart", () => {
  composing = true;
});
kana.addEventListener("compositionend", () => {
  composing = false;
  render();
});
kana.addEventListener("input", () => {
  if (!composing) render();
});
function chooseRandomKana(pool: readonly string[]) {
  const current = kana.value.trim().normalize("NFC");
  const choices = pool.filter((character) => {
    if (character === current) return false;
    return (
      !loaded || Boolean(loaded.font.nominalGlyph(character.codePointAt(0)!))
    );
  });
  if (!choices.length) return;
  kana.value = choices[Math.floor(Math.random() * choices.length)];
  render();
}

randomSmallKana.addEventListener("click", () =>
  chooseRandomKana(smallKanaChoices),
);
randomNonSmallKana.addEventListener("click", () =>
  chooseRandomKana(nonSmallKanaChoices),
);

document
  .querySelector("form")
  ?.addEventListener("submit", (event) => event.preventDefault());

for (const control of [comparison, labels, ...Object.values(outlines)]) {
  control.addEventListener("change", render);
}

download.addEventListener("click", () => {
  const svg = figure.querySelector("svg");
  if (!svg) return;
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
