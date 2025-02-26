const urlInput = document.getElementById('url-bar');
const frame = document.getElementById('page-frame');

// 加载初始页面
frame.src = 'https://example.com';

// 处理URL输入
urlInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const url = await normalizeUrl(urlInput.value);
    if (url) {
      frame.src = url;
    }
  }
});

// URL格式化函数
async function normalizeUrl(input) {
  try {
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    new URL(url); // 验证URL格式
    return url;
  } catch {
    alert('Invalid URL format');
    return null;
  }
}

// 深度安全策略绕过
frame.addEventListener('load', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: () => {
        // 重写关键安全属性
        Object.defineProperties(window, {
          self: { get: () => window },
          parent: { get: () => window },
          top: { get: () => window }
        });

        // 拦截安全策略违规事件
        document.addEventListener('securitypolicyviolation', e => {
          e.preventDefault();
          e.stopImmediatePropagation();
        });

        // 动态移除CSP meta标签
        const observer = new MutationObserver(mutations => {
          mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach(node => {
              if (node.nodeName === 'META' && 
                  node.httpEquiv?.toLowerCase() === 'content-security-policy') {
                node.remove();
              }
            });
          });
        });

        observer.observe(document.head, { childList: true, subtree: true });
      }
    });
  } catch (error) {
    console.error('Security injection failed:', error);
  }
}); 