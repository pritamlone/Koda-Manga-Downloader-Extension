import fs from 'fs';
let js = fs.readFileSync('content/content_script.js', 'utf8');

const replacement = `
    function openPopup() {
      isPopupOpen = true;
      popupWindow.classList.add('is-open');
      badge.classList.add('is-active');

      // Intelligently calculate popup placement relative to container & viewport
      const rect = badge.getBoundingClientRect();
      const popupWidth = 380;
      const popupHeight = 520;
      const spacing = 10;
      
      let transformOriginY = 'bottom';
      let transformOriginX = 'right';

      // Vertical positioning
      if (rect.top < popupHeight + spacing) {
        // Near top, open downward
        popupWindow.style.top = (rect.height + spacing) + 'px';
        popupWindow.style.bottom = 'auto';
        transformOriginY = 'top';
      } else {
        // Near bottom, open upward
        popupWindow.style.bottom = (rect.height + spacing) + 'px';
        popupWindow.style.top = 'auto';
        transformOriginY = 'bottom';
      }

      // Horizontal positioning
      if (rect.left < popupWidth - rect.width) {
        // Near left edge
        popupWindow.style.left = '0px';
        popupWindow.style.right = 'auto';
        transformOriginX = 'left';
      } else {
        // Near right edge
        popupWindow.style.right = '0px';
        popupWindow.style.left = 'auto';
        transformOriginX = 'right';
      }

      popupWindow.style.transformOrigin = \`\${transformOriginY} \${transformOriginX}\`;
    }
`;

js = js.replace(
  /function openPopup\(\) \{[\s\S]*?\}\s*function togglePopup\(\)/,
  replacement.trim() + '\n\n    function togglePopup()'
);

fs.writeFileSync('content/content_script.js', js);
