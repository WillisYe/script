// ==UserScript==
// @name         API请求链路记录器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  记录页面所有API请求链路，输出格式化的start/end日志，支持轮询请求自动合并
// @author       Assistant
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置项 ====================
    const CONFIG = {
        // 是否只记录包含API关键字的请求（设为false则记录所有请求）
        onlyApi: true,
        apiKeywords: ['api', '/v1/', '/v2/', '/v3/', '/rest/', '/service/'],
        // 轮询合并阈值：相同URL+相同请求体+相同响应体，超过此次数才合并显示
        pollMergeThreshold: 10,
        // 时间格式：是否显示毫秒
        showMilliseconds: true,
        // 输出到控制台
        logToConsole: true,
        // 是否在页面右下角显示悬浮面板
        showPanel: true,
        // 响应体最大记录长度（超过截断）
        maxResponseLength: 2000,
    };

    // ==================== 核心逻辑 ====================

    /**
     * 生成格式化的时间戳
     * 格式：YYYYMMDDHHmm.sss
     */
    function formatTimestamp(date) {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${Y}${M}${D}${h}${m}.${s}${ms}`;
    }

    /**
     * 从URL中提取API标识（去掉域名和查询参数，保留路径）
     */
    function getApiIdentifier(url) {
        try {
            const u = new URL(url, window.location.href);
            return u.pathname + u.search;
        } catch (e) {
            return url;
        }
    }

    /**
     * 判断是否为API请求
     */
    function isApiRequest(url) {
        if (!CONFIG.onlyApi) return true;
        const lower = url.toLowerCase();
        return CONFIG.apiKeywords.some(kw => lower.includes(kw.toLowerCase()));
    }

    /**
     * 截断响应内容
     */
    function truncateResponse(text) {
        if (!text) return '';
        if (text.length > CONFIG.maxResponseLength) {
            return text.substring(0, CONFIG.maxResponseLength) + '...[truncated]';
        }
        return text;
    }

    /**
     * 生成日志条目
     */
    function createLogEntry(apiName, event, timestamp, extra) {
        let line = `${apiName} ${event} ${timestamp}`;
        if (extra) {
            line += ` ${extra}`;
        }
        return line;
    }

    // ==================== 轮询合并管理 ====================
    const pollTracker = new Map();
    // key: apiIdentifier + requestBody
    // value: { count, lastResponse, firstTime }

    function tryMergeLog(apiName, requestBody, responseBody) {
        const key = apiName + '|' + (requestBody || '');
        const now = new Date();

        if (pollTracker.has(key)) {
            const tracker = pollTracker.get(key);
            // 检查响应是否相同
            if (tracker.lastResponse === responseBody) {
                tracker.count++;
                tracker.lastTime = now;

                // 达到阈值时输出合并日志
                if (tracker.count === CONFIG.pollMergeThreshold) {
                    outputLog(`${apiName} repeat ${tracker.count} (接口轮询，请求值相同且返回值相同的情况下合并记录，只记录次数)`);
                } else if (tracker.count > CONFIG.pollMergeThreshold) {
                    // 超过阈值后不再重复输出，等响应变化时再输出汇总
                }
                return true; // 已合并
            } else {
                // 响应不同，输出之前的合并汇总（如果有的话），然后重置
                if (tracker.count >= CONFIG.pollMergeThreshold) {
                    outputLog(`${apiName} repeat ${tracker.count} (接口轮询，这${tracker.count}条请求值或者返回值和之前不同，所以没和之前合并)`);
                }
                pollTracker.set(key, {
                    count: 1,
                    lastResponse: responseBody,
                    firstTime: now,
                    lastTime: now,
                });
                return false; // 不合并
            }
        } else {
            pollTracker.set(key, {
                count: 1,
                lastResponse: responseBody,
                firstTime: now,
                lastTime: now,
            });
            return false; // 首次请求，不合并
        }
    }

    // ==================== 输出管理 ====================
    const logBuffer = [];

    function outputLog(line) {
        logBuffer.push(line);
        if (CONFIG.logToConsole) {
            console.log('%c[API链路]%c ' + line, 'color:#00ff88;font-weight:bold', 'color:inherit');
        }
        if (CONFIG.showPanel && panelEl) {
            appendToPanel(line);
        }
    }

    // ==================== XHR Hook ====================
    const originalXHR = window.XMLHttpRequest;
    const originalOpen = originalXHR.prototype.open;
    const originalSend = originalXHR.prototype.send;

    originalXHR.prototype.open = function (method, url, ...rest) {
        this.__apiMethod = method;
        this.__apiUrl = url;
        this.__apiIdentifier = getApiIdentifier(url);
        this.__apiName = this.__apiIdentifier;
        this.__startTime = new Date();
        return originalOpen.call(this, method, url, ...rest);
    };

    originalXHR.prototype.send = function (body) {
        const xhr = this;
        const apiName = xhr.__apiName;
        const url = xhr.__apiUrl;

        if (isApiRequest(url)) {
            const startTime = formatTimestamp(xhr.__startTime);
            outputLog(createLogEntry(apiName, 'start', startTime));

            xhr.addEventListener('loadend', function () {
                const endTime = formatTimestamp(new Date());
                let responseText = '';
                try {
                    responseText = xhr.responseText || '';
                } catch (e) {
                    responseText = '';
                }
                const truncated = truncateResponse(responseText);

                // 尝试合并轮询
                const requestBody = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
                const merged = tryMergeLog(apiName, requestBody, responseText);

                if (!merged) {
                    outputLog(createLogEntry(apiName, 'end', endTime, truncated + ' (接口返回值)'));
                }
            });
        }

        return originalSend.call(this, body);
    };

    // ==================== Fetch Hook ====================
    const originalFetch = window.fetch;

    window.fetch = function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) ? args[0].url : String(args[0]);
        const options = args[1] || {};
        const method = options.method || 'GET';
        const body = options.body || null;

        const apiIdentifier = getApiIdentifier(url);
        const apiName = apiIdentifier;
        const startTime = new Date();

        if (isApiRequest(url)) {
            outputLog(createLogEntry(apiName, 'start', formatTimestamp(startTime)));

            return originalFetch.apply(this, args).then(async (response) => {
                const endTime = formatTimestamp(new Date());

                // 克隆响应以避免消耗body
                let responseText = '';
                try {
                    const cloned = response.clone();
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('json')) {
                        const json = await cloned.json();
                        responseText = JSON.stringify(json);
                    } else {
                        responseText = await cloned.text();
                    }
                } catch (e) {
                    responseText = '';
                }

                const truncated = truncateResponse(responseText);
                const requestBody = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
                const merged = tryMergeLog(apiName, requestBody, responseText);

                if (!merged) {
                    outputLog(createLogEntry(apiName, 'end', endTime, truncated + ' (接口返回值)'));
                }

                return response;
            }).catch((err) => {
                const endTime = formatTimestamp(new Date());
                outputLog(createLogEntry(apiName, 'error', endTime, String(err)));
                throw err;
            });
        }

        return originalFetch.apply(this, args);
    };

    // ==================== 悬浮面板 ====================
    let panelEl = null;
    let panelBody = null;

    function initPanel() {
        panelEl = document.createElement('div');
        panelEl.id = '__api_chain_logger_panel__';
        panelEl.innerHTML = `
            <style>
                #__api_chain_logger_panel__ {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    width: 600px;
                    max-height: 400px;
                    background: #1e1e1e;
                    color: #d4d4d4;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 11px;
                    border: 1px solid #444;
                    border-radius: 6px;
                    z-index: 999999;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                #__api_chain_logger_panel__ .panel-header {
                    background: #2d2d2d;
                    padding: 6px 10px;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #444;
                    user-select: none;
                }
                #__api_chain_logger_panel__ .panel-header .title {
                    color: #00ff88;
                    font-weight: bold;
                    font-size: 12px;
                }
                #__api_chain_logger_panel__ .panel-header .controls button {
                    background: #444;
                    color: #ddd;
                    border: none;
                    padding: 2px 8px;
                    margin-left: 4px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                }
                #__api_chain_logger_panel__ .panel-header .controls button:hover {
                    background: #555;
                }
                #__api_chain_logger_panel__ .panel-body {
                    padding: 8px 10px;
                    overflow-y: auto;
                    max-height: 350px;
                    line-height: 1.6;
                }
                #__api_chain_logger_panel__ .panel-body .log-line {
                    word-break: break-all;
                    white-space: pre-wrap;
                    margin-bottom: 2px;
                    padding: 1px 0;
                }
                #__api_chain_logger_panel__ .panel-body .log-line.api-start {
                    color: #4fc3f7;
                }
                #__api_chain_logger_panel__ .panel-body .log-line.api-end {
                    color: #a5d6a7;
                }
                #__api_chain_logger_panel__ .panel-body .log-line.api-repeat {
                    color: #ffd54f;
                }
                #__api_chain_logger_panel__ .panel-body .log-line.api-error {
                    color: #ef5350;
                }
            </style>
            <div class="panel-header">
                <span class="title">📡 API请求链路记录</span>
                <span class="controls">
                    <button id="__api_panel_clear__">清空</button>
                    <button id="__api_panel_copy__">复制</button>
                    <button id="__api_panel_download__">下载</button>
                    <button id="__api_panel_toggle__">折叠</button>
                </span>
            </div>
            <div class="panel-body"></div>
        `;
        document.documentElement.appendChild(panelEl);

        panelBody = panelEl.querySelector('.panel-body');

        // 清空
        panelEl.querySelector('#__api_panel_clear__').addEventListener('click', () => {
            logBuffer.length = 0;
            panelBody.innerHTML = '';
            pollTracker.clear();
        });

        // 复制
        panelEl.querySelector('#__api_panel_copy__').addEventListener('click', () => {
            const text = logBuffer.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                alert('已复制到剪贴板');
            }).catch(() => {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                alert('已复制到剪贴板');
            });
        });

        // 下载
        panelEl.querySelector('#__api_panel_download__').addEventListener('click', () => {
            const text = logBuffer.join('\n');
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `api-chain-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
            a.click();
            URL.revokeObjectURL(a.href);
        });

        // 折叠/展开
        let collapsed = false;
        panelEl.querySelector('#__api_panel_toggle__').addEventListener('click', () => {
            collapsed = !collapsed;
            panelBody.style.display = collapsed ? 'none' : 'block';
            panelEl.querySelector('#__api_panel_toggle__').textContent = collapsed ? '展开' : '折叠';
        });

        // 拖拽
        makeDraggable(panelEl, panelEl.querySelector('.panel-header'));
    }

    function appendToPanel(line) {
        if (!panelBody) return;
        const div = document.createElement('div');
        div.className = 'log-line';
        if (line.includes(' start ')) div.classList.add('api-start');
        else if (line.includes(' end ')) div.classList.add('api-end');
        else if (line.includes(' repeat ')) div.classList.add('api-repeat');
        else if (line.includes(' error ')) div.classList.add('api-error');
        div.textContent = line;
        panelBody.appendChild(div);
        // 自动滚动到底部
        panelBody.scrollTop = panelBody.scrollHeight;
        // 限制面板内显示的行数，防止DOM过多
        while (panelBody.children.length > 1000) {
            panelBody.removeChild(panelBody.firstChild);
        }
    }

    function makeDraggable(element, handle) {
        let isDragging = false;
        let offsetX, offsetY;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            element.style.left = (e.clientX - offsetX) + 'px';
            element.style.top = (e.clientY - offsetY) + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // ==================== 初始化 ====================
    function init() {
        if (CONFIG.showPanel) {
            // 等待DOM就绪后创建面板
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initPanel);
            } else {
                initPanel();
            }
        }

        console.log('%c[API链路记录器]%c 已启动，正在监听API请求...', 'color:#00ff88;font-weight:bold;font-size:14px', 'color:inherit');
    }

    init();

})();
