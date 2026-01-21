// options.js
const DEFAULT_URL = "http://127.0.0.1:8001";
const STORAGE_KEY = "serverUrl";

const serverUrlInput = document.getElementById("serverUrl");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusDiv = document.getElementById("status");

// Load saved URL on page load
document.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  serverUrlInput.value = result[STORAGE_KEY] || DEFAULT_URL;
});

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Validate URL format
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Save URL to storage
saveBtn.addEventListener("click", async () => {
  const url = serverUrlInput.value.trim();

  if (!url) {
    showStatus("请输入服务器地址", "error");
    return;
  }

  if (!isValidUrl(url)) {
    showStatus("URL 格式无效，请输入有效的 HTTP/HTTPS 地址", "error");
    return;
  }

  // Remove trailing slash for consistency
  const normalizedUrl = url.replace(/\/+$/, "");

  await chrome.storage.local.set({ [STORAGE_KEY]: normalizedUrl });
  serverUrlInput.value = normalizedUrl;
  showStatus("保存成功", "success");
});

// Test connection to server
testBtn.addEventListener("click", async () => {
  const url = serverUrlInput.value.trim();

  if (!url) {
    showStatus("请先输入服务器地址", "error");
    return;
  }

  if (!isValidUrl(url)) {
    showStatus("URL 格式无效", "error");
    return;
  }

  showStatus("正在测试连接...", "info");
  testBtn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Accept 200 or 404 as "reachable" (404 means server is up but endpoint doesn't exist)
    if (response.ok || response.status === 404) {
      showStatus(`连接成功 (状态码: ${response.status})`, "success");
    } else {
      showStatus(`服务器响应异常 (状态码: ${response.status})`, "error");
    }
  } catch (err) {
    if (err.name === "AbortError") {
      showStatus("连接超时 (5秒)", "error");
    } else {
      showStatus(`连接失败: ${err.message}`, "error");
    }
  } finally {
    testBtn.disabled = false;
  }
});
