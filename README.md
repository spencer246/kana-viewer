# Kana viewer

Run `pnpm install` and `pnpm dev`. Select a [Google Fonts](https://github.com/google/fonts/tree/29b4ec6df2522a8aee279414b78a07910b065874/ofl) family or open a single-face OTF, TTF, or WOFF2 file. WOFF 1.0 (`.woff`) is unsupported. The Google Fonts picker downloads one original TTF per family, using Regular where available and Medium otherwise. The font is processed in the browser.

Enter one kana or use **Random (small kanas)** or **Random (non-small kanas)**. In **Compare**, choose one of two modes. Both compare against the default horizontal glyph and the standard vertical glyph (`vert`).

- **hkna / vkna** compares the direction-tuned kana alternates.
- **ruby / ruby.vert** compares the font's ruby annotation glyphs in horizontal and vertical layout. `ruby.vert` is the viewer's label for shaping vertically with the `ruby` feature enabled.

The figure aligns glyph outlines to a shared origin and scale for overlays. An equals sign marks an overlay whose two runs use the same glyphs. Glyph names, CIDs, or GIDs appear below the figure. Use **Panel labels** to toggle labels inside the figure and **Outline** to switch each form between fill and outline. **Save SVG** exports the current figure.

The comparison figure's design is based on [NAOI's 2009 post comparing default kana, hkna, and vkna](https://moji-memo.hatenablog.jp/entry/20090804/1249369271).

`pnpm check` runs ESLint, Prettier, TypeScript, and the production build. Use `pnpm format` to apply formatting.

## Line endings

Use LF for text files on every platform. The repository's `.gitattributes` sets `* text=auto eol=lf`, so Git checks out text files with LF on Windows too. Prettier uses `endOfLine: "lf"`.
