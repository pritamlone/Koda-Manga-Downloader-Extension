import fs from 'fs';
let html = fs.readFileSync('popup/popup.html', 'utf8');

html = html.replace(
  /style="height: 250px; overflow-y: auto; background: #111; color: #fff;"/,
  'style="flex: 1; min-height: 250px; overflow-y: auto; background: #111; color: #fff; display: flex; flex-direction: column;"'
);

fs.writeFileSync('popup/popup.html', html);
