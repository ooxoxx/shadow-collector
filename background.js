// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("后台收到数据:", request);

  const MY_SERVER = "http://localhost:8000"; // 你的 Python 服务器地址

  if (request.type === "TASK_DATA") {
    // 1. 转发任务元数据给 Python 后端
    fetch(`${MY_SERVER}/api/v1/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.payload),
    }).catch((err) => console.error("上报失败", err));

    // 2. (可选) 如果 payload 里有图片链接，可以在这里发起下载
    // const imageUrl = request.payload.data.imageUrl;
    // downloadImage(imageUrl);
  }

  if (request.type === "SUBMIT_DATA") {
    fetch(`${MY_SERVER}/api/v1/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.payload),
    }).catch((err) => console.error("上报失败", err));
  }
});
