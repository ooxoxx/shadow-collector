// background.js
const DEFAULT_SERVER_URL = "http://127.0.0.1:8000";
const STORAGE_KEY = "serverUrl";

// Cached server URL for better performance
let cachedServerUrl = DEFAULT_SERVER_URL;

// Initialize cached URL from storage on startup
chrome.storage.local.get(STORAGE_KEY).then((result) => {
  if (result[STORAGE_KEY]) {
    cachedServerUrl = result[STORAGE_KEY];
  }
  console.log("后台服务初始化，服务器地址:", cachedServerUrl);
});

// Listen for storage changes to update cache
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    cachedServerUrl = changes[STORAGE_KEY].newValue || DEFAULT_SERVER_URL;
    console.log("服务器地址已更新:", cachedServerUrl);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("后台收到数据:", request);

  if (request.type === "TASK_DATA") {
    // 1. 转发任务元数据给 Python 后端
    fetch(`${cachedServerUrl}/api/v1/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.payload),
    }).catch((err) => console.error("上报失败", err));

    // 2. (可选) 如果 payload 里有图片链接，可以在这里发起下载
    // const imageUrl = request.payload.data.imageUrl;
    // downloadImage(imageUrl);
  }

  if (request.type === "SUBMIT_DATA") {
    fetch(`${cachedServerUrl}/api/v1/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.payload),
    }).catch((err) => console.error("上报失败", err));
  }
});
