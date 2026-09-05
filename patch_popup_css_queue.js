import fs from 'fs';
let css = fs.readFileSync('popup/popup.css', 'utf8');

css = css.replace(
  /\.koda-queue-list \{[^}]*\}/,
  `.koda-queue-list {
  flex: 1;
  overflow-y: auto;
  max-height: none;
}`
);

fs.writeFileSync('popup/popup.css', css);
