import JSZip from 'jszip';
import { EXTENSION_FILES } from '../data/extensionCodebase';

export async function exportExtensionAsZip(): Promise<void> {
  const zip = new JSZip();

  EXTENSION_FILES.forEach(file => {
    zip.file(file.path, file.content);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'koda-manga-downloader-v3.0.0.zip';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
