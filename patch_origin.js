import fs from 'fs';
let code = fs.readFileSync('background/service-worker.js', 'utf8');
code = code.replace(
  /{ header: "referer", operation: "set", value: origin }/g,
  '{ header: "referer", operation: "set", value: origin },\n          { header: "origin", operation: "set", value: origin.slice(0, -1) }'
);
fs.writeFileSync('background/service-worker.js', code);
