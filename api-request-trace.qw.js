// ==UserScript==
// @name         API 链路日志 + 轮询合并
// @namespace    https://example.com
// @version      0.1.0
// @description  记录接口请求链路，连续相同请求合并为 repeat N
// @match        *://*/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // 如果只想拦截特定域名，可改成 /\/api\// 之类的正则
  const API_FILTER = null; // 例如：/\/api\//
  const REPEAT_WINDOW_MS = 3000; // 连续相同请求在多少毫秒内算轮询
  const MAX_REPEAT_DISPLAY = 999;

  const target = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  function shouldLog(url) {
    if (!API_FILTER) return true;
    return API_FILTER.test(url);
  }

  function getApiName(url) {
    try {
      const u = new URL(url, location.href);
      const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
      return parts[parts.length - 1] || u.pathname || 'unknown';
    } catch {
      return url || 'unknown';
    }
  }

  function formatTime() {
    const d = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const ms = pad(d.getMilliseconds(), 3);
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds()) +
      '.' +
      ms
    );
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function log(line) {
    if (typeof GM_log === 'function') {
      GM_log(line);
    }
    console.log('[API-TRACE]', line);
  }

  const pending = new Map();
  const repeatGroups = new Map();

  function makeRepeatKey(apiName, reqBody, respText) {
    return apiName + '||' + (reqBody || '') + '||' + (respText || '');
  }

  function flushRepeat(key) {
    const g = repeatGroups.get(key);
    if (!g) return;
    const count = Math.min(g.count, MAX_REPEAT_DISPLAY);
    log(g.apiName + ' repeat ' + count);
    repeatGroups.delete(key);
  }

  function tryMergeRepeat(apiName, reqBody, respText) {
    const key = makeRepeatKey(apiName, reqBody, respText);
    const now = Date.now();
    const g = repeatGroups.get(key);

    if (g && now - g.lastTime <= REPEAT_WINDOW_MS) {
      g.count += 1;
      g.lastTime = now;
      return true;
    }

    if (g) {
      flushRepeat(key);
    }

    repeatGroups.set(key, {
      apiName,
      count: 1,
      lastTime: now,
    });
    return false;
  }

  function recordStart(apiName, reqBody) {
    const id = apiName + '_' + Date.now() + '_' + Math.random();
    pending.set(id, { apiName, reqBody });
    log(apiName + ' start ' + formatTime());
    return id;
  }

  function recordEnd(id, respText) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);

    const merged = tryMergeRepeat(p.apiName, p.reqBody, respText);
    if (!merged) {
      log(p.apiName + ' end ' + formatTime() + ' ' + (respText || ''));
    }
  }

  // ---------- fetch ----------
  const originFetch = target.fetch;
  if (typeof originFetch === 'function') {
    target.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
      if (!shouldLog(url)) return originFetch.apply(this, arguments);

      const apiName = getApiName(url);
      let reqBody = '';
      if (init && init.body) {
        reqBody = typeof init.body === 'string' ? init.body : safeJson(init.body);
      }

      const id = recordStart(apiName, reqBody);

      return originFetch.apply(this, arguments).then(async (resp) => {
        const clone = resp.clone();
        let respText = '';
        try {
          respText = await clone.text();
        } catch {}
        recordEnd(id, respText);
        return resp;
      }).catch((err) => {
        recordEnd(id, safeJson({ error: String(err) }));
        throw err;
      });
    };
  }

  // ---------- XMLHttpRequest ----------
  const originOpen = target.XMLHttpRequest.prototype.open;
  const originSend = target.XMLHttpRequest.prototype.send;

  target.XMLHttpRequest.prototype.open = function (method, url) {
    this._apiTraceMethod = method;
    this._apiTraceUrl = url;
    return originOpen.apply(this, arguments);
  };

  target.XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    const url = xhr._apiTraceUrl || '';
    if (!shouldLog(url)) return originSend.apply(xhr, arguments);

    const apiName = getApiName(url);
    const reqBody = typeof body === 'string' ? body : safeJson(body);
    const id = recordStart(apiName, reqBody);

    xhr.addEventListener('load', function () {
      const respText = xhr.responseText || xhr.response || '';
      recordEnd(id, respText);
    });

    xhr.addEventListener('error', function () {
      recordEnd(id, safeJson({ error: 'XHR error' }));
    });

    return originSend.apply(xhr, arguments);
  };

  // 页面卸载前输出未合并的 repeat
  window.addEventListener('beforeunload', function () {
    for (const key of repeatGroups.keys()) {
      flushRepeat(key);
    }
  });
})();