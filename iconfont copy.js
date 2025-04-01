// ==UserScript==
// @name         iconfont copy
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  iconfont copy
// @author       You
// @match        *://www.iconfont.cn/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  // 监听复制事件
  document.addEventListener('copy', function (event) {
      const copiedText = window.getSelection().toString().trim();
      if (copiedText.includes('icon-')) {
          const icontag = `<i class="iconfont ${copiedText}"></i>`;
          if (icontag) {
              // 阻止默认复制行为
              event.preventDefault();
              // 将转换后的 iconfont 类名复制到剪贴板
              GM_setClipboard(icontag);
          }
      }
  });
})();