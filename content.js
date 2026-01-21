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
  if (event.source !== window) return;
  if (event.data?.source !== 'shadow-collector-interceptor') return;

  chrome.runtime.sendMessage({
    type: 'LABEL_DATA',
    workflowType: event.data.workflowType,
    payload: event.data.payload
  });
});
