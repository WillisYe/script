// ==UserScript==
// @name         接口链路记录器 (定制格式)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  按指定格式记录 API 请求链路，支持轮询合并
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置 ==========
    // 只记录 URL 里包含这些关键字的请求，留空则记录所有
    const API_KEYWORDS = ['api'];
    // 轮询合并阈值：连续相同请求/响应超过这个次数才合并
    const REPEAT_THRESHOLD = 2;

    // ========== 工具函数 ==========
    function formatTime(ms) {
        const d = new Date(ms);
        const pad = (n, len = 2) => String(n).padStart(len, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
               `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
               `.${pad(d.getMilliseconds(), 3)}`;
    }

    function shouldLog(url) {
        if (!API_KEYWORDS.length) return true;
        return API_KEYWORDS.some(k => url.includes(k));
    }

    function getApiName(url) {
        try {
            const u = new URL(url, location.origin);
            // 取路径最后一段作为 api 名称，例如 /v1/user/list -> list
            const parts = u.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || u.pathname;
        } catch { return url; }
    }

    // 用于轮询合并：记录上一组相同的 (请求体+响应体) 及其次数
    let lastFingerprint = null;
    let repeatCount = 0;

    // 输出一行日志到控制台
    function emit(text) {
        console.log(text);
    }

    // 处理一次完整的请求-响应，判断是否需要合并
    function handleCompletedLog(apiName, startStr, endStr, responseBody) {
        const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
        const fingerprint = `${apiName}|${bodyStr}`;

        if (fingerprint === lastFingerprint) {
            repeatCount++;
        } else {
            // 如果之前有堆积的重复，先输出 repeat 行
            if (repeatCount > 0) {
                emit(`${lastFingerprint.split('|')[0]} repeat ${repeatCount + 1}`);
            }
            // 重置
            lastFingerprint = fingerprint;
            repeatCount = 0;
            emit(`${apiName} start ${startStr}`);
            emit(`${apiName} end ${endStr} ${bodyStr}`);
        }
    }

    // 刷新尾部残留的 repeat
    function flushRepeat() {
        if (repeatCount > 0 && lastFingerprint) {
            emit(`${lastFingerprint.split('|')[0]} repeat ${repeatCount + 1}`);
            repeatCount = 0;
            lastFingerprint = null;
        }
    }

    // ========== 拦截 Fetch ==========
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const req = args[0];
        const url = typeof req === 'string' ? req : (req?.url || '');
        if (!shouldLog(url)) return originalFetch.apply(this, args);

        const startTime = Date.now();
        const apiName = getApiName(url);
        const startStr = formatTime(startTime);

        return originalFetch.apply(this, args).then(async (response) => {
            const endTime = Date.now();
            const endStr = formatTime(endTime);
            // clone 一份来读 body，不影响页面原本的使用
            const clone = response.clone();
            let bodyText;
            try {
                bodyText = await clone.text();
            } catch { bodyText = '[无法读取]'; }

            handleCompletedLog(apiName, startStr, endStr, bodyText);
            return response;
        }).catch(err => {
            const endTime = Date.now();
            const endStr = formatTime(endTime);
            emit(`${apiName} end ${endStr} [请求失败: ${err.message}]`);
            throw err;
        });
    };

    // ========== 拦截 XHR ==========
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const url = this._url;
        if (!shouldLog(url)) return originalSend.apply(this, arguments);

        const startTime = Date.now();
        const apiName = getApiName(url);
        const startStr = formatTime(startTime);

        this.addEventListener('loadend', () => {
            const endTime = Date.now();
            const endStr = formatTime(endTime);
            let bodyText;
            try {
                // 优先用 responseText，如果是 JSON 则原样输出
                bodyText = this.responseText;
            } catch {
                bodyText = '[无法读取]';
            }
            handleCompletedLog(apiName, startStr, endStr, bodyText);
        });

        return originalSend.apply(this, arguments);
    };

    // 页面关闭前，把最后没来得及输出的 repeat 刷出来
    window.addEventListener('beforeunload', flushRepeat);

    console.log('[接口链路记录器] 已启动。请查看控制台输出。');
})();