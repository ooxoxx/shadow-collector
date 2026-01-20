// interceptor.js
(function () {
  console.log(">>> 🚀 ShadowCollector: 全能拦截器已注入 (Fetch + XHR)...");

  // ==========================================
  // API 模式匹配 - 目标检测
  // ==========================================
  const API_PATTERNS = {
    DETECTION_LIST: /\/api\/sampleListOfTask/,
    DETECTION_LABEL: /\/api\/updateLabelInfo\/[a-f0-9]{32}\/[a-f0-9]{32}\/label/,
  };

  // 图片元数据缓存 { imageId: { filename, imageUrl, width, height } }
  const imageCache = {};

  function matchPattern(url) {
    for (const [name, pattern] of Object.entries(API_PATTERNS)) {
      if (pattern.test(url)) return name;
    }
    return null;
  }

  function parseBody(body) {
    if (!body) return null;
    try {
      return typeof body === "string" ? JSON.parse(body) : body;
    } catch {
      return body;
    }
  }

  // 从 URL 提取 baseUrl
  function getBaseUrl(url) {
    const match = url.match(/^(https?:\/\/[^\/]+)/);
    return match ? match[1] : "";
  }

  // 处理 DETECTION_LIST 响应
  function handleDetectionList(url, resData) {
    const baseUrl = getBaseUrl(url);
    const items = resData?.data?.items || [];

    items.forEach(item => {
      imageCache[item.id] = {
        filename: item.filename,
        imageUrl: `${baseUrl}/api/storage/${item.storage_path}`,
        width: item.width,
        height: item.height
      };
    });

    console.log(`📦 已缓存 ${items.length} 张图片信息`);
  }

  // 下载图片并返回 Blob
  async function downloadImage(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return blob;
    } catch (err) {
      console.error("图片下载失败:", err);
      return null;
    }
  }

  // Blob 转 base64 (用于证明下载成功)
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // 处理 DETECTION_LABEL 请求 (异步)
  async function handleDetectionLabel(url, reqBody) {
    // 从 URL 提取 taskId 和 imageId
    const match = url.match(/\/api\/updateLabelInfo\/([a-f0-9]{32})\/([a-f0-9]{32})\/label/);
    if (!match) return null;

    const [, taskId, imageId] = match;
    const body = parseBody(reqBody);
    const resultStr = body?.result;

    // 解析标注数据
    let annotations = [];
    try {
      annotations = JSON.parse(resultStr);
    } catch {
      console.warn("标注数据解析失败");
    }

    // 查找配对的图片信息
    const imageInfo = imageCache[imageId];

    console.group("📋 配对结果");
    console.log("%c 图片:", "color: cyan;", imageInfo?.imageUrl || "未找到");
    console.log("%c 标注数量:", "color: magenta;", annotations.length);

    // === 下载图片 ===
    let imageBlob = null;
    let imageBase64 = null;

    if (imageInfo?.imageUrl) {
      console.log("%c 正在下载图片...", "color: yellow;");
      imageBlob = await downloadImage(imageInfo.imageUrl);

      if (imageBlob) {
        imageBase64 = await blobToBase64(imageBlob);
        console.log("%c ✅ 图片下载成功!", "color: lightgreen; font-weight: bold;");
        console.log("%c   文件大小:", "color: gray;", `${(imageBlob.size / 1024).toFixed(1)} KB`);
        console.log("%c   MIME 类型:", "color: gray;", imageBlob.type);
        // 显示缩略预览 (base64 前100字符)
        console.log("%c   Base64预览:", "color: gray;", imageBase64.substring(0, 100) + "...");
      }
    }

    // === 构建完整 payload (暂不发送) ===
    const payload = {
      taskId,
      imageId,
      filename: imageInfo?.filename,
      width: imageInfo?.width,
      height: imageInfo?.height,
      annotations,
      imageBase64  // 完整 base64 数据
    };

    console.log("%c 📦 Payload 已构建 (未发送):", "color: orange;", {
      ...payload,
      imageBase64: payload.imageBase64 ? `[${(imageBase64.length / 1024).toFixed(1)} KB base64]` : null
    });
    console.groupEnd();

    return payload;
  }

  // ==========================================
  // Part 1: 拦截 Fetch (保留之前的逻辑)
  // ==========================================
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] ? args[0].toString() : "";
    const options = args[1] || {};

    // 1. 原始请求照常发出
    const response = await originalFetch(...args);

    // 2. 克隆并读取
    const clone = response.clone();
    clone
      .json()
      .then((data) => {
        logTraffic("Fetch", url, options.body, data);
      })
      .catch(() => {}); // 忽略非JSON

    return response;
  };

  // ==========================================
  // Part 2: 拦截 XMLHttpRequest (XHR) - 新增核心
  // ==========================================
  // 保存原始方法的引用
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // 1. Hook 'open' 方法：为了拿到 URL 和 Method
  XMLHttpRequest.prototype.open = function (method, url) {
    this._capturedUrl = url; // 把 URL 存到当前实例上，方便后面用
    this._capturedMethod = method;
    return originalOpen.apply(this, arguments);
  };

  // 2. Hook 'send' 方法：为了拿到 Request Body 和 绑定 Response 监听
  XMLHttpRequest.prototype.send = function (body) {
    this._capturedBody = body; // 把请求体存下来

    // 监听请求完成事件
    this.addEventListener("load", function () {
      // 只有当响应内容是 JSON 时我们才关心
      // 获取响应头 content-type
      const contentType = this.getResponseHeader("content-type") || "";

      if (
        this.responseText &&
        (contentType.includes("json") ||
          this.responseText.trim().startsWith("{"))
      ) {
        try {
          const responseData = JSON.parse(this.responseText);
          logTraffic(
            "XHR",
            this._capturedUrl,
            this._capturedBody,
            responseData,
          );
        } catch (e) {
          // 解析失败就不打印了，避免刷屏
        }
      }
    });

    return originalSend.apply(this, arguments);
  };

  // ==========================================
  // 通用日志打印函数
  // ==========================================
  function logTraffic(type, url, reqBody, resData) {
    // 过滤静态资源请求
    if (url.match(/\.(css|js|png|jpg|svg)/)) return;

    const patternName = matchPattern(url);

    if (patternName) {
      // 匹配到目标 API，特殊处理
      console.group(`🎯 [ShadowCollector] 捕捉到 ${patternName}`);
      console.log("%c URL:", "color: orange;", url);

      // 根据类型调用对应处理函数
      if (patternName === "DETECTION_LIST") {
        handleDetectionList(url, resData);
      } else if (patternName === "DETECTION_LABEL") {
        handleDetectionLabel(url, reqBody);
      }

      console.groupEnd();

      // TODO: 后续添加消息发送逻辑
    } else {
      // 其他请求，仅调试输出（可选关闭）
      // console.log(`[ShadowCollector] ${type}: ${url}`);
    }
  }
})();
