const { DOMParser } = require('linkedom');
const parser = new DOMParser();
const doc = parser.parseFromString('<img src="/relative/image.png">', 'text/html');
const img = doc.querySelector('img');
console.log(img.src);
