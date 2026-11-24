// ==UserScript==
// @name         API 文档一键复制
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  在 API 网关测试文档页面，展开分类时为接口名称添加图标复制按钮
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============ 调试开关 ============
    var DEBUG = false;
    function log() {
        if (!DEBUG) return;
        var args = ['[API-Copy]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    // ============ 工具函数 ============

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).catch(function () {
                return fallbackCopy(text);
            });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }

    // ============ 图标按钮工厂 ============

    var COPY_ICON_SVG =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
        '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
        '</svg>';

    var CHECK_ICON_SVG =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="20 6 9 17 4 12"/>' +
        '</svg>';

    function createIconButton(textFn, tooltip) {
        var btn = document.createElement('span');
        btn.className = 't-copy-icon';
        btn.innerHTML = COPY_ICON_SVG;
        btn.title = tooltip || '复制';
        btn.style.cssText =
            'display:inline-flex;align-items:center;justify-content:center;' +
            'width:20px;height:20px;cursor:pointer;color:#888;' +
            'border-radius:3px;transition:color .15s,background .15s;' +
            'user-select:none;line-height:0;';

        btn.addEventListener('mouseenter', function () {
            btn.style.color = '#333';
            btn.style.background = '#eaeaea';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.color = '#888';
            btn.style.background = 'transparent';
            if (btn.dataset.copied === '1') {
                btn.innerHTML = COPY_ICON_SVG;
                btn.dataset.copied = '';
            }
        });

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var text = typeof textFn === 'function' ? textFn() : textFn;
            log('点击复制, text=', text);
            if (!text) return;
            copyText(text).then(function () {
                btn.innerHTML = CHECK_ICON_SVG;
                btn.style.color = '#27ae60';
                btn.dataset.copied = '1';
                setTimeout(function () {
                    if (btn.dataset.copied === '1') {
                        btn.innerHTML = COPY_ICON_SVG;
                        btn.style.color = '#888';
                        btn.dataset.copied = '';
                    }
                }, 1500);
            });
        });

        return btn;
    }

    // ============ 注入单个元素 ============

    function injectOneInterfaceName(el) {
        if (el.dataset.copyInjected) return;
        el.dataset.copyInjected = '1';

        var li = el.closest('li');
        if (li && getComputedStyle(li).position === 'static') {
            li.style.position = 'relative';
        }

        var btn = createIconButton(function () {
            var text = el.textContent || '';
            var idx = text.indexOf('—');
            return idx > 0 ? text.substring(0, idx).trim() : text.trim();
        }, '复制接口路径');

        btn.style.cssText += ';position:absolute;top:4px;right:6px;z-index:2;';
        (li || el).appendChild(btn);
        log('注入 interfaceName:', el.textContent?.substring?.(0, 40));
    }

    // 在指定范围内注入 interfaceName 按钮（只处理当前可见 & 未注入的）
    function injectIn(root) {
        if (!root) return;
        var names = root.classList && root.classList.contains('interfaceName')
            ? [root] : root.querySelectorAll('.interfaceName');
        for (var i = 0; i < names.length; i++) {
            var el = names[i];
            if (el.dataset.copyInjected) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                injectOneInterfaceName(el);
            }
        }
    }

    // ============ 监听展开事件 ============

    // 页面的展开触发器是 .interfaceSh（点击它时 jQuery toggle 下一个兄弟元素）
    // 监听点击事件，等 toggle 生效后再对当前展开的区域注入
    document.addEventListener('click', function (e) {
        var target = e.target;
        if (!(target instanceof Element)) return;

        // 判断点击的是不是展开触发器：.interfaceSh 本身或其子元素
        var trigger = target.closest('.interfaceSh');
        if (!trigger) return;

        log('检测到 .interfaceSh 点击:', trigger.textContent?.substring?.(0, 40));

        // 等 jQuery toggle() 跑完（异步显示）再注入
        setTimeout(function () {
            log('延迟后开始注入...');

            // 只扫展开的那棵子树 —— 点哪个展开哪个，精准
            var next = trigger.nextElementSibling;
            if (next) {
                log('nextSibling class:', next.className);
                injectIn(next);
            }
        }, 0);
    }, true); // 用捕获阶段，比页面自己的 jQuery handler 更早注册到事件流里

})();
