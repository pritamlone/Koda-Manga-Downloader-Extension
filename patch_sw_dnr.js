import fs from 'fs';
let code = fs.readFileSync('background/service-worker.js', 'utf8');

const dnrHelpers = `

async function setupRefererRule(pageUrl) {
  if (!pageUrl) return;
  const origin = new URL(pageUrl).origin + '/';
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "referer", operation: "set", value: origin }
        ]
      },
      condition: {
        resourceTypes: ["xmlhttprequest", "image", "media", "other"]
      }
    }]
  });
}

async function clearRefererRule() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1]
  });
}
`;

code = code.replace(
  /async function executeDownloadTask\(task, settings\) \{/,
  "async function executeDownloadTask(task, settings) {\n  await setupRefererRule(task.pageUrl);"
);

code = code.replace(
  /await updateTaskStatus\(task.id, 'packaging'\);/,
  "await clearRefererRule();\n  await updateTaskStatus(task.id, 'packaging');"
);

// also catch the error path to clear the rule
code = code.replace(
  /throw new Error\('Failed to download any images for this chapter.'\);/,
  "await clearRefererRule();\n    throw new Error('Failed to download any images for this chapter.');"
);

code += dnrHelpers;

fs.writeFileSync('background/service-worker.js', code);
