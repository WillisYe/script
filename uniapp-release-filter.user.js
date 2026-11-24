// ==UserScript==
// @name         uni-app 更新日志筛选
// @namespace    https://uniapp.dcloud.net.cn/
// @version      1.0.0
// @description  在 uni-app 正式版更新日志中仅显示【uni-app】分类
// @match        https://uniapp.dcloud.net.cn/release.html*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const CONTENT_SELECTOR = '.theme-default-content.content__default';
  const HIDDEN_ATTRIBUTE = 'data-uniapp-release-filter-hidden';
  const STYLE_ID = 'uniapp-release-filter-style';

  function addFilterStyle() {
    if (document.getElementById(STYLE_ID) || !document.documentElement) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `[${HIDDEN_ATTRIBUTE}="true"] { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  function getDirectText(element) {
    return Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim();
  }

  function filterReleaseCategories() {
    addFilterStyle();

    const content = document.querySelector(CONTENT_SELECTOR);
    if (!content) return;

    content.querySelectorAll(':scope > ul > li').forEach((category) => {
      if (getDirectText(category) === '【uni-app】') {
        category.removeAttribute(HIDDEN_ATTRIBUTE);
      } else {
        category.setAttribute(HIDDEN_ATTRIBUTE, 'true');
      }
    });
  }

  let updateScheduled = false;
  const observer = new MutationObserver(() => {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(() => {
      updateScheduled = false;
      filterReleaseCategories();
    });
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  filterReleaseCategories();
})();
