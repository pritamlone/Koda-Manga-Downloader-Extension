import fs from 'fs';
let css = fs.readFileSync('popup/popup.css', 'utf8');

css = css.replace(
  /body\.koda-theme-webapp \{[^}]*\}/,
  `body.koda-theme-webapp {
  width: 100vw;
  height: 100vh;
  min-width: 380px;
  min-height: 520px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  border: none;
  transition: background-color 0.2s ease, color 0.2s ease;
  display: flex;
  flex-direction: column;
}`
);

css = css.replace(
  /\.koda-popup-container \{[^}]*\}/,
  `.koda-popup-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}`
);

css = css.replace(
  /\.koda-tab-content\.active \{[^}]*\}/,
  `.koda-tab-content.active {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
}`
);

fs.writeFileSync('popup/popup.css', css);
