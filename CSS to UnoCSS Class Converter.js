// ==UserScript==
// @name         CSS to UnoCSS Class Converter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Convert CSS styles to UnoCSS class names
// @author       You
// @match        *://lanhuapp.com/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
      // import * as unoObj from '//cdn.jsdelivr.net/npm/transform-to-unocss-core/dist/index.mjs';
      // import * as unoObj from '//cdn.jsdmirror.com/npm/transform-to-unocss-core/dist/index.mjs';
      import * as unoObj from '//jsd.onmicrosoft.cn/npm/transform-to-unocss-core/dist/index.mjs';
      window.toUnocssClass = unoObj.toUnocssClass
      `;
  // 将 script 标签添加到文档中
  document.head.appendChild(script);

  // 监听复制事件
  document.addEventListener('copy', function (event) {
      const copiedText = window.getSelection().toString().trim();
      if (copiedText.includes(':') && copiedText.includes(';')) {
          const unocssClasses = toUnocssClass(copiedText)[0];
          if (unocssClasses) {
              // 阻止默认复制行为
              event.preventDefault();
              // 将转换后的 UnoCSS 类名复制到剪贴板
              GM_setClipboard(unocssClasses);
          }
      }
  });
})();