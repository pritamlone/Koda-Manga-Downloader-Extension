import fs from 'fs';
let code = fs.readFileSync('options/options.js', 'utf8');

code = code.replace(
  /if \(s.filenameTemplate\) document.getElementById\('opt-template'\).value = s.filenameTemplate;/,
  "if (s.filenameTemplate) document.getElementById('opt-template').value = s.filenameTemplate;\n    document.getElementById('opt-floating-banner').checked = s.enableFloatingBanner !== false;"
);

code = code.replace(
  /filenameTemplate: document.getElementById\('opt-template'\).value,/,
  "filenameTemplate: document.getElementById('opt-template').value,\n      enableFloatingBanner: document.getElementById('opt-floating-banner').checked,"
);

fs.writeFileSync('options/options.js', code);
