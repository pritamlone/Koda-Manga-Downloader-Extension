import fs from 'fs';
let code = fs.readFileSync('popup/popup.html', 'utf8');

code = code.replace(
  /<button class="koda-tab" data-tab="tab-active">DOWNLOADS/g,
  '<button class="koda-tab" data-tab="tab-logs">LOGS</button>\n      <button class="koda-tab" data-tab="tab-active">DOWNLOADS'
);

const logsSection = `
    <!-- Tab 4: Logs -->
    <section id="tab-logs" class="koda-tab-content">
      <div class="koda-card" style="height: 250px; overflow-y: auto; background: #111; color: #fff;">
        <ul id="log-list-container" class="koda-log-list" style="list-style: none; padding: 10px; margin: 0; font-family: monospace; font-size: 11px;">
          <li>[SYSTEM] Log initialized.</li>
        </ul>
      </div>
      <button id="btn-clear-logs" class="koda-btn-subtle full-width mt-12">🗑️ CLEAR LOGS</button>
    </section>
`;

code = code.replace(
  /<!-- Footer Status -->/g,
  logsSection + '\n    <!-- Footer Status -->'
);

fs.writeFileSync('popup/popup.html', code);
