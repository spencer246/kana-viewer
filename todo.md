# Todo

- [ ] Accept a font dropped anywhere on the page, including over a displayed figure.
  - Keep Choose File available for keyboard and touch users.
  - Use “Drop a font here or choose a file.” as the empty-state prompt and show a thin border while dragging a file over the page.
  - Route the file picker and drops through the same loader. Accept one OTF, TTF, or WOFF2 file and keep processing in the browser.
  - Keep the current kana and figure settings when replacing the font. Show an error and keep the current figure if the replacement fails to load.
