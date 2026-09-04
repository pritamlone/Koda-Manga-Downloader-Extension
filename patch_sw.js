import fs from 'fs';
let code = fs.readFileSync('background/service-worker.js', 'utf8');

code = code.replace(
  /const newTask = \{/,
  "const newTask = {\n    pageUrl: taskData.pageUrl,"
);

code = code.replace(
  /async function updateTaskStatus\(taskId, newStatus\) \{/,
  "async function updateTaskStatus(taskId, newStatus, errorMessage = null) {"
);

code = code.replace(
  /task\.status = newStatus;/,
  "task.status = newStatus;\n    if (errorMessage) task.error = errorMessage;"
);

code = code.replace(
  /console.error\('\[Koda Engine Error\] Task failed:', err\);\s*await updateTaskStatus\(nextTask.id, 'failed'\);/g,
  "console.error('[Koda Engine Error] Task failed:', err);\n    await addLog('error', `Task failed: ${err.message}`);\n    await updateTaskStatus(nextTask.id, 'failed', err.message);"
);

code = code.replace(
  /console.log\(`\[Koda Engine\] Executing Task: \$\{task.mangaTitle\} - \$\{task.chapterTitle\} \(\$\{task.totalPages\} pages\)`\);/,
  "console.log(`[Koda Engine] Executing Task: ${task.mangaTitle} - ${task.chapterTitle} (${task.totalPages} pages)`);\n  await addLog('info', `Executing: ${task.chapterTitle}`);"
);

code = code.replace(
  /console.log\(`\[Koda Engine\] Task completed successfully: \$\{task.mangaTitle\} - \$\{task.chapterTitle\}`\);/,
  "console.log(`[Koda Engine] Task completed successfully: ${task.mangaTitle} - ${task.chapterTitle}`);\n  await addLog('success', `Completed: ${task.chapterTitle}`);"
);

const logFn = `
async function addLog(type, message) {
  const res = await chrome.storage.local.get(['logs']);
  const logs = res.logs || [];
  logs.unshift({ type, message, time: Date.now() });
  if (logs.length > 50) logs.pop();
  await chrome.storage.local.set({ logs });
}
`;

code += logFn;

fs.writeFileSync('background/service-worker.js', code);
