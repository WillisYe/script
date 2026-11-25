// ==UserScript==
// @name         API Request Trace Logger
// @namespace    https://github.com/
// @version      0.3.0
// @description  点击开关记录前端接口请求链路，监听状态刷新后保持
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const TRACE_PANEL_ID = 'api-trace-panel';
  const REPEAT_WINDOW_MS = 220;
  const LISTENING_STORAGE_KEY = 'api-request-trace-logger:listening';
  const SITE_SWITCH_KEY = 'api-request-trace:site-enabled';
  const pageWindow = unsafeWindow;
  const isTopFrame = pageWindow === pageWindow.top;

  function getSiteKey() {
    try {
      return pageWindow.top.location.hostname;
    } catch (e) {
      return pageWindow.location.hostname;
    }
  }

  function isSiteEnabled() {
    const map = GM_getValue(SITE_SWITCH_KEY, {}) || {};
    return map[getSiteKey()] === true;
  }

  function toggleCurrentSite() {
    const map = GM_getValue(SITE_SWITCH_KEY, {}) || {};
    map[getSiteKey()] = !isSiteEnabled();
    GM_setValue(SITE_SWITCH_KEY, map);
    pageWindow.location.reload();
  }

  if (isTopFrame) {
    GM_registerMenuCommand(
      isSiteEnabled() ? '在当前站点禁用 API Trace' : '在当前站点启用 API Trace',
      toggleCurrentSite
    );
  }

  let logCounter = 0;
  let repeatState = null;
  let repeatTimer = null;
  let dragState = null;
  let suppressTitleClick = false;

  function readListeningState() {
    try {
      return pageWindow.localStorage.getItem(LISTENING_STORAGE_KEY) === 'true';
    } catch (error) {
      console.warn('API Trace: failed to read listening state', error);
      return false;
    }
  }

  function persistListeningState(listening) {
    try {
      pageWindow.localStorage.setItem(LISTENING_STORAGE_KEY, String(listening));
    } catch (error) {
      console.warn('API Trace: failed to save listening state', error);
    }
  }

  const state = {
    collapsed: true,
    listening: readListeningState(),
    listeningEpoch: 0,
    opacity: 0.9,
    apiFilter: [],
    timeStart: '',
    timeEnd: '',
    logs: [],
    apiOptions: [],
    timeOptions: [],
  };

  function nowStamp() {
    const d = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ms}`;
  }

  function formatStampToSecond(stamp) {
    if (!stamp) return '';
    return String(stamp).replace(/\.\d+$/, '').trim();
  }

  function safeParseJson(text) {
    if (typeof text !== 'string' || !text.trim()) return text;
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  function stringifyValue(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  function normalizeRequestBody(body) {
    if (body === undefined || body === null || body === '') return '';
    if (typeof body === 'string') return body;
    if (body instanceof FormData) return '[FormData]';
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof Blob) return `[Blob:${body.type || 'unknown'}]`;
    if (typeof body === 'object') {
      try {
        return JSON.stringify(body);
      } catch (e) {
        return String(body);
      }
    }
    return String(body);
  }

  function getApiName(url, method = 'GET') {
    try {
      const absoluteUrl = new URL(url, pageWindow.location.href);
      const sections = absoluteUrl.pathname.split('/').filter(Boolean);
      const name = sections.length ? sections[sections.length - 1] : 'root';
      return `${name || 'root'}:${method.toUpperCase()}`;
    } catch (e) {
      return `${(method || 'GET').toUpperCase()}-request`;
    }
  }

  function parseStampToMs(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;

    if (/^\d{14}(?:\.\d{1,3})?$/.test(text)) {
      const secondText = text.replace(/\.\d+$/, '');
      const millisText = text.includes('.') ? text.split('.')[1].padEnd(3, '0').slice(0, 3) : '000';
      const year = Number(secondText.slice(0, 4));
      const month = Number(secondText.slice(4, 6));
      const day = Number(secondText.slice(6, 8));
      const hour = Number(secondText.slice(8, 10));
      const minute = Number(secondText.slice(10, 12));
      const second = Number(secondText.slice(12, 14));
      const ms = Number(millisText);
      return Date.UTC(year, month - 1, day, hour, minute, second, ms);
    }

    const asDate = new Date(text.replace(' ', 'T'));
    if (!Number.isNaN(asDate.getTime())) return asDate.getTime();
    return null;
  }

  function createEntry({ type, name, stamp, requestText = '', responseText = '', count = 1 }) {
    return {
      id: ++logCounter,
      type,
      name,
      stamp,
      requestText,
      responseText,
      count,
      timeMs: parseStampToMs(stamp) ?? Date.now(),
    };
  }

  function collectFilterOptions() {
    const apiSet = new Set();
    const timeSet = new Set();

    for (const entry of state.logs) {
      apiSet.add(entry.name);
      if (entry.stamp) timeSet.add(formatStampToSecond(entry.stamp));
    }

    state.apiOptions = ['全部', ...Array.from(apiSet).sort()];
    state.timeOptions = ['全部', ...Array.from(timeSet).sort()];

    state.apiFilter = state.apiFilter.filter((item) => item !== '全部' && apiSet.has(item));
    if (state.timeStart && !timeSet.has(state.timeStart)) {
      state.timeStart = '全部';
    }
    if (state.timeEnd && !timeSet.has(state.timeEnd)) {
      state.timeEnd = '全部';
    }
    if (!state.timeStart) state.timeStart = '全部';
    if (!state.timeEnd) state.timeEnd = '全部';
  }

  function matchesFilter(entry) {
    const apiFilters = state.apiFilter;
    const startVal = state.timeStart;
    const endVal = state.timeEnd;

    if (apiFilters.length && !apiFilters.some((item) => entry.name.includes(item))) {
      return false;
    }

    if (startVal && startVal !== '全部') {
      const startMs = parseStampToMs(startVal);
      if (startMs !== null && entry.timeMs < startMs) return false;
    }

    if (endVal && endVal !== '全部') {
      const endMs = parseStampToMs(endVal);
      if (endMs !== null && entry.timeMs > endMs) return false;
    }

    return true;
  }

  function getVisibleLogs() {
    return state.logs.filter(matchesFilter);
  }

  function formatLogEntry(entry) {
    if (entry.type === 'repeat') return `${entry.name} repeat ${entry.count}`;
    if (entry.type === 'start') {
      return `${entry.name} start ${entry.stamp}${entry.requestText ? ` ${entry.requestText}` : ''}`;
    }
    return `${entry.name} end ${entry.stamp}${entry.responseText ? ` ${entry.responseText}` : ''}`;
  }

  function buildVisibleText() {
    return getVisibleLogs().map(formatLogEntry).join('\n') || '暂无日志';
  }

  function copyVisibleLogs() {
    const text = buildVisibleText();
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        console.log('API Trace: copied filtered logs');
      } catch (e) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.warn('API Trace: copy failed', err);
        }
        document.body.removeChild(textarea);
      }
    };

    copy();
  }

  function bindDrag(panel, header) {
    header.onmousedown = function (event) {
      if (event.target.closest('button') || event.target.closest('select')) return;
      suppressTitleClick = false;
      const rect = panel.getBoundingClientRect();
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false,
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    function onMove(moveEvent) {
      if (!dragState) return;
      if (Math.abs(moveEvent.clientX - dragState.startX) > 3 || Math.abs(moveEvent.clientY - dragState.startY) > 3) {
        dragState.moved = true;
      }
      const nextLeft = Math.max(8, dragState.left + (moveEvent.clientX - dragState.startX));
      const nextTop = Math.max(8, dragState.top + (moveEvent.clientY - dragState.startY));
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      panel.style.right = 'auto';
      updatePanelHorizontalAnchor(panel);
      clampPanelToViewport(panel);
    }

    function onUp() {
      suppressTitleClick = dragState && dragState.moved;
      dragState = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function updatePanelHorizontalAnchor(panel) {
    const rect = panel.getBoundingClientRect();
    const leftGap = Math.max(8, rect.left);
    const rightGap = Math.max(8, pageWindow.innerWidth - rect.right);
    if (leftGap <= rightGap) {
      panel.__apiTraceHorizontalAnchor = 'left';
      panel.__apiTraceHorizontalOffset = leftGap;
    } else {
      panel.__apiTraceHorizontalAnchor = 'right';
      panel.__apiTraceHorizontalOffset = rightGap;
    }
  }

  function clampPanelToViewport(panel) {
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, pageWindow.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, pageWindow.innerHeight - rect.height - margin);
    const offset = panel.__apiTraceHorizontalOffset ?? margin;
    const desiredLeft = panel.__apiTraceHorizontalAnchor === 'right'
      ? pageWindow.innerWidth - rect.width - offset
      : offset;
    panel.style.left = `${Math.min(Math.max(desiredLeft, margin), maxLeft)}px`;
    panel.style.top = `${Math.min(Math.max(rect.top, margin), maxTop)}px`;
    panel.style.right = 'auto';
  }

  function createIconButton(label, path) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.style.cssText = 'display:flex; align-items:center; justify-content:center; width:26px; height:26px; padding:4px; border:none; border-radius:6px; color:#fff; cursor:pointer;';
    setButtonIcon(button, path);
    return button;
  }

  function setButtonIcon(button, path) {
    button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
  }

  function ensurePanel() {
    if (!isTopFrame || !isSiteEnabled()) return null;

    let panel = document.getElementById(TRACE_PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = TRACE_PANEL_ID;
    panel.__apiTraceHorizontalAnchor = 'right';
    panel.__apiTraceHorizontalOffset = 12;
    panel.style.cssText = [
      'position: fixed',
      'right: 12px',
      'top: 12px',
      'width: 300px',
      'max-width: calc(100vw - 16px)',
      'display: flex',
      'flex-direction: column',
      'max-height: calc(100vh - 24px)',
      'z-index: 2147483647',
      'background: rgba(15, 23, 42, 0.58)',
      'opacity: 0.9',
      'backdrop-filter: blur(8px)',
      'color: #e2e8f0',
      'border: 1px solid rgba(148, 163, 184, 0.25)',
      'border-radius: 10px',
      'box-shadow: 0 10px 24px rgba(0,0,0,0.2)',
      'font: 12px/1.5 Consolas, Monaco, monospace',
      'overflow: hidden',
      'user-select: none',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:flex-start; padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.18); background: rgba(30,41,59,0.32); cursor: move;';

    const title = document.createElement('div');
    title.textContent = 'API Trace';
    title.setAttribute('role', 'button');
    title.tabIndex = 0;
    title.setAttribute('aria-label', '展开或收起面板');
    title.style.cssText = 'font-weight:700; color:#bfdbfe; cursor:pointer; margin-right:8px;';

    const toggleCollapsed = () => {
      state.collapsed = !state.collapsed;
      render();
    };
    title.onclick = () => {
      if (suppressTitleClick) {
        suppressTitleClick = false;
        return;
      }
      toggleCollapsed();
    };
    title.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleCollapsed();
      }
    };

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; gap:6px; align-items:center;flex-grow:1;justify-content: flex-end;';

    const collapseBtn = createIconButton('收起面板', 'm6 9 6 6 6-6');
    collapseBtn.style.background = 'rgba(37,99,235,0.8)';
    collapseBtn.onclick = toggleCollapsed;

    const listeningBtn = createIconButton('开始监听', 'm8 5 11 7-11 7z');
    listeningBtn.onclick = () => {
      state.listening = !state.listening;
      state.listeningEpoch += 1;
      persistListeningState(state.listening);
      if (!state.listening) flushRepeatState();
      render();
    };

    const copyBtn = createIconButton('复制当前筛选结果', 'M8 8h10v12H8z M6 16H5V4h10v2');
    copyBtn.style.background = 'rgba(16,185,129,0.8)';
    copyBtn.onclick = copyVisibleLogs;

    const clearBtn = createIconButton('清空日志', 'M3 6h18 M8 6V4h8v2m3 0-1 14H6L5 6m4 4v7m6-7v7');
    clearBtn.style.background = 'rgba(55,65,81,0.8)';
    clearBtn.onclick = () => {
      state.logs = [];
      logCounter = 0;
      collectFilterOptions();
      render();
    };

    controls.appendChild(listeningBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(clearBtn);
    controls.appendChild(collapseBtn);
    header.appendChild(title);
    header.appendChild(controls);
    panel.appendChild(header);

    const filterWrap = document.createElement('div');
    filterWrap.style.cssText = 'padding:8px 10px 6px; display:flex; flex-direction:column; gap:6px; flex-shrink:0; max-height:60vh; overflow-y:auto; background: rgba(15,23,42,0.2);';

    const apiRow = document.createElement('div');
    apiRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const apiLabel = document.createElement('span');
    apiLabel.textContent = '接口:';
    apiLabel.style.cssText = 'width:32px; color:#cbd5e1;flex-shrink:0;';
    const apiSelect = document.createElement('select');
    apiSelect.multiple = true;
    apiSelect.title = '按住 Ctrl/Cmd 可多选接口；不选或选择“全部”表示不过滤';
    apiSelect.style.cssText = 'flex:1; border:1px solid rgba(148,163,184,0.25); background:rgba(15,23,42,0.7); color:#e2e8f0; border-radius:6px; padding:2px 4px; width:0; height:auto;';
    apiSelect.onchange = (event) => {
      state.apiFilter = Array.from(event.target.selectedOptions)
        .map((option) => option.value)
        .filter((value) => value !== '全部');
      render();
    };

    const timeRow = document.createElement('div');
    timeRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const startLabel = document.createElement('span');
    startLabel.textContent = '从:';
    startLabel.style.cssText = 'width:32px; color:#cbd5e1;flex-shrink:0;';
    const startSelect = document.createElement('select');
    startSelect.style.cssText = 'flex:1; border:1px solid rgba(148,163,184,0.25); background:rgba(15,23,42,0.7); color:#e2e8f0; border-radius:6px; padding:4px 6px;width:0;height:28px;';
    startSelect.onchange = (event) => {
      state.timeStart = event.target.value;
      render();
    };

    const endLabel = document.createElement('span');
    endLabel.textContent = '到:';
    endLabel.style.cssText = 'width:24px; color:#cbd5e1;';
    const endSelect = document.createElement('select');
    endSelect.style.cssText = 'flex:1; border:1px solid rgba(148,163,184,0.25); background:rgba(15,23,42,0.7); color:#e2e8f0; border-radius:6px; padding:4px 6px;width:0;height:28px;';
    endSelect.onchange = (event) => {
      state.timeEnd = event.target.value;
      render();
    };

    const opacityRow = document.createElement('div');
    opacityRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = '透明度:';
    opacityLabel.style.cssText = 'width:48px; color:#cbd5e1;';
    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '50';
    opacityInput.max = '100';
    opacityInput.step = '5';
    opacityInput.value = String(Math.round(state.opacity * 100));
    opacityInput.style.cssText = 'flex:1; min-width:0; accent-color:#60a5fa;';
    const opacityValue = document.createElement('span');
    opacityValue.style.cssText = 'width:34px; color:#cbd5e1; text-align:right;';
    opacityInput.oninput = () => {
      state.opacity = Number(opacityInput.value) / 100;
      opacityValue.textContent = `${opacityInput.value}%`;
      panel.style.opacity = String(state.opacity);
    };

    apiRow.appendChild(apiLabel);
    apiRow.appendChild(apiSelect);
    timeRow.appendChild(startLabel);
    timeRow.appendChild(startSelect);
    timeRow.appendChild(endLabel);
    timeRow.appendChild(endSelect);
    opacityRow.appendChild(opacityLabel);
    opacityRow.appendChild(opacityInput);
    opacityRow.appendChild(opacityValue);
    filterWrap.appendChild(apiRow);
    filterWrap.appendChild(timeRow);
    filterWrap.appendChild(opacityRow);
    panel.appendChild(filterWrap);

    const listWrap = document.createElement('div');
    listWrap.className = 'log-list';
    listWrap.style.cssText = 'padding:8px 10px 10px; flex:1 1 auto; min-height:0; overflow:auto; white-space:pre-wrap;';
    panel.appendChild(listWrap);

    bindDrag(panel, header);
    document.documentElement.appendChild(panel);

    panel.__apiFilterSelect = apiSelect;
    panel.__startSelect = startSelect;
    panel.__endSelect = endSelect;
    panel.__opacityInput = opacityInput;
    panel.__opacityValue = opacityValue;
    panel.__collapseButton = collapseBtn;
    panel.__listeningButton = listeningBtn;

    return panel;
  }

  function render() {
    if (!isTopFrame) return;

    const panel = ensurePanel();
    if (!panel) return;
    const header = panel.children[0];
    const controls = header.children[1];
    const filterWrap = panel.children[1];
    const listWrap = panel.querySelector('.log-list');
    const apiSelect = panel.__apiFilterSelect;
    const startSelect = panel.__startSelect;
    const endSelect = panel.__endSelect;
    const opacityInput = panel.__opacityInput;
    const opacityValue = panel.__opacityValue;
    const collapseBtn = panel.__collapseButton;
    const listeningBtn = panel.__listeningButton;

    collectFilterOptions();

    const collapsed = state.collapsed;
    const visibleLogs = getVisibleLogs();
    filterWrap.style.display = collapsed ? 'none' : 'flex';
    listWrap.style.display = collapsed ? 'none' : 'block';
    panel.style.width = collapsed ? 'auto' : '360px';
    header.style.flexDirection = 'row';
    header.style.alignItems = 'center';
    header.style.gap = '0';
    collapseBtn.title = collapsed ? '展开面板' : '收起面板';
    collapseBtn.setAttribute('aria-label', collapseBtn.title);
    setButtonIcon(collapseBtn, collapsed ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6');
    for (const button of Array.from(controls.children).slice(0, -1)) {
      button.style.display = collapsed ? 'none' : 'flex';
    }
    header.children[0].setAttribute('aria-expanded', String(!collapsed));

    panel.style.opacity = String(state.opacity);
    opacityInput.value = String(Math.round(state.opacity * 100));
    opacityValue.textContent = `${opacityInput.value}%`;
    clampPanelToViewport(panel);

    const listeningLabel = state.listening ? '停止监听' : '开始监听';
    listeningBtn.title = listeningLabel;
    listeningBtn.setAttribute('aria-label', listeningLabel);
    listeningBtn.style.background = state.listening ? 'rgba(239,68,68,0.8)' : 'rgba(37,99,235,0.8)';
    setButtonIcon(listeningBtn, state.listening ? 'M7 7h10v10H7z' : 'm8 5 11 7-11 7z');

    for (const [select, options, value] of [
      [apiSelect, state.apiOptions, state.apiFilter],
      [startSelect, state.timeOptions, state.timeStart],
      [endSelect, state.timeOptions, state.timeEnd],
    ]) {
      select.innerHTML = '';
      const selectedValues = new Set(
        select.multiple
          ? (Array.isArray(value) && value.length ? value : ['全部'])
          : [value]
      );
      for (const item of options) {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        option.selected = selectedValues.has(item);
        select.appendChild(option);
      }
      if (select.multiple) select.size = Math.max(options.length, 1);
      if (!select.multiple && !options.includes(value)) select.value = '全部';
    }

    listWrap.innerHTML = '';

    if (!visibleLogs.length) {
      const empty = document.createElement('div');
      empty.textContent = '暂无日志';
      empty.style.cssText = 'color:#94a3b8; padding:8px 0;';
      listWrap.appendChild(empty);
    } else {
      for (const entry of visibleLogs) {
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom:6px; padding:4px 6px; border-radius:6px; background: rgba(30,41,59,0.4); color:#e2e8f0; word-break:break-all;';
        const line = document.createElement('div');
        line.style.cssText = 'white-space:pre-wrap; color:#f8fafc;';
        line.textContent = formatLogEntry(entry);
        row.appendChild(line);
        listWrap.appendChild(row);
      }
    }
    clampPanelToViewport(panel);
  }

  function flushRepeatState() {
    if (!repeatState) return;

    const { name, count, lastStamp } = repeatState;
    if (count > 1) {
      state.logs.push(createEntry({ type: 'repeat', name, stamp: lastStamp, count }));
    }

    repeatState = null;
    if (repeatTimer) {
      clearTimeout(repeatTimer);
      repeatTimer = null;
    }
    render();
  }

  function scheduleRepeatFlush() {
    if (repeatTimer) clearTimeout(repeatTimer);
    repeatTimer = setTimeout(() => {
      flushRepeatState();
    }, REPEAT_WINDOW_MS);
  }

  function appendStartAndEnd({ name, requestText, responseText, startStamp, endStamp }) {
    state.logs.push(createEntry({ type: 'start', name, stamp: startStamp, requestText }));
    state.logs.push(createEntry({ type: 'end', name, stamp: endStamp, responseText }));
    render();
  }

  function handleCompletedCall({ name, requestText, responseText, startStamp, endStamp }) {
    const key = JSON.stringify({ name, requestText: requestText || '', responseText: responseText || '' });

    if (repeatState && repeatState.name === name && repeatState.key === key) {
      repeatState.count += 1;
      repeatState.lastStamp = endStamp;
      scheduleRepeatFlush();
      return;
    }

    if (repeatState) {
      flushRepeatState();
    }

    repeatState = {
      name,
      key,
      count: 1,
      lastStamp: endStamp,
      requestText,
      responseText,
    };

    appendStartAndEnd({ name, requestText, responseText, startStamp, endStamp });
    scheduleRepeatFlush();
  }

  async function readResponseText(response) {
    if (!response || typeof response.clone !== 'function') return '';
    try {
      const text = await response.clone().text();
      return text ? stringifyValue(safeParseJson(text)) : '';
    } catch (e) {
      return '';
    }
  }

  function patchFetch() {
    const originalFetch = pageWindow.fetch.bind(pageWindow);
    pageWindow.fetch = async function patchedFetch(input, init) {
      if (!state.listening) return originalFetch(input, init);

      const listeningEpoch = state.listeningEpoch;
      const rawUrl = typeof input === 'string' ? input : (input && input.url) || String(input || '');
      const method = (init && init.method) || (input && input.method) || 'GET';
      const name = getApiName(rawUrl, method);
      const requestText = normalizeRequestBody(init && init.body ? init.body : '');
      const startStamp = nowStamp();

      try {
        const response = await originalFetch(input, init);
        const responseText = await readResponseText(response);
        const endStamp = nowStamp();
        if (state.listening && state.listeningEpoch === listeningEpoch) {
          handleCompletedCall({ name, requestText, responseText, startStamp, endStamp });
        }
        return response;
      } catch (error) {
        const endStamp = nowStamp();
        const message = error && error.message ? error.message : String(error);
        if (state.listening && state.listeningEpoch === listeningEpoch) {
          handleCompletedCall({
            name,
            requestText,
            responseText: `error:${message}`,
            startStamp,
            endStamp,
          });
        }
        throw error;
      }
    };
  }

  function patchXHR() {
    const XMLHttpRequestProto = pageWindow.XMLHttpRequest && pageWindow.XMLHttpRequest.prototype;
    if (!XMLHttpRequestProto) return;

    const originalOpen = XMLHttpRequestProto.open;
    const originalSend = XMLHttpRequestProto.send;

    XMLHttpRequestProto.open = function (method, url, async, user, password) {
      this.__apiTraceInfo = {
        name: getApiName(url || '', method || 'GET'),
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequestProto.send = function (body) {
      if (!state.listening) return originalSend.apply(this, arguments);

      const listeningEpoch = state.listeningEpoch;
      const requestText = normalizeRequestBody(body);
      const startStamp = nowStamp();
      const apiName = this.__apiTraceInfo?.name || 'xhr-request';

      const onReadyState = this.onreadystatechange;
      this.onreadystatechange = function () {
        if (state.listening && state.listeningEpoch === listeningEpoch && this.readyState === 4) {
          let responseText = '';
          try {
            responseText = this.responseText || '';
          } catch (e) {}
          responseText = stringifyValue(safeParseJson(responseText));
          const endStamp = nowStamp();
          handleCompletedCall({ name: apiName, requestText, responseText, startStamp, endStamp });
        }
        if (onReadyState) return onReadyState.apply(this, arguments);
      };

      return originalSend.apply(this, arguments);
    };
  }

  function install() {
    if (!isSiteEnabled()) return;

    patchFetch();
    patchXHR();
    state.apiFilter = [];
    state.timeStart = '全部';
    state.timeEnd = '全部';
    if (isTopFrame) {
      const panel = ensurePanel();
      render();
      pageWindow.addEventListener('resize', () => clampPanelToViewport(panel));
    }

    pageWindow.addEventListener('beforeunload', () => {
      flushRepeatState();
    });
  }

  install();
})();
