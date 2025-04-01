// ==UserScript==
// @name         yiyan
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.0
// @description  try to take over the world!
// @author       You
// @match        https://yiyan.baidu.com/*
// ==/UserScript==

(function () {
  'use strict';

  window.onload = function () {
      // 清理所有的定时器
      let endTid = setTimeout(function () { });
      for (let i = 0; i <= endTid; i++) {
          clearTimeout(i);
          clearInterval(i);
      }
  }

})();