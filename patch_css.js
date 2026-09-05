import fs from 'fs';
let css = fs.readFileSync('content/content_script.css', 'utf8');

css = css.replace(
  /transform-origin: bottom right;\s*transition: opacity 0.2s ease, transform 0.25s cubic-bezier\(0.16, 1, 0.3, 1\);\s*width: 380px;\s*height: 520px;/,
  "position: absolute;\n  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);\n  width: 380px;\n  height: 520px;"
);

css = css.replace(
  /margin-bottom: 10px;\s*flex-direction: column;/,
  "flex-direction: column;\n  z-index: 10;"
);

fs.writeFileSync('content/content_script.css', css);
