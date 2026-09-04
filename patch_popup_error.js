import fs from 'fs';
let code = fs.readFileSync('popup/popup.js', 'utf8');

code = code.replace(
  /<span class="koda-task-status">\$\{task.status.toUpperCase\(\)\}<\/span>\n        <\/div>\n      <\/div>/g,
  '<span class="koda-task-status">${task.status.toUpperCase()}</span>\n        </div>\n        ${task.error ? `<div style="color:#ff5555; font-size:10px; margin-top:4px; font-weight:bold;">ERROR: ${task.error}</div>` : \'\'}\n      </div>'
);

fs.writeFileSync('popup/popup.js', code);
