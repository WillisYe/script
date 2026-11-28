// ==UserScript==
// @name         JIRA Bug 一键复制详情 / 编辑弹窗字段精简
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  在 JIRA Issue Navigator 列表页一键复制 Bug 详情；在编辑问题弹窗中仅显示「缺陷状态」
// @match        http://192.168.90.100:8080/*
// @grant        GM_xmlhttpRequest
// @connect      192.168.90.100
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============ 配置 ============
    var CONFIG = {
        // 并发请求数（别太大，避免给 JIRA 施压）
        concurrency: 5,
        // API 基础地址
        apiBase: window.location.origin + '/rest/api/2/issue/',
        // 自定义字段映射
        fields: {
            // 重现步骤
            reproSteps: 'customfield_11104',
            // 预期结果
            expectedResult: 'customfield_11103',
            // 实际结果
            actualResult: 'customfield_11105',
            // 操作系统
            os: 'customfield_11108',
            // 浏览器类型
            browser: 'customfield_11110',
            // 缺陷环境分类
            env: 'customfield_11111',
            // 版本
            version: 'customfield_11112',
            // 缺陷严重等级
            severity: 'customfield_11114',
            // 缺陷跟进解决者
            assignee2: 'customfield_11118',
            // 缺陷状态（自定义）
            bugStatus: 'customfield_11120'
        }
    };

    // 编辑弹窗字段精简：保留「缺陷状态」，复用已有字段映射
    var KEEP_FIELD_ID = CONFIG.fields.bugStatus;
    var KEEP_LABEL = '缺陷状态';
    var JIRA_HIDDEN_ATTRIBUTE = 'data-jira-status-filter-hidden';
    var FILTER_STYLE_ID = 'jira-status-filter-style';

    // ============ 工具函数 ============

    // 从 issue 列表页面提取所有 issue key
    function extractIssueKeys() {
        var keys = [];
        var rows = document.querySelectorAll('#issuetable tbody tr.issuerow');
        rows.forEach(function (row) {
            var key = row.getAttribute('data-issuekey');
            if (key) keys.push(key);
        });
        return keys;
    }

    // 从 API 响应中安全提取文本
    function getValue(obj, path) {
        if (!obj) return '';
        var parts = path.split('.');
        var cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur == null) return '';
            cur = cur[parts[i]];
        }
        return cur || '';
    }

    // 从 multiselect/customfield option 中提取值
    function extractMultiField(val) {
        if (!val) return '';
        if (Array.isArray(val)) {
            return val.map(function (v) {
                return v.value || v.displayName || (typeof v === 'string' ? v : '');
            }).filter(Boolean).join(', ');
        }
        if (typeof val === 'string') return val;
        return val.value || val.displayName || '';
    }

    // 从 user 类型字段中提取名字
    function extractUser(val) {
        if (!val) return '';
        return val.displayName || val.name || '';
    }

    // 用 GM_xmlhttpRequest 请求单个 issue
    function fetchIssue(key) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: CONFIG.apiBase + key,
                onload: function (res) {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch (e) {
                            reject(new Error('JSON 解析失败: ' + key));
                        }
                    } else {
                        reject(new Error('HTTP ' + res.status + ': ' + key));
                    }
                },
                onerror: function (err) {
                    reject(new Error('请求失败: ' + key + ' - ' + err.error));
                }
            });
        });
    }

    // 并发池
    async function concurrentFetch(keys, onProgress) {
        var results = new Array(keys.length);
        var cursor = 0;

        async function worker() {
            while (cursor < keys.length) {
                var idx = cursor++;
                try {
                    results[idx] = await fetchIssue(keys[idx]);
                } catch (e) {
                    results[idx] = { __error: e.message, key: keys[idx] };
                }
                if (onProgress) onProgress(idx + 1, keys.length);
            }
        }

        var workers = [];
        for (var i = 0; i < Math.min(CONFIG.concurrency, keys.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return results;
    }

    // ============ 格式化输出 ============

    function formatIssue(issue, index) {
        if (issue.__error) {
            return '===== Bug ' + index + ': ' + issue.key + ' =====\n' +
                '⚠️ 获取失败: ' + issue.__error + '\n\n';
        }

        var f = issue.fields;
        var cfg = CONFIG.fields;
        var lines = [];

        lines.push('===== Bug ' + index + ': ' + issue.key + ' ' + (f.summary || '') + ' =====');

        // 基本信息
        var status = getValue(f, 'status.name');
        var priority = getValue(f, 'priority.name');
        var severity = extractMultiField(f[cfg.severity]);
        var bugStatus = extractMultiField(f[cfg.bugStatus]);
        if (status) lines.push('状态: ' + status);
        if (bugStatus && bugStatus !== status) lines.push('缺陷状态: ' + bugStatus);
        if (severity) lines.push('严重等级: ' + severity);
        if (priority) lines.push('优先级: ' + priority);

        // 环境信息
        var os = extractMultiField(f[cfg.os]);
        var browser = extractMultiField(f[cfg.browser]);
        var env = extractMultiField(f[cfg.env]);
        var version = extractMultiField(f[cfg.version]);

        var envParts = [];
        if (os) envParts.push('操作系统: ' + os);
        if (browser) envParts.push('浏览器: ' + browser);
        if (env) envParts.push('环境: ' + env);
        if (version) envParts.push('版本: ' + version);
        if (envParts.length) lines.push('环境: ' + envParts.join(' | '));

        // 重现步骤
        var repro = f[cfg.reproSteps];
        if (repro && repro.trim()) {
            lines.push('');
            lines.push('--- 重现步骤 ---');
            lines.push(repro.trim());
        }

        // 预期结果
        var expected = f[cfg.expectedResult];
        if (expected && expected.trim()) {
            lines.push('');
            lines.push('--- 预期结果 ---');
            lines.push(expected.trim());
        }

        // 实际结果
        var actual = f[cfg.actualResult];
        if (actual && actual.trim()) {
            lines.push('');
            lines.push('--- 实际结果 ---');
            lines.push(actual.trim());
        }

        lines.push('');
        return lines.join('\n');
    }

    function formatAllIssues(issues) {
        var parts = [];
        var successCount = 0;
        var failCount = 0;

        issues.forEach(function (issue, i) {
            if (issue && !issue.__error) successCount++;
            else failCount++;
            parts.push(formatIssue(issue, i + 1));
        });

        var prompt =
            '【上下文】\n' +
            '以下是我从 JIRA 中筛选出的、当前需要处理的 Bug 列表，共 ' + issues.length + ' 个。\n\n' +
            '【你的任务】\n' +
            '请你逐个分析这些 Bug，理解问题描述和重现步骤，然后帮我：\n' +
            '1. 理解每个 Bug 的问题本质，定位可能的代码原因\n' +
            '2. 针对每个 Bug 给出修复建议或直接帮我修改代码\n' +
            '3. 修复时注意不要引入新的问题，保持和现有代码风格一致\n' +
            '4. 如果 Bug 描述信息不足，请告诉我还需要什么信息\n' +
            '5. 在.task目录下创建个一个文档，记录bug处理进度\n\n' +
            '【Bug 列表】\n';

        var header = '共 ' + issues.length + ' 个 Bug (成功 ' + successCount + ', 失败 ' + failCount + ')\n';
        header += '时间: ' + new Date().toLocaleString() + '\n';
        header += '项目: ' + (issues[0] && issues[0].fields ? getValue(issues[0].fields, 'project.name') : '') + '\n';
        header += '============================================\n\n';

        return prompt + header + parts.join('\n');
    }

    // ============ UI 注入 ============

    function injectToolbar() {
        // 只在 Issue Navigator 列表页显示
        if (!document.querySelector('#issuetable')) return;
        // 避免重复注入
        if (document.getElementById('jira-bug-copy-toolbar')) return;

        var toolbar = document.createElement('div');
        toolbar.id = 'jira-bug-copy-toolbar';
        toolbar.innerHTML =
            '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin:10px 0;' +
            'background:linear-gradient(135deg,#4f8cff,#2d6fe0);border-radius:8px;' +
            'box-shadow:0 2px 12px rgba(45,111,224,0.3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;">' +
            '<span style="color:#fff;font-weight:600;font-size:14px;">🐛 Bug 详情复制</span>' +
            '<button id="jira-bug-copy-btn" style="padding:6px 16px;border:none;border-radius:6px;' +
            'background:#fff;color:#2d6fe0;font-weight:600;cursor:pointer;font-size:13px;' +
            'transition:all .2s;">一键获取并复制全部 Bug 详情</button>' +
            '<span id="jira-bug-copy-status" style="color:#e0e8ff;font-size:12px;"></span>' +
            '</div>';

        // 插入到 navigator-content 之前
        var target = document.querySelector('.navigator-content');
        if (target) {
            target.parentNode.insertBefore(toolbar, target);
        } else {
            // fallback: 插到 content-body 开头
            var body = document.querySelector('.content-body');
            if (body) body.insertBefore(toolbar, body.firstChild);
        }

        document.getElementById('jira-bug-copy-btn').addEventListener('click', handleCopyClick);
    }

    function setStatus(text) {
        var el = document.getElementById('jira-bug-copy-status');
        if (el) el.textContent = text;
    }

    function setButtonLoading(loading) {
        var btn = document.getElementById('jira-bug-copy-btn');
        if (!btn) return;
        btn.disabled = loading;
        btn.style.opacity = loading ? '0.6' : '1';
        btn.textContent = loading ? '获取中...' : '一键获取并复制全部 Bug 详情';
    }

    function showToast(msg, isError) {
        var toast = document.createElement('div');
        toast.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;' +
            'border-radius:8px;color:#fff;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,0.2);' +
            'background:' + (isError ? '#e74c3c' : '#27ae60') + ';transition:opacity .3s;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 300);
        }, 2500);
    }

    async function handleCopyClick() {
        var keys = extractIssueKeys();
        if (keys.length === 0) {
            showToast('未找到 Bug 列表，请确认当前在 Issue Navigator 页面', true);
            return;
        }

        setButtonLoading(true);
        setStatus('准备获取 ' + keys.length + ' 个 Bug...');

        try {
            var issues = await concurrentFetch(keys, function (done, total) {
                setStatus('正在获取 ' + done + '/' + total);
            });

            var text = formatAllIssues(issues);

            // 复制到剪贴板
            try {
                await navigator.clipboard.writeText(text);
                showToast('✅ 已复制 ' + keys.length + ' 个 Bug 详情到剪贴板！');
            } catch (clipErr) {
                // fallback: 用 textarea 方式
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                showToast('✅ 已复制 ' + keys.length + ' 个 Bug 详情到剪贴板！');
            }

            setStatus('完成！');
        } catch (e) {
            showToast('❌ 出错: ' + e.message, true);
            setStatus('出错');
        } finally {
            setButtonLoading(false);
            setTimeout(function () { setStatus(''); }, 3000);
        }
    }

    // ============ 编辑弹窗字段精简 ============

    function injectFilterStyle() {
        if (document.getElementById(FILTER_STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = FILTER_STYLE_ID;
        style.textContent = '[' + JIRA_HIDDEN_ATTRIBUTE + '="true"] { display: none !important; }';
        (document.head || document.documentElement).appendChild(style);
    }

    function isJiraKeepField(element) {
        if (element.id === KEEP_FIELD_ID) return true;
        if (element.querySelector('#' + KEEP_FIELD_ID)) return true;

        var label = element.querySelector('label');
        if (label && label.textContent.replace(/\s+/g, '').indexOf(KEEP_LABEL) !== -1) return true;

        return false;
    }

    function filterJiraEditFields() {
        injectFilterStyle();

        var dialog = document.querySelector('#edit-issue-dialog');
        if (!dialog) return;

        dialog.querySelectorAll('[' + JIRA_HIDDEN_ATTRIBUTE + '="true"]').forEach(function (element) {
            element.removeAttribute(JIRA_HIDDEN_ATTRIBUTE);
        });

        var form = dialog.querySelector('form[name="jiraform"]');
        if (!form) return;

        form.querySelectorAll('.field-group, fieldset.group').forEach(function (element) {
            if (isJiraKeepField(element)) return;
            element.setAttribute(JIRA_HIDDEN_ATTRIBUTE, 'true');
        });
    }

    function setupEditDialogFilter() {
        filterJiraEditFields();

        var timer = null;
        var observer = new MutationObserver(function () {
            if (timer) return;
            timer = setTimeout(function () {
                timer = null;
                filterJiraEditFields();
            }, 100);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    // ============ 启动 ============

    // JIRA 列表页可能是动态加载的，轮询等待
    function waitForTable() {
        if (document.querySelector('#issuetable')) {
            injectToolbar();
            // 同时监听 SPA 路由变化
            setupRouteObserver();
        } else {
            setTimeout(waitForTable, 500);
        }
    }

    function setupRouteObserver() {
        // 监听 URL 变化（JIRA 可能是 SPA 导航）
        var lastUrl = location.href;
        setInterval(function () {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(function () {
                    injectToolbar();
                }, 1000);
            }
        }, 1000);
    }

    // 编辑弹窗字段精简在 JIRA 各页面都生效
    setupEditDialogFilter();

    // 检查是否是列表页
    if (location.pathname === '/secure/IssueNavigator.jspa' ||
        location.pathname === '/issues' ||
        location.pathname.startsWith('/issues/')) {
        waitForTable();
    }
})();
