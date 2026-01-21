// content.js
// 这是一个"注射器"，它的作用是把 interceptor.js 插入到页面的 DOM 中
// 这样 interceptor.js 才能运行在页面的"主世界"里，从而覆盖全局 fetch

const script = document.createElement("script");
script.src = chrome.runtime.getURL("interceptor.js");
script.onload = function () {
  this.remove(); // 执行完后移除标签，保持隐蔽
};
(document.head || document.documentElement).appendChild(script);

console.log(">>> 插件已加载：准备注入拦截脚本...");

// 监听来自 interceptor.js 的消息，中继到 background.js
window.addEventListener('message', (event) => {
  // 仅检查 data.source 即可，这足以验证消息来源
  // 注意：不能检查 event.source !== window，因为跨隔离世界通信时
  // Main World 的 window 和 Content Script World 的 window 是不同的对象
  if (event.data?.source !== 'shadow-collector-interceptor') return;

  console.log(">>> [content.js] 收到 interceptor 消息:", event.data.workflowType);
  console.log("%c >>> [content.js] 转发到 background", "color: orange; font-weight: bold;", {
    workflowType: event.data.workflowType
  });

  try {
    chrome.runtime.sendMessage({
      type: 'LABEL_DATA',
      workflowType: event.data.workflowType,
      payload: event.data.payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(">>> [content.js] 发送失败:", chrome.runtime.lastError.message);
      } else {
        console.log(">>> [content.js] 消息已发送到 background, response:", response);
      }
    });
  } catch (err) {
    console.error(">>> [content.js] sendMessage 抛出异常:", err);
  }
});
