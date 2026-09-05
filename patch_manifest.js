import fs from 'fs';
let manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

if (!manifest.permissions.includes('sidePanel')) {
  manifest.permissions.push('sidePanel');
}
if (!manifest.permissions.includes('contextMenus')) {
  manifest.permissions.push('contextMenus');
}

manifest.side_panel = {
  default_path: "popup/popup.html"
};

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
