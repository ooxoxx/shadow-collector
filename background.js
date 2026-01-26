// background.js
const DEFAULT_SERVER_URL = "http://127.0.0.1:8001";
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

// 端点映射
const ENDPOINTS = {
  DETECTION: '/api/v1/label/detection',
  TEXT_QA: '/api/v1/label/text-qa',
  CLASSIFY: '/api/v1/label/classify',
  QA_PAIR: '/api/v1/label/qa-pair'
};

// 下载文件为 Blob
async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return response.blob();
}

// 构建 metadata
function buildMetadata(workflowType, payload) {
  const common = {
    uploadTime: payload.uploadTime,
    storagePath: payload.storagePath
  };

  switch (workflowType) {
    case 'DETECTION':
      return {
        ...common,
        taskId: payload.taskId,
        imageId: payload.imageId,
        filename: payload.filename,
        width: payload.width,
        height: payload.height,
        annotations: payload.annotations || [],
        descriptionAnnotation: payload.descriptionAnnotation || [],
        qaAnnotation: payload.qaAnnotation || []
      };
    case 'TEXT_QA':
      return {
        ...common,
        fileId: payload.fileId,
        filename: payload.filename,
        taskId: payload.taskId,
        batchId: payload.batchId,
        annotations: payload.annotations
      };
    case 'CLASSIFY':
      return {
        ...common,
        taskId: payload.taskId,
        imageId: payload.imageId,
        filename: payload.filename,
        width: payload.width,
        height: payload.height,
        labelIds: payload.labelIds || []
      };
    case 'QA_PAIR':
      return {
        ...common,
        taskId: payload.taskId,
        dataTxtId: payload.dataTxtId,
        filename: payload.filename,
        department: payload.department,
        annotation: payload.annotation
      };
    default:
      return common;
  }
}

// 发送 multipart/form-data
async function sendLabelData(workflowType, payload) {
  const endpoint = ENDPOINTS[workflowType];
  if (!endpoint) {
    console.error(`[${workflowType}] Invalid workflow type`);
    return { success: false, error: 'Invalid workflow type' };
  }

  if (!payload.fileUrl) {
    console.error(`[${workflowType}] Missing fileUrl`);
    return { success: false, error: 'Missing fileUrl' };
  }

  try {
    console.log(`[${workflowType}] Downloading file...`);
    // 直接下载文件为 Blob
    const fileBlob = await downloadFile(payload.fileUrl);
    console.log(`[${workflowType}] File downloaded: ${(fileBlob.size / 1024).toFixed(1)} KB`);

    const metadata = buildMetadata(workflowType, payload);

    // 📤 发送前记录完整 metadata
    console.log(`[${workflowType}] 📤 发送的 metadata:`, JSON.stringify(metadata, null, 2));

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('file', fileBlob, payload.filename || 'file');

    console.log(`[${workflowType}] Uploading to ${cachedServerUrl}${endpoint}...`);
    const response = await fetch(`${cachedServerUrl}${endpoint}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      // 详细错误日志
      console.error(`[${workflowType}] ❌ 上传失败 (${response.status})`);
      console.error(`[${workflowType}] 📋 发送的 metadata:`, JSON.stringify(metadata, null, 2));
      console.error(`[${workflowType}] 📋 服务器响应:`, JSON.stringify(result, null, 2));
      return { success: false, status: response.status, error: result.error || result };
    }

    console.log(`[${workflowType}] ✅ 上传成功:`, result);
    return { success: true, data: result };
  } catch (err) {
    console.error(`[${workflowType}] Error:`, err);
    return { success: false, error: err.message };
  }
}

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("%c >>> [background] 收到消息", "color: gold; font-weight: bold;", {
    type: request.type,
    workflowType: request.workflowType
  });
  console.log(">>> [background] 当前服务器地址:", cachedServerUrl);

  if (request.type === 'LABEL_DATA') {
    sendLabelData(request.workflowType, request.payload)
      .then(result => sendResponse(result));  // 直接返回完整结果
    return true; // 保持消息通道开放，等待异步响应
  }
});
