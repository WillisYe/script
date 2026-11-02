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
      import * as unoObj from '//cdn.jsdelivr.net/npm/transform-to-unocss-core/dist/index.mjs';
      // import * as unoObj from '//cdn.jsdmirror.com/npm/transform-to-unocss-core/dist/index.mjs';
      // import * as unoObj from '//jsd.onmicrosoft.cn/npm/transform-to-unocss-core/dist/index.mjs';
      window.toUnocssClass = unoObj.toUnocssClass
      `;
  // 将 script 标签添加到文档中
  document.head.appendChild(script);

  /**
   * 将 border-width border-style border-color 类名组合转换为 bd- 简写格式
   * 例如: border-1px border-solid border-[#AEB5C8] → bd-1-s-AEB5C8
   */
  function convertBorderClasses(cssText) {
    const classes = cssText.split(/\s+/);
    const result = [];
    let i = 0;

    while (i < classes.length) {
      // 尝试匹配连续的 border-width + border-style + border-color 模式
      if (i + 2 < classes.length) {
        const widthMatch = classes[i].match(/^border-(\d+(?:\.\d+)?(?:px)?)$/);
        const styleMatch = classes[i + 1].match(/^border-(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden|initial|inherit)$/);
        const colorMatch = classes[i + 2].match(/^border-\[#([0-9a-fA-F]{3,8})\]$/);

        if (widthMatch && styleMatch && colorMatch) {
          const w = widthMatch[1].replace(/px$/, '');
          const s = styleMatch[1][0];
          const c = colorMatch[1];
          result.push(`bd-${w}-${s}-${c}`);
          i += 3;
          continue;
        }
      }
      result.push(classes[i]);
      i++;
    }

    return result.join(' ');
  }

  // 定义需要移除的类名匹配规则
  const UNWANTED_CLASS_PATTERNS = [
    /^font-\[.+\]$/,          // 匹配 font-[...] 自定义字体族
    /^font-not-italic$/,       // 匹配 font-not-italic 默认非斜体
    /^text-left$/,       // 匹配 font-not-italic 默认非斜体
    // 如需移除更多类名，在此添加正则规则
    // 例如: /^lh-\d+px$/,    // 匹配 lh-16px 等行高
  ];

  /**
   * 过滤掉不需要的类名
   */
  function filterUnwantedClasses(classStr) {
    return classStr.split(/\s+/).filter(cls => {
      return !UNWANTED_CLASS_PATTERNS.some(pattern => pattern.test(cls));
    }).join(' ');
  }

  /**
   * 显示提示信息
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      border-radius: 8px;
      font-size: 14px;
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 执行转换并复制到剪贴板
   */
  function convertAndCopy(cssText) {
    if (!cssText.includes(':') || !cssText.includes(';')) return;

    let unocssClasses = toUnocssClass(cssText)[0];
    if (!unocssClasses) return;

    // 转换 border 相关类名
    unocssClasses = convertBorderClasses(unocssClasses);

    // 过滤掉不需要的类名
    unocssClasses = filterUnwantedClasses(unocssClasses);

    // 复制到剪贴板
    GM_setClipboard(unocssClasses);
    showToast('已复制到剪贴板');
  }

  /**
   * 在"复制代码"按钮前添加"复制UnoCSS"按钮
   */
  function addUnoCSSButton() {
    const copyBtn = document.getElementById('copy_code');
    if (!copyBtn) return;

    // 避免重复添加
    if (copyBtn.previousElementSibling && copyBtn.previousElementSibling.classList.contains('copy_unocss')) {
      return;
    }

    const unocssBtn = document.createElement('span');
    unocssBtn.className = 'right copy_unocss';
    unocssBtn.textContent = '复制UnoCSS';
    unocssBtn.style.marginRight = '8px';
    unocssBtn.style.cursor = 'pointer';

    copyBtn.parentNode.insertBefore(unocssBtn, copyBtn);

    unocssBtn.addEventListener('click', function () {
      const container = this.closest('.annotation_item.code_detail');
      if (!container) return;

      const codeEl = container.querySelector('.code_box pre code');
      if (!codeEl) return;

      const cssText = codeEl.textContent.trim();
      convertAndCopy(cssText);
    });
  }

  // 监听页面变化，动态添加按钮（处理异步加载）
  const observer = new MutationObserver(function () {
    addUnoCSSButton();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // 立即尝试添加按钮
  addUnoCSSButton();
})();
