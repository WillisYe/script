// ==UserScript==
// @name         inputSearch test
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.0
// @description  try to take over the world!
// @author       You
// @match        *://*/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// ==/UserScript==

(function() {
  'use strict';
  var btn = document.createElement('button')
  btn.textContent = 'test'
  btn.id = 'myScriptBtn'
  btn.style.backgroundColor = 'red'
  btn.style.position = 'fixed'
  btn.style.top = '10px'
  btn.style.right = '10px'
  btn.style.zIndex = '999999'
  btn.style.width = '80px'
  btn.style.height = '30px'
  btn.style.cursor = 'pointer'

  document.body.prepend(btn)

  var input = document.createElement('input')
  input.id = 'myScriptInput'
  input.style.boxSizing = 'border-box'
  input.style.backgroundColor = '#eee'
  input.style.position = 'fixed'
  input.style.top = '10px'
  input.style.right = '100px'
  input.style.zIndex = '999999'
  input.style.width = '200px'
  input.style.height = '30px'
  input.style.padding = '5px'

  document.body.prepend(input)

  btn.addEventListener('click', function() {
      console.log($('#myScriptInput').val())
      var keyword = input.value
      // 高亮样式
      const highlightStyle = 'background-color: yellow; color: black;';

      // 遍历文本节点并高亮关键词
      function highlightText(node) {
          if (node.nodeType === Node.TEXT_NODE) {
              const text = node.nodeValue;
              const regex = new RegExp(`(${keyword})`, 'gi');
              const newText = text.replace(regex, `<span style="${highlightStyle}">$1</span>`);
              if (newText !== text) {
                  const span = document.createElement('span');
                  span.innerHTML = newText;
                  node.parentNode.replaceChild(span, node);
              }
          } else {
              for (let i = 0; i < node.childNodes.length; i++) {
                  highlightText(node.childNodes[i]);
              }
          }
      }

      // 从 body 开始高亮
      highlightText(document.body);

  })
})();