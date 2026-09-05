import fs from 'fs';
let code = fs.readFileSync('options/options.html', 'utf8');

const newField = `
      <div class="koda-opt-field">
        <label>ENABLE FLOATING BANNER</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="opt-floating-banner" checked>
          <span class="field-help" style="margin-top:0;">Show the floating badge on manga pages</span>
        </div>
      </div>
`;

code = code.replace(
  /<div class="koda-opt-card">\s*<h2>🚀 THROTTLE & RATE LIMIT PROTECTION \(V3 ENGINE\)<\/h2>/,
  '<div class="koda-opt-card">\n      <h2>🚀 THROTTLE & RATE LIMIT PROTECTION (V3 ENGINE)</h2>' + newField
);

fs.writeFileSync('options/options.html', code);
