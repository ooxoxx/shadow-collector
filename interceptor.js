// interceptor.js
(function () {
  console.log(">>> 🚀 ShadowCollector: 全能拦截器已注入 (Fetch + XHR)...");

  // ==========================================
  // API 模式匹配
  // ==========================================
  const API_PATTERNS = {
    // 目标检测
    DETECTION_LIST: /\/api\/sampleListOfTask/,
    DETECTION_LABEL: /\/api\/updateLabelInfo\/[a-f0-9]{32}\/[a-f0-9]{32}\/label/,

    // 文本质检
    TEXT_QA_INFO: /\/api\/get_json\/[a-f0-9]{32}$/,
    TEXT_QA_LABEL: /\/api\/(save_json|pass_json)\/[a-f0-9]{32}$/,

    // 图像分类
    CLASSIFY_LIST: /\/api\/classifyTasksList\/[a-f0-9]{32}\/\d+/,
    CLASSIFY_LABEL: /\/api\/classifyTaskDataLabel\/[a-f0-9]{32}\/[a-f0-9]{32}$/,

    // 问答对标注
    QA_PAIR_INFO: /\/api\/txt_label_task\/review\/get_data_by_file/,
    QA_PAIR_LABEL: /\/api\/txt_label_task\/review\/update_qa_data$/,
  };

  // 图片元数据缓存 { imageId: { filename, imageUrl, width, height } }
  const imageCache = {};

  // 文本质检元数据缓存 { fileId: { filename, rawFileUrl, taskId, batchId } }
  const textQACache = {};

  // 图像分类元数据缓存 { imageId: { filename, imageUrl, width, height, taskId } }
  const classifyCache = {};

  // 问答对标注元数据缓存 { taskId: { filename, fileUrl, department, storagePath } }
  const qaPairCache = {};

  // 当前问答对文件 (用于 update_qa_data 匹配)
  let currentQAPairFile = null;

  // 发送消息到 background.js (通过 content.js 中继)
  function sendToBackground(workflowType, payload) {
    console.log("%c >>> [interceptor] sendToBackground", "color: lime; font-weight: bold;", {
      workflowType,
      fileUrl: payload?.fileUrl ? "[有]" : "[无]"
    });
    window.postMessage({
      source: 'shadow-collector-interceptor',
      workflowType,
      payload
    }, '*');
  }

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
    if (match) {
      return match[1];
    }
    // 相对路径时，使用当前页面的 origin
    return window.location.origin;
  }

  // 从带 auth 参数的路径中提取纯路径
  function extractStoragePath(rawPath) {
    if (!rawPath) return null;
    const authIndex = rawPath.indexOf('?auth=');
    return authIndex > 0 ? rawPath.substring(0, authIndex) : rawPath;
  }

  // 处理 DETECTION_LIST 响应
  function handleDetectionList(url, resData) {
    const baseUrl = getBaseUrl(url);
    const items = resData?.data?.items || [];

    items.forEach(item => {
      imageCache[item.id] = {
        filename: item.filename,
        imageUrl: `${baseUrl}/${item.storage_path}`,
        width: Number(item.width),
        height: Number(item.height),
        storagePath: extractStoragePath(item.storage_path)
      };
    });

    console.log(`📦 已缓存 ${items.length} 张图片信息`);
  }

  // 处理 DETECTION_LABEL 请求 (异步) - 支持目标检测和多模态标注
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

    // 解析 descriptionAnnotation 和 qaAnnotation (后端判断类型)
    let descriptionAnnotation = [];
    let qaAnnotation = [];
    try {
      descriptionAnnotation = JSON.parse(body?.descriptionAnnotation || "[]");
      qaAnnotation = JSON.parse(body?.qaAnnotation || "[]");
    } catch { }

    // 判断标注类型（仅用于日志显示）
    const isMultimodal = descriptionAnnotation.length > 0 || qaAnnotation.length > 0;
    const annotationType = isMultimodal ? "MULTIMODAL" : "DETECTION";

    // 查找配对的图片信息
    const imageInfo = imageCache[imageId];
    if (!imageInfo) {
      console.error(`❌ 图片信息未找到: ${imageId}, 缓存中有: ${Object.keys(imageCache).length} 条`);
      return null;
    }

    console.group(`📋 配对结果 [${annotationType}]`);
    console.log("%c 标注类型:", "color: gold; font-weight: bold;", annotationType);
    console.log("%c 图片:", "color: cyan;", imageInfo?.imageUrl || "未找到");
    console.log("%c 框标注数量:", "color: magenta;", annotations.length);

    if (isMultimodal) {
      console.log("%c 描述标注数量:", "color: lightblue;", descriptionAnnotation.length);
      console.log("%c QA标注数量:", "color: lightgreen;", qaAnnotation.length);
    }

    // === 构建 payload (传 URL，不传 base64) ===
    const payload = {
      taskId,
      imageId,
      filename: imageInfo?.filename,
      width: imageInfo?.width,
      height: imageInfo?.height,
      annotations,
      descriptionAnnotation,  // 始终包含，后端判断类型
      qaAnnotation,           // 始终包含，后端判断类型
      fileUrl: imageInfo?.imageUrl,  // 传 URL，background.js 负责下载
      storagePath: imageInfo?.storagePath,
      uploadTime: new Date().toISOString()
    };

    console.log("%c 📦 Payload 已构建:", "color: orange;", {
      ...payload,
      fileUrl: payload.fileUrl ? "[URL]" : null,
      descriptionAnnotation: `[${descriptionAnnotation.length} 条描述]`,
      qaAnnotation: `[${qaAnnotation.length} 条QA]`
    });
    console.groupEnd();

    // 发送到 background.js
    sendToBackground('DETECTION', payload);

    return payload;
  }

  // 处理 TEXT_QA_INFO 响应 - 缓存文件信息
  function handleTextQAInfo(url, resData) {
    const match = url.match(/\/api\/get_json\/([a-f0-9]{32})/);
    if (!match) return;

    const fileId = match[1];
    const baseUrl = getBaseUrl(url);
    const data = resData?.data;

    if (data) {
      textQACache[fileId] = {
        filename: data.filename,
        rawFileUrl: `${baseUrl}/${data.raw_filepath}`,
        taskId: data.task_id,
        batchId: data.batch_id,
        storagePath: extractStoragePath(data.raw_filepath)
      };
      console.log(`📄 已缓存文本质检文件: ${data.filename}`);
    }
  }

  // 处理 TEXT_QA_LABEL 请求 - 构建 payload 并发送 (异步)
  async function handleTextQALabel(url, reqBody) {
    const match = url.match(/\/api\/(?:save_json|pass_json)\/([a-f0-9]{32})/);
    if (!match) return null;

    const fileId = match[1];
    const body = parseBody(reqBody);
    const fileInfo = textQACache[fileId];

    // 解析标注数据
    let annotations = null;
    try {
      annotations = JSON.parse(body?.jsonStr || "{}");
    } catch {
      console.warn("标注数据解析失败");
    }

    console.group("📋 文本质检配对结果");
    console.log("%c 原文件:", "color: cyan;", fileInfo?.rawFileUrl || "未找到");

    // 构建 payload (传 URL，不传 base64)
    const payload = {
      fileId,
      filename: fileInfo?.filename,
      taskId: fileInfo?.taskId,
      batchId: fileInfo?.batchId,
      annotations,
      fileUrl: fileInfo?.rawFileUrl,  // 传 URL，background.js 负责下载
      storagePath: fileInfo?.storagePath,
      uploadTime: new Date().toISOString()
    };

    console.log("%c 📦 Payload 已构建:", "color: orange;", {
      ...payload,
      fileUrl: payload.fileUrl ? "[URL]" : null,
      annotations: annotations ? "[标注数据]" : null
    });
    console.groupEnd();

    // 发送到 background.js
    sendToBackground('TEXT_QA', payload);

    return payload;
  }

  // 处理 CLASSIFY_LIST 响应 - 缓存图片信息
  function handleClassifyList(url, resData) {
    const match = url.match(/\/api\/classifyTasksList\/([a-f0-9]{32})\/(\d+)/);
    if (!match) return;

    const taskId = match[1];
    const baseUrl = getBaseUrl(url);
    const items = resData?.data?.items || [];

    items.forEach(item => {
      classifyCache[item.id] = {
        filename: item.filename,
        imageUrl: `${baseUrl}/${item.raw_filepath}`,
        width: Number(item.width),
        height: Number(item.height),
        taskId: taskId,
        storagePath: extractStoragePath(item.raw_filepath)
      };
    });

    console.log(`🏷️ 已缓存 ${items.length} 张分类图片信息`);
  }

  // 处理 CLASSIFY_LABEL 请求 - 构建 payload 并发送 (异步)
  async function handleClassifyLabel(url, reqBody) {
    const match = url.match(/\/api\/classifyTaskDataLabel\/([a-f0-9]{32})\/([a-f0-9]{32})/);
    if (!match) return null;

    const [, taskId, imageId] = match;
    const body = parseBody(reqBody);
    const imageInfo = classifyCache[imageId];

    // 标签 ID 数组
    const labelIds = Array.isArray(body) ? body : [];

    console.group("📋 图像分类配对结果");
    console.log("%c 图片:", "color: cyan;", imageInfo?.imageUrl || "未找到");
    console.log("%c 标签数量:", "color: magenta;", labelIds.length);

    // 构建 payload (传 URL，不传 base64)
    const payload = {
      taskId,
      imageId,
      filename: imageInfo?.filename,
      width: imageInfo?.width,
      height: imageInfo?.height,
      labelIds,
      fileUrl: imageInfo?.imageUrl,  // 传 URL，background.js 负责下载
      storagePath: imageInfo?.storagePath,
      uploadTime: new Date().toISOString()
    };

    console.log("%c 📦 Payload 已构建:", "color: orange;", {
      ...payload,
      fileUrl: payload.fileUrl ? "[URL]" : null
    });
    console.groupEnd();

    // 发送到 background.js
    sendToBackground('CLASSIFY', payload);

    return payload;
  }

  // 处理 QA_PAIR_INFO 响应 - 缓存文件信息
  function handleQAPairInfo(url, resData) {
    // 从 URL 提取 taskId 和 dataTxtId
    const urlObj = new URL(url, window.location.origin);
    const taskId = urlObj.searchParams.get('taskId');
    const dataTxtId = urlObj.searchParams.get('dataTxtId');

    if (!taskId) return;

    const baseUrl = getBaseUrl(url);
    const data = resData?.data;

    if (data?.origin_file_path) {
      const fileInfo = {
        taskId,
        dataTxtId,
        filename: data.origin_file_path.split('/').pop()?.split('?')[0] || 'unknown',
        fileUrl: `${baseUrl}/${data.origin_file_path}`,
        department: data.file_department,
        storagePath: extractStoragePath(data.origin_file_path),
        qaDataList: data.qa_data_list || []
      };

      qaPairCache[taskId] = fileInfo;
      currentQAPairFile = fileInfo;  // 记录当前文件

      console.log(`📝 已缓存问答对文件: ${fileInfo.filename}`);
    }
  }

  // 处理 QA_PAIR_LABEL 请求 - 构建 payload 并发送 (异步)
  async function handleQAPairLabel(url, reqBody) {
    const body = parseBody(reqBody);
    const fileInfo = currentQAPairFile;  // 使用当前文件信息

    if (!fileInfo) {
      console.error('❌ 未找到对应的问答对文件信息');
      return null;
    }

    console.group('📋 问答对标注配对结果');
    console.log('%c 原文件:', 'color: cyan;', fileInfo?.fileUrl || '未找到');
    console.log('%c 标注数据:', 'color: magenta;', body);

    // 构建 payload
    const payload = {
      taskId: fileInfo.taskId,
      dataTxtId: fileInfo.dataTxtId,
      filename: fileInfo.filename,
      department: fileInfo.department,
      annotation: body,  // 包含 dataId, questionType, editedInput, editedAnswer 等
      fileUrl: fileInfo.fileUrl,
      storagePath: fileInfo.storagePath,
      uploadTime: new Date().toISOString()
    };

    console.log('%c 📦 Payload 已构建:', 'color: orange;', {
      ...payload,
      fileUrl: payload.fileUrl ? '[URL]' : null
    });
    console.groupEnd();

    sendToBackground('QA_PAIR', payload);
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
    console.log(`%c >>> [logTraffic] ${type} ${url}`, "color: yellow; font-weight: bold;");
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
      } else if (patternName === "TEXT_QA_INFO") {
        handleTextQAInfo(url, resData);
      } else if (patternName === "TEXT_QA_LABEL") {
        handleTextQALabel(url, reqBody);
      } else if (patternName === "CLASSIFY_LIST") {
        handleClassifyList(url, resData);
      } else if (patternName === "CLASSIFY_LABEL") {
        handleClassifyLabel(url, reqBody);
      } else if (patternName === "QA_PAIR_INFO") {
        handleQAPairInfo(url, resData);
      } else if (patternName === "QA_PAIR_LABEL") {
        handleQAPairLabel(url, reqBody);
      }

      console.groupEnd();
    } else {
      // 其他请求，仅调试输出（可选关闭）
      // console.log(`[ShadowCollector] ${type}: ${url}`);
    }
  }
})();
