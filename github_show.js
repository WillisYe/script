// ==UserScript==
// @name         GitHub Release 增强（自用修改版）
// @namespace    my-local-script
// @version      999.0.0
// @description  GitHub Release 增强：文件安装包分组排序、平台标签、架构推荐；代理测速、加速下载、全局代理选择；更新日志可折叠
// @author       caolib
// @match        https://github.com/*
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @license      MIT
// @downloadURL （已禁用自动更新）
// @updateURL （已禁用自动更新）
// ==/UserScript==

(function () {
    'use strict';

    // --- 功能开关配置 ---
    const FEATURES = {
        groupAndSort: { key: 'feat_groupSort', label: '文件分组排序', default: true },
        collapsibleNotes: { key: 'feat_collapsibleNotes', label: '可折叠更新日志', default: true },
    };

    const RELEASE_PROXY_SOURCES = [
        ['https://gh.h233.eu.org/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [@X.I.U/XIU2] 提供'],
        ['https://gh.ddlc.top/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [@mtr-static-official] 提供'],
        ['https://gh-proxy.org/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [gh-proxy.com] 提供'],
        ['https://cdn.gh-proxy.org/https://github.com', '其他', '[Fastly CDN] - 该公益加速源由 [gh-proxy.com] 提供'],
        ['https://cors.isteed.cc/github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [@Lufs\'s] 提供'],
        ['https://ghproxy.it/https://github.com', '美国', '[美国 洛杉矶] - 该公益加速源由 [@yionchilau] 提供'],
        ['https://gh.monlor.com/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [gh.monlor.com] 提供'],
        ['https://github.geekery.cn/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [github.geekery.cn] 提供'],
        ['https://github.ednovas.xyz/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [github.ednovas.xyz] 提供'],
        ['https://ghfile.geekertao.top/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [ghfile.geekertao.top] 提供'],
        ['https://gh.chjina.com/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [gh.chjina.com] 提供'],
        ['https://ghpxy.hwinzniej.top/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [ghpxy.hwinzniej.top] 提供'],
        ['https://git.yylx.win/https://github.com', '美国', '[美国 Cloudflare CDN] - 该公益加速源由 [git.yylx.win] 提供'],
        ['https://ghproxy.net/https://github.com', '其他', '[英国伦敦] - 该公益加速源由 [ghproxy.net] 提供'],
        ['https://ghfast.top/https://github.com', '其他', '[日本、韩国、新加坡、美国、德国等]（CDN 不固定） - 该公益加速源由 [ghproxy.link] 提供'],
        ['https://wget.la/https://github.com', '其他', '[中国香港、中国台湾、日本、美国等]（CDN 不固定） - 该公益加速源由 [ucdn.me] 提供'],
    ];

    function isEnabled(feature) {
        if (typeof GM_getValue === 'undefined') return FEATURES[feature].default;
        return GM_getValue(FEATURES[feature].key, FEATURES[feature].default);
    }

    function registerMenus() {
        if (typeof GM_registerMenuCommand === 'undefined') return;
        Object.entries(FEATURES).forEach(([featureKey, cfg]) => {
            const update = () => {
                const current = GM_getValue(cfg.key, cfg.default);
                const next = !current;
                GM_setValue(cfg.key, next);
                alert(`「${cfg.label}」已${next ? '启用' : '禁用'}，刷新页面生效`);
            };
            const state = () => isEnabled(featureKey) ? '✅' : '❌';
            GM_registerMenuCommand(`${state()} ${cfg.label}`, update);
        });
    }

    registerMenus();

    // --- 注入 CSS 样式 ---
    function injectCSS() {
        if (document.getElementById('gh-release-grouper-css')) return;
        const style = document.createElement('style');
        style.id = 'gh-release-grouper-css';
        style.innerHTML = `
            .gh-meta-container+.Truncate {display:none;}
            .gh-group-win { border-left: 4px solid var(--color-accent-emphasis, #1f6feb) !important; background-color: var(--color-accent-subtle, rgba(56,139,253,0.1)) !important; }
            .gh-group-win:hover { background-color: var(--color-accent-muted, rgba(56,139,253,0.15)) !important; }
            .gh-group-win a[href*="/releases/download/"], .gh-group-win a[href*="/archive/"] { color: var(--color-accent-emphasis, #1f6feb) !important; }

            .gh-group-mac { border-left: 4px solid var(--color-done-emphasis, #8957e5) !important; background-color: var(--color-done-subtle, rgba(137,87,229,0.1)) !important; }
            .gh-group-mac:hover { background-color: var(--color-done-muted, rgba(137,87,229,0.15)) !important; }
            .gh-group-mac a[href*="/releases/download/"], .gh-group-mac a[href*="/archive/"] { color: var(--color-done-emphasis, #8957e5) !important; }

                    .gh-group-mobile { border-left: 4px solid #e3b341 !important; background-color: rgba(227, 179, 65, 0.12) !important; }
                    .gh-group-mobile:hover { background-color: rgba(227, 179, 65, 0.18) !important; }
                .gh-group-mobile a[href*="/releases/download/"], .gh-group-mobile a[href*="/archive/"] { color: #e3b341 !important; }

            .gh-group-linux-rpm { border-left: 4px solid var(--color-danger-emphasis, #f85149) !important; background-color: var(--color-danger-subtle, rgba(248,81,73,0.1)) !important; }
            .gh-group-linux-rpm:hover { background-color: var(--color-danger-muted, rgba(248,81,73,0.15)) !important; }
            .gh-group-linux-rpm a[href*="/releases/download/"], .gh-group-linux-rpm a[href*="/archive/"] { color: var(--color-danger-emphasis, #f85149) !important; }

            .gh-group-linux-deb { border-left: 4px solid var(--color-severe-emphasis, #db6d28) !important; background-color: var(--color-severe-subtle, rgba(219,109,40,0.1)) !important; }
            .gh-group-linux-deb:hover { background-color: var(--color-severe-muted, rgba(219,109,40,0.15)) !important; }
            .gh-group-linux-deb a[href*="/releases/download/"], .gh-group-linux-deb a[href*="/archive/"] { color: var(--color-severe-emphasis, #db6d28) !important; }

            .gh-group-linux-arch { border-left: 4px solid var(--color-sponsors-emphasis, #bf4b8a) !important; background-color: var(--color-sponsors-subtle, rgba(191,75,138,0.1)) !important; }
            .gh-group-linux-arch:hover { background-color: var(--color-sponsors-muted, rgba(191,75,138,0.15)) !important; }
            .gh-group-linux-arch a[href*="/releases/download/"], .gh-group-linux-arch a[href*="/archive/"] { color: var(--color-sponsors-emphasis, #bf4b8a) !important; }

            .gh-group-linux-appimage { border-left: 4px solid #20c997 !important; background-color: rgba(32, 201, 151, 0.1) !important; }
            .gh-group-linux-appimage:hover { background-color: rgba(32, 201, 151, 0.15) !important; }
            .gh-group-linux-appimage a[href*="/releases/download/"], .gh-group-linux-appimage a[href*="/archive/"] { color: #20c997 !important; }

            .gh-group-linux-flatpak { border-left: 4px solid #0abda0 !important; background-color: rgba(10, 189, 160, 0.1) !important; }
            .gh-group-linux-flatpak:hover { background-color: rgba(10, 189, 160, 0.15) !important; }
            .gh-group-linux-flatpak a[href*="/releases/download/"], .gh-group-linux-flatpak a[href*="/archive/"] { color: #0abda0 !important; }

            .gh-group-linux-other { border-left: 4px solid var(--color-attention-emphasis, #9e6a03) !important; background-color: var(--color-attention-subtle, rgba(210,153,34,0.1)) !important; }
            .gh-group-linux-other:hover { background-color: var(--color-attention-muted, rgba(210,153,34,0.15)) !important; }
            .gh-group-linux-other a[href*="/releases/download/"], .gh-group-linux-other a[href*="/archive/"] { color: var(--color-attention-emphasis, #9e6a03) !important; }

            .gh-group-other { border-left: 4px solid transparent !important; }

                    /* 平台标签颜色与分组主色完全一致（镂空） */
                    .gh-platform-tag {
                        background-color: transparent !important;
                    }
                    .gh-platform-tag.gh-tag-win {
                        color: var(--color-accent-emphasis, #1f6feb) !important;
                        border-color: var(--color-accent-emphasis, #1f6feb) !important;
                    }
                    .gh-platform-tag.gh-tag-mac {
                        color: var(--color-done-emphasis, #8957e5) !important;
                        border-color: var(--color-done-emphasis, #8957e5) !important;
                    }
                    .gh-platform-tag.gh-tag-mobile {
                        color: #e3b341 !important;
                        border-color: #e3b341 !important;
                    }
                    .gh-platform-tag.gh-tag-linux-rpm {
                        color: var(--color-danger-emphasis, #f85149) !important;
                        border-color: var(--color-danger-emphasis, #f85149) !important;
                    }
                    .gh-platform-tag.gh-tag-linux-deb {
                        color: var(--color-severe-emphasis, #db6d28) !important;
                        border-color: var(--color-severe-emphasis, #db6d28) !important;
                    }
                    .gh-platform-tag.gh-tag-linux-arch {
                        color: var(--color-sponsors-emphasis, #bf4b8a) !important;
                        border-color: var(--color-sponsors-emphasis, #bf4b8a) !important;
                    }
                    .gh-platform-tag.gh-tag-linux-appimage {
                        color: #20c997 !important;
                        border-color: #20c997 !important;
                    }
                    .gh-platform-tag.gh-tag-linux-flatpak {
                        color: #0abda0 !important;
                        border-color: #0abda0 !important;
                    }
                    .gh-platform-tag.gh-tag-linux-other {
                        color: var(--color-attention-emphasis, #9e6a03) !important;
                        border-color: var(--color-attention-emphasis, #9e6a03) !important;
                    }

            .gh-proxy-container {
                margin-left: 8px;
                display: flex;
                align-items: center;
                flex-shrink: 0;
            }

            /* OS / 架构 切换下拉框 */
            .gh-os-select, .gh-arch-select {
                appearance: auto;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg, #21262d));
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border, rgba(240,246,252,0.1)));
                border-radius: 6px;
                color: var(--button-default-fgColor-rest, var(--color-btn-text, #c9d1d9));
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                line-height: 20px;
                padding: 3px 8px;
                margin-left: 8px;
            }
            .gh-os-select:hover, .gh-arch-select:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg, #30363d));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border, rgba(240,246,252,0.3)));
            }

            /* 签名/校验文件折叠区 */
            .gh-meta-files-wrapper > summary {
                cursor: pointer; padding: 8px 16px; font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted, #8b949e));
                border-top: 1px solid var(--borderColor-muted, var(--color-border-muted, #30363d));
            }
            .gh-meta-files-wrapper > summary:hover {
                color: var(--fgColor-default, var(--color-fg-default, #e6edf3));
            }

            /* 组内校验/增量文件折叠区:wrapper 承载分组背景与左线,内部行不再重复绘制 */
            .gh-group-aux-wrapper { padding-left: 0 !important; }
            .gh-group-aux-wrapper > li {
                border-left: none !important;
                background-color: transparent !important;
            }
            .gh-group-aux-wrapper > summary {
                cursor: pointer; padding: 6px 16px; font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted, #8b949e));
            }
            .gh-group-aux-wrapper > summary:hover {
                color: var(--fgColor-default, var(--color-fg-default, #e6edf3));
            }

            /* 移动端适配样式 */
            .gh-meta-container { flex-wrap: wrap; gap: 4px; }
            @media (max-width: 768px) {
                .gh-meta-container { margin-top: 4px; }
            }

            /* 更新日志手动折叠(默认展开):低调的标题行,非按钮外观 */
            .markdown-body.gh-notes-collapsed { display: none !important; }
            .gh-notes-toggle {
                appearance: none; background: none; border: none; padding: 0;
                margin: 0 0 8px;
                display: inline-flex; align-items: center; gap: 6px;
                cursor: pointer; user-select: none;
                color: var(--fgColor-muted, var(--color-fg-muted, #8b949e));
                font-size: 14px; font-weight: 600;
            }
            .gh-notes-toggle:hover { color: var(--fgColor-default, var(--color-fg-default, #e6edf3)); }
            .gh-notes-chevron {
                display: inline-block; width: 0; height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-top: 6px solid currentColor;
                transition: transform 0.12s ease;
                transform-origin: 50% 40%;
            }
            .gh-notes-toggle.is-collapsed .gh-notes-chevron { transform: rotate(-90deg); }

            /* 架构说明按钮 */
            .gh-arch-help-btn {
                appearance: none;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg, #21262d));
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border, rgba(240,246,252,0.1)));
                border-radius: 6px;
                color: var(--button-default-fgColor-rest, var(--color-btn-text, #c9d1d9));
                cursor: pointer;
                font-size: 12px; font-weight: 600;
                width: 22px; height: 22px; line-height: 1;
                padding: 0; margin-left: 4px;
                display: inline-flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .gh-arch-help-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg, #30363d));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border, rgba(240,246,252,0.3)));
            }

            /* 架构说明弹窗 */
            .gh-arch-help-overlay {
                position: fixed; inset: 0; z-index: 10000;
                background-color: rgba(1,4,9,0.72);
                backdrop-filter: blur(3px);
                display: flex; align-items: center; justify-content: center;
                padding: 16px;
            }
            .gh-arch-help-modal {
                width: min(740px, 94vw);
                background: linear-gradient(180deg, var(--color-canvas-default, #0d1117), var(--color-canvas-subtle, #161b22));
                border: 1px solid var(--color-border-default, #30363d);
                border-radius: 10px;
                padding: 18px 20px;
                max-height: 85vh; overflow: auto;
                position: relative;
                box-shadow: var(--shadow-floating-large, 0 8px 24px rgba(0,0,0,0.4));
                color: var(--color-fg-default, #e6edf3);
            }
            .gh-arch-help-modal h3 {
                margin: 0 0 10px; font-size: 18px; line-height: 1.3;
                color: var(--color-fg-default, #e6edf3);
            }
            .gh-arch-help-tip {
                margin: 0 0 14px; padding: 10px 12px; border-radius: 6px;
                font-size: 13px; line-height: 1.65; color: var(--color-fg-default, #e6edf3);
                background-color: rgba(56, 139, 253, 0.12);
                border: 1px solid rgba(56, 139, 253, 0.35);
            }
            .gh-arch-help-modal table {
                border-collapse: collapse; width: 100%; font-size: 13px;
                border: 1px solid var(--color-border-default, #30363d);
            }
            .gh-arch-help-modal th, .gh-arch-help-modal td {
                border: 1px solid var(--color-border-default, #30363d);
                padding: 10px 12px; text-align: left; vertical-align: top;
                line-height: 1.55;
            }
            .gh-arch-help-modal th {
                background-color: var(--color-canvas-subtle, #161b22);
                font-weight: 700;
                position: sticky; top: 0; z-index: 1;
            }
            .gh-arch-help-modal tbody tr:nth-child(odd) {
                background-color: rgba(110, 118, 129, 0.08);
            }
            .gh-arch-help-close {
                position: absolute; top: 8px; right: 10px;
                background: none; border: none;
                color: var(--color-fg-muted, #8b949e);
                cursor: pointer; font-size: 24px; line-height: 1; padding: 0;
            }
            .gh-arch-help-close:hover { color: var(--color-fg-default, #e6edf3); }

            .gh-scroll-top-btn {
                position: fixed; right: 24px; bottom: 24px; z-index: 9999;
                width: 40px; height: 40px; border-radius: 50%; border: none;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg, #21262d));
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border, rgba(240,246,252,0.1)));
                color: var(--button-default-fgColor-rest, var(--color-btn-text, #c9d1d9));
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                opacity: 0; pointer-events: none; transition: opacity 0.2s ease, background-color 0.15s ease;
            }
            .gh-scroll-top-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg, #30363d));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border, rgba(240,246,252,0.3)));
            }
            .gh-scroll-top-btn.gh-visible { opacity: 1; pointer-events: auto; }
        `;
        document.head.appendChild(style);
    }

    // --- 工具函数 ---

    const DEFAULT_OS = 'windows';
    const DEFAULT_ARCH = 'x86_64';

    let _selectedOS = null;
    let _selectedArch = null;
    const _processedDetails = [];

    // 全局测速缓存 { results: [...], timestamp: number }
    let _globalSpeedTestCache = null;
    const SPEED_CACHE_KEY = 'gh_release_speed_cache';

    function loadSpeedCache() {
        try {
            const raw = GM_getValue(SPEED_CACHE_KEY, null);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.timestamp) {
                    _globalSpeedTestCache = parsed;
                }
            }
        } catch (e) {
            // 解析失败，忽略
        }
    }

    function saveSpeedCache() {
        if (_globalSpeedTestCache) {
            GM_setValue(SPEED_CACHE_KEY, JSON.stringify(_globalSpeedTestCache));
        }
    }

    function getActiveOS() {
        return _selectedOS || DEFAULT_OS;
    }

    function getActiveArch() {
        return _selectedArch || DEFAULT_ARCH;
    }

    // 强制重新排序所有已处理的 details
    function reprocessAllDetails() {
        _processedDetails.forEach(d => {
            d.dataset.validRowCount = '0';
            if (d.open) formatAndSortUI(d, true);
        });
    }

    const OS_OPTIONS = [
        { value: 'windows', label: 'Windows' },
        { value: 'mac', label: 'macOS' },
        { value: 'linux', label: 'Linux' },
        { value: 'android', label: 'Android' },
        { value: 'ios', label: 'iOS' },
    ];

    const ARCH_OPTIONS = [
        { value: 'x86_64', label: 'x64' },
        { value: 'arm64', label: 'arm64' },
        { value: 'x86', label: 'x86' },
        { value: 'arm32', label: 'arm32' },
    ];

    // 从文件名解析架构,返回规范化架构 key。
    // 判断顺序很关键:子串存在包含关系(arm64 含 arm、x86_64 含 x86、armv8 含 arm 等),必须先 64 位后 32 位。
    function parseFileArch(fileName) {
        const name = fileName.toLowerCase();
        // ARM64:aarch64 / arm64 / armv8 / arm64-v8a(Android ABI)——必须先于 ARM32
        if (name.includes('aarch64') || name.includes('arm64') || name.includes('armv8')) return 'arm64';
        // x86_64:x86_64 / x64 / amd64——必须先于 x86
        if (name.includes('x86_64') || name.includes('x64') || name.includes('amd64')) return 'x86_64';
        // RISC-V 64
        if (name.includes('riscv64') || name.includes('riscv')) return 'riscv64';
        // ARM32:armv7 / armeabi-v7a / armhf / armv6 / armel / armeabi / 单独的 arm
        if (name.includes('armv7') || name.includes('armeabi-v7a') || name.includes('armhf') || name.includes('armv6') || name.includes('armel') || name.includes('armeabi') || /\barm\b/.test(name)) return 'arm32';
        // x86(32 位):i386 / i686 / ia32 / x86 / 32-bit / 32bit
        if (name.includes('i386') || name.includes('i686') || name.includes('ia32') || name.includes('x86') || name.includes('32-bit') || name.includes('32bit')) return 'x86';
        // 冷门架构:仅识别归类,自然排到末尾
        if (name.includes('mips64') || name.includes('mipsel') || name.includes('mips')) return 'mips';
        if (name.includes('ppc64') || name.includes('ppc')) return 'ppc';
        // macOS Universal(x86_64 + arm64 合一)
        if (name.includes('universal')) return 'universal';
        return null;
    }

    // --- 架构说明弹窗(全局复用一个,点背景或 × 关闭) ---
    let _archHelpModal = null;
    function showArchHelp() {
        if (!_archHelpModal) {
            _archHelpModal = createArchHelpModal();
            document.body.appendChild(_archHelpModal);
        }
        _archHelpModal.style.display = 'flex';
    }
    function createArchHelpModal() {
        const overlay = document.createElement('div');
        overlay.className = 'gh-arch-help-overlay';
        overlay.innerHTML = `
            <div class="gh-arch-help-modal">
                <button type="button" class="gh-arch-help-close" aria-label="关闭">×</button>
                <h3>设备架构说明</h3>
                <p class="gh-arch-help-tip">架构指 CPU 指令集架构（ISA），它决定软件能否运行；不同架构通常不能直接通用。这里的排序会优先推荐更适合你当前设备的安装包。</p>
                <table>
                    <thead><tr><th>架构</th><th>常见别名</th><th>常见设备</th><th>说明</th></tr></thead>
                    <tbody>
                        <tr><td><strong>x86</strong></td><td>i386、i686、32 位</td><td>老电脑、旧工控机</td><td>Intel/AMD 32 位架构，已逐渐淘汰</td></tr>
                        <tr><td><strong>x86_64</strong></td><td>amd64、x64</td><td>大多数 Windows/Linux PC</td><td>桌面和服务器最常见，兼容性最好</td></tr>
                        <tr><td><strong>ARM32</strong></td><td>armv7、armeabi-v7a</td><td>老安卓手机、树莓派早期</td><td>32 位 ARM，部分老设备仍在使用</td></tr>
                        <tr><td><strong>ARM64</strong></td><td>aarch64、arm64</td><td>新安卓手机、Apple Silicon、树莓派 3/4/5</td><td>移动设备主流，兼容性和性能都更强</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        const close = () => { overlay.style.display = 'none'; };
        overlay.querySelector('.gh-arch-help-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.style.display = 'none';
        return overlay;
    }

    // 判断是否为校验/增量更新等衍生文件(如 .sha256sum、.bsdiff),这类文件在本组内折叠收起
    function isAuxiliaryFile(fileName) {
        const name = fileName.toLowerCase();
        if (/\.sha\d*sum$/.test(name)) return true;       // .sha256sum / .sha512sum / .shasum
        if (/\.md5sum$/.test(name)) return true;
        if (/\.checksums?$/.test(name)) return true;
        if (/\.sums$/.test(name)) return true;
        if (/\.(bsdiff|delta|patch)$/.test(name)) return true;   // 增量更新补丁
        return false;
    }

    function parseFileGroup(fileName) {
        const name = fileName.toLowerCase();

        if (name.endsWith('.sig') || name.endsWith('.sha256') || name.endsWith('.pem') || name.endsWith('.blockmap')) {
            return { id: 'meta', showTag: false };
        }
        if (name.includes('source') || (name.endsWith('.tar.gz') && !name.endsWith('.app.tar.gz') && !name.includes('linux') && !name.includes('mac') && !name.includes('win'))) {
            return { id: 'source', showTag: false };
        }

        if (name.endsWith('.exe') || name.endsWith('.msi') || name.includes('-win') || name.includes('_win')) {
            return { id: 'windows', name: 'Win', showTag: true };
        }
        if (name.endsWith('.dmg') || name.endsWith('.pkg') || name.endsWith('.app.tar.gz') || name.includes('-mac') || name.includes('_mac') || name.includes('darwin')) {
            return { id: 'mac', name: 'Mac', showTag: true };
        }

        if (name.endsWith('.apk') || name.endsWith('.aab')) {
            return { id: 'android', name: 'Android', showTag: true };
        }
        if (name.endsWith('.ipa')) {
            return { id: 'ios', name: 'iOS', showTag: true };
        }

        if (name.endsWith('.deb')) return { id: 'linux-deb', name: 'Debian', showTag: true };
        if (name.endsWith('.rpm')) return { id: 'linux-rpm', name: 'RedHat', showTag: true };
        if (name.endsWith('.appimage')) return { id: 'linux-appimage', name: 'AppImage', showTag: true };
        if (name.endsWith('.flatpak')) return { id: 'linux-flatpak', name: 'Flatpak', showTag: true };
        if (name.endsWith('.pacman') || name.endsWith('.pkg.tar.zst')) return { id: 'linux-arch', name: 'Arch', showTag: true };
        if (name.includes('-linux') || name.includes('_linux') || name.endsWith('.tar.xz')) return { id: 'linux-other', name: 'Linux', showTag: true };

        return { id: 'other', showTag: false };
    }

    function getGroupClass(groupId) {
        if (groupId === 'windows') return 'gh-group-win';
        if (groupId === 'mac') return 'gh-group-mac';
        if (groupId === 'linux-deb') return 'gh-group-linux-deb';
        if (groupId === 'linux-rpm') return 'gh-group-linux-rpm';
        if (groupId === 'linux-arch') return 'gh-group-linux-arch';
        if (groupId === 'linux-appimage') return 'gh-group-linux-appimage';
        if (groupId === 'linux-flatpak') return 'gh-group-linux-flatpak';
        if (groupId.startsWith('linux')) return 'gh-group-linux-other';
        if (groupId === 'android' || groupId === 'ios') return 'gh-group-mobile';
        return 'gh-group-other';
    }

    function getTagClass(groupId) {
        if (groupId === 'windows') return 'gh-tag-win';
        if (groupId === 'mac') return 'gh-tag-mac';
        if (groupId === 'linux-deb') return 'gh-tag-linux-deb';
        if (groupId === 'linux-rpm') return 'gh-tag-linux-rpm';
        if (groupId === 'linux-arch') return 'gh-tag-linux-arch';
        if (groupId === 'linux-appimage') return 'gh-tag-linux-appimage';
        if (groupId === 'linux-flatpak') return 'gh-tag-linux-flatpak';
        if (groupId.startsWith('linux')) return 'gh-tag-linux-other';
        if (groupId === 'android' || groupId === 'ios') return 'gh-tag-mobile';
        return '';
    }

    function calculateMatchScore(fileName, currentOS, groupId, currentArch) {
        let groupScore = 0;
        let innerScore = 0;
        const name = fileName.toLowerCase();
        const isCurrentOS = (groupId === currentOS) || groupId.startsWith(currentOS + '-');
        const isDesktopOS = currentOS === 'windows' || currentOS === 'mac' || currentOS === 'linux';

        if (isCurrentOS) {
            groupScore = 10000;
            if (groupId === 'linux-deb') groupScore += 300;
            else if (groupId === 'linux-rpm') groupScore += 200;
            else if (groupId === 'linux-appimage' || groupId === 'linux-flatpak') groupScore += 100;
        } else {
            if (groupId === 'windows') groupScore = 9000;
            else if (groupId === 'mac') groupScore = 8000;
            else if (groupId === 'linux-deb') groupScore = 7000;
            else if (groupId === 'linux-rpm') groupScore = 6000;
            else if (groupId === 'linux-appimage') groupScore = 5200;
            else if (groupId === 'linux-flatpak') groupScore = 5000;
            else if (groupId === 'linux-arch') groupScore = 4500;
            else if (groupId === 'linux-other') groupScore = 4000;
            else if (groupId === 'android') groupScore = 3500;
            else if (groupId === 'ios') groupScore = 3000;
            else if (groupId === 'other') groupScore = 2000;
            else if (groupId === 'meta') groupScore = -1000;
            else if (groupId === 'source') groupScore = -2000;
        }

        // 架构匹配：优先按用户当前设备架构，但 Windows 用户对 x86_64 版本的兼容性和常用度普遍更高，
        // 所以在 Windows 分组里会明显给 x86_64 增加“常用版本”偏好，避免 aarch64.exe 反而把 x64.exe 排到前面。
        const fileArch = parseFileArch(fileName);
        if (currentOS === 'windows' && currentArch === 'x86_64') {
            if (fileArch === 'x86_64') {
                innerScore += 700;
            } else if (fileArch === 'arm64') {
                innerScore -= 120;
            } else if (fileArch === 'universal') {
                innerScore += 140;
            }
        } else if (isDesktopOS && currentArch === 'arm64' && fileArch === 'x86_64') {
            innerScore += 260;
        } else if (fileArch === currentArch) {
            innerScore += 500;
        } else if (fileArch === 'universal') {
            innerScore += 60;
        } else if (fileArch === 'x86_64') {
            innerScore += 90;
        } else if (fileArch === 'arm64') {
            innerScore += 70;
        } else if (fileArch === 'x86') {
            innerScore += 10;
        } else if (fileArch === 'arm32') {
            innerScore += 5;
        }

        if (name.endsWith('.exe') || name.endsWith('.dmg') || name.endsWith('.appimage') || name.endsWith('.flatpak') || name.endsWith('.apk')) innerScore += 10;
        if (name.endsWith('.zip') || name.endsWith('.7z')) innerScore += 5;

        return groupScore + innerScore;
    }

    function getFileNameFromLink(linkElem) {
        // 优先从 href 提取真实文件名（兼容显示名被重命名的界面）
        const href = linkElem.getAttribute('href');
        if (href) {
            const lastSegment = decodeURIComponent(href.split('/').pop().split('?')[0]);
            if (lastSegment) return lastSegment;
        }
        // 回退到 span 文本
        const fileNameSpan = linkElem.querySelector('.Truncate-text');
        return fileNameSpan ? fileNameSpan.textContent.trim() : linkElem.textContent.trim();
    }

    // --- 核心解耦逻辑 ---

    function formatAndSortUI(detailsElem, force) {
        const validRows = Array.from(detailsElem.querySelectorAll('li')).filter(r => r.querySelector('a[href*="/releases/download/"], a[href*="/archive/"], a[href*="/attestations/"]'));
        if (validRows.length === 0) return;

        const prevCount = parseInt(detailsElem.dataset.validRowCount || '0');
        if (!force && validRows.length === prevCount) return;
        detailsElem.dataset.validRowCount = validRows.length;

        const parentList = validRows[0].parentNode;
        const os = getActiveOS();
        const arch = getActiveArch();

        validRows.forEach(row => {
            const nameLink = row.querySelector('a[href*="/releases/download/"], a[href*="/archive/"], a[href*="/attestations/"]');
            let score = -10000;
            let groupInfo = { id: 'other', showTag: false };

            if (nameLink) {
                const fileName = getFileNameFromLink(nameLink);
                const href = nameLink.getAttribute('href') || '';
                groupInfo = href.includes('/archive/') ? { id: 'source', showTag: false }
                    : href.includes('/attestations/') ? { id: 'meta', showTag: false }
                    : parseFileGroup(fileName);
                score = calculateMatchScore(fileName, os, groupInfo.id, arch);
            }
            row.dataset.matchScore = score;
            row._groupInfo = groupInfo;
            row._nameLink = nameLink;
        });

        validRows.forEach(row => row.remove());
        // 清除旧的折叠区(全局签名/校验 + 各组内校验折叠)
        parentList.querySelectorAll('.gh-meta-files-wrapper, .gh-group-aux-wrapper').forEach(w => w.remove());

        validRows.sort((a, b) => parseInt(b.dataset.matchScore) - parseInt(a.dataset.matchScore));

        const normalRows = validRows.filter(r => r._groupInfo.id !== 'meta');
        const metaRows = validRows.filter(r => r._groupInfo.id === 'meta');

        const applyRowStyle = (row) => {
            row.style.borderTop = '';
            row.style.borderLeft = '';
            row.style.backgroundColor = '';
            row.className = row.className.replace(/gh-group-\S+/g, '');

            const groupClass = getGroupClass(row._groupInfo.id);
            row.classList.add(groupClass);

            let metaContainer = row.querySelector('.gh-meta-container');
            if (!metaContainer) {
                metaContainer = document.createElement('div');
                metaContainer.className = 'gh-meta-container d-flex flex-items-center flex-shrink-0 mr-3';

                const rightSection = row.querySelector('.col-md-6') || row.querySelector('.flex-auto.flex-justify-end');
                const shaWrapper = rightSection ? rightSection.querySelector('.flex-1') : null;

                if (shaWrapper) {
                    shaWrapper.insertBefore(metaContainer, shaWrapper.firstChild);
                } else if (rightSection) {
                    rightSection.insertBefore(metaContainer, rightSection.firstChild);
                } else {
                    const leftSection = row.querySelector('.col-lg-6');
                    if (leftSection) {
                        leftSection.appendChild(metaContainer);
                    } else {
                        row.appendChild(metaContainer);
                    }
                }
            }

            row.querySelectorAll('.gh-platform-tag').forEach(tag => tag.remove());

            if (row._groupInfo.showTag) {
                const tag = document.createElement('span');
                const tagClass = getTagClass(row._groupInfo.id);
                tag.className = `Label gh-platform-tag ${tagClass} mr-2`;
                tag.textContent = row._groupInfo.name;
                metaContainer.appendChild(tag);
            }
        };

        // 按 groupId 分段渲染(normalRows 已按 score 降序、同组相邻);
        // 每段末尾把校验和文件折叠收起,使主体安装包优先展示
        let currentGroupId = null;
        let currentSegment = [];

        const flushSegment = () => {
            if (currentSegment.length === 0) return;
            const groupId = currentSegment[0]._groupInfo.id;

            const mainRows = [];
            const auxRows = [];
            currentSegment.forEach(row => {
                const name = row._nameLink ? getFileNameFromLink(row._nameLink) : '';
                (isAuxiliaryFile(name) ? auxRows : mainRows).push(row);
            });

            mainRows.forEach(row => {
                parentList.appendChild(row);
                applyRowStyle(row);
            });

            if (auxRows.length > 0) {
                const wrapper = document.createElement('details');
                wrapper.className = `gh-group-aux-wrapper ${getGroupClass(groupId)}`;
                const summary = document.createElement('summary');
                summary.textContent = `校验/增量文件 (${auxRows.length})`;
                wrapper.appendChild(summary);
                auxRows.forEach(row => {
                    wrapper.appendChild(row);
                    applyRowStyle(row);
                });
                parentList.appendChild(wrapper);
            }

            currentSegment = [];
        };

        normalRows.forEach(row => {
            const gid = row._groupInfo.id;
            if (gid !== currentGroupId) flushSegment();
            currentGroupId = gid;
            currentSegment.push(row);
        });
        flushSegment();

        if (metaRows.length > 0) {
            const wrapper = document.createElement('details');
            wrapper.className = 'gh-meta-files-wrapper';
            const summary = document.createElement('summary');
            summary.textContent = `签名 / 校验文件 (${metaRows.length})`;
            wrapper.appendChild(summary);
            metaRows.forEach(row => {
                wrapper.appendChild(row);
                applyRowStyle(row);
            });
            parentList.appendChild(wrapper);
        }

        // "Show all X assets" 按钮移至底部
        const showAllBtn = Array.from(parentList.children).find(child =>
            !child.querySelector('a[href*="/releases/download/"], a[href*="/archive/"]') &&
            !child.classList.contains('gh-meta-files-wrapper') &&
            !child.classList.contains('gh-group-aux-wrapper') &&
            /show all/i.test(child.textContent)
        );
        if (showAllBtn) parentList.appendChild(showAllBtn);
    }

    function testProxySpeed(proxyUrl, timeoutMs = 8000) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                resolve({ url: proxyUrl, time: Infinity, ok: false });
                return;
            }

            const startTime = performance.now();
            const timer = setTimeout(() => {
                resolve({ url: proxyUrl, time: Infinity, ok: false });
            }, timeoutMs + 1000);

            const fail = () => {
                clearTimeout(timer);
                resolve({ url: proxyUrl, time: Infinity, ok: false });
            };

            GM_xmlhttpRequest({
                method: 'HEAD',
                url: proxyUrl,
                timeout: timeoutMs,
                onload: () => {
                    clearTimeout(timer);
                    const time = performance.now() - startTime;
                    resolve({ url: proxyUrl, time, ok: true });
                },
                onerror: fail,
                ontimeout: fail
            });
        });
    }

    function fillGlobalProxySelect() {
        const select = document.querySelector('.gh-global-proxy-select');
        if (!select || !_globalSpeedTestCache) return;
        select.innerHTML = '';
        _globalSpeedTestCache.results
            .slice()
            .sort((a, b) => (a.ok ? a.time : Infinity) - (b.ok ? b.time : Infinity))
            .forEach(r => {
                const option = document.createElement('option');
                option.value = r.prefix;
                const host = r.prefix.split('/')[2];
                if (r.ok) {
                    option.textContent = `${host} (${r.time.toFixed(0)}ms)`;
                } else {
                    option.textContent = `${host} (超时)`;
                    option.disabled = true;
                }
                select.appendChild(option);
            });
        if (select.options.length > 0) {
            select.style.display = 'inline-block';
            select.selectedIndex = 0;
        }
    }

    function formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        if (diff < 0) return '刚刚';
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}秒前`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;
        const days = Math.floor(hours / 24);
        return `${days}天前`;
    }

    function raceN(sources, n = 3, maxWaitMs = 2000) {
        return new Promise((resolve) => {
            let returned = 0;
            const results = [];
            let resolved = false;

            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(results);
                }
            }, maxWaitMs);

            if (sources.length === 0) {
                clearTimeout(timer);
                resolve(results);
                return;
            }

            sources.forEach(url => {
                testProxySpeed(url).then(result => {
                    if (resolved) return;
                    results.push(result);
                    returned++;
                    if (returned >= n) {
                        clearTimeout(timer);
                        resolved = true;
                        resolve(results);
                    }
                });
            });
        });
    }

    function processProxyButtons(detailsElem) {
        function getOriginalDownloadUrl(row) {
            const directLink = row.querySelector('a[href*="/releases/download/"], a[href*="/archive/"]');
            if (directLink) {
                const href = directLink.getAttribute('href');
                if (href) return new URL(href, window.location.origin).href;
            }
            return null;
        }

        function ensureProxyContainer(row) {
            let container = row.querySelector('.gh-proxy-container');
            if (container) return container;

            container = document.createElement('div');
            container.className = 'gh-proxy-container';

            const rightSection = row.querySelector('.col-md-6') || row.querySelector('.flex-auto.flex-justify-end');
            const metaContainer = row.querySelector('.gh-meta-container');
            const shaWrapper = rightSection ? rightSection.querySelector('.flex-1') : null;

            if (rightSection) {
                rightSection.appendChild(container);
            } else if (metaContainer) {
                metaContainer.appendChild(container);
            } else if (shaWrapper) {
                shaWrapper.appendChild(container);
            } else {
                row.appendChild(container);
            }

            return container;
        }

        const validRows = Array.from(detailsElem.querySelectorAll('li')).filter(row =>
            row.querySelector('a[href*="/releases/download/"], a[href*="/archive/"]')
        );

        validRows.forEach(row => {
            const originalUrl = getOriginalDownloadUrl(row);
            if (!originalUrl) return;

            const container = ensureProxyContainer(row);
            const normalized = originalUrl.replace(window.location.origin, '');
            const proxyUrls = RELEASE_PROXY_SOURCES.map(([prefix]) => prefix + normalized);
            if (proxyUrls.length === 0) return;

            let autoBtn = container.querySelector('.gh-auto-proxy-btn');
            if (!autoBtn) {
                autoBtn = document.createElement('button');
                autoBtn.className = 'Button Button--secondary Button--small gh-auto-proxy-btn';
                autoBtn.type = 'button';
                autoBtn.innerHTML = `<span class="Button-content"><span class="Button-label">⚡ 加速下载</span></span>`;
                autoBtn.style.marginRight = '6px';
                autoBtn.style.display = 'inline-flex';
                autoBtn.style.alignItems = 'center';
                container.appendChild(autoBtn);
            }

            autoBtn.dataset.proxySources = JSON.stringify(proxyUrls);
            autoBtn.onclick = async function() {
                const btn = this;
                if (btn.disabled) return;
                const sources = JSON.parse(btn.dataset.proxySources || '[]');
                if (sources.length === 0) return;

                const MAX_PROXY_TIME = 3000;

                // 优先使用全局测速缓存
                if (_globalSpeedTestCache) {
                    const prefixResults = _globalSpeedTestCache.results;
                    const matched = sources.map(url => {
                        const prefixEntry = prefixResults.find(r => url.startsWith(r.prefix));
                        return { url, time: prefixEntry ? prefixEntry.time : Infinity, ok: prefixEntry ? prefixEntry.ok : false };
                    }).filter(r => r.ok).sort((a, b) => a.time - b.time);

                    const globalProxySelect = document.querySelector('.gh-global-proxy-select');
                    let selectedUrl = null;
                    if (globalProxySelect && globalProxySelect.value) {
                        const selectedPrefix = globalProxySelect.value;
                        selectedUrl = matched.find(r => r.url.startsWith(selectedPrefix))?.url;
                    }
                    if (!selectedUrl && matched.length > 0) {
                        selectedUrl = matched[0].url;
                    }
                    if (selectedUrl) {
                        window.open(selectedUrl, '_blank');
                    } else if (sources.length > 0) {
                        const fallback = sources[Math.floor(Math.random() * sources.length)];
                        window.open(fallback, '_blank');
                    }
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = `<span class="Button-content"><span class="Button-label">⏳ 测速中...</span></span>`;

                const newWindow = window.open('about:blank', '_blank');

                const results = await raceN(sources, 3, 2000);

                _globalSpeedTestCache = {
                    results: results.map(r => {
                        const prefix = RELEASE_PROXY_SOURCES.find(([p]) => r.url.startsWith(p))?.[0] || r.url.split('https://github.com')[0];
                        return { prefix, time: r.time, ok: r.ok };
                    }),
                    timestamp: Date.now()
                };

                fillGlobalProxySelect();
                saveSpeedCache();

                // 同步更新测速按钮悬浮提示
                const speedBtnEl = document.querySelector('.gh-speed-test-btn');
                if (speedBtnEl && _globalSpeedTestCache) {
                    const fastCount = _globalSpeedTestCache.results.filter(r => r.ok).length;
                    const age = formatTimeAgo(_globalSpeedTestCache.timestamp);
                    speedBtnEl.title = `测速完成: ${fastCount}/${_globalSpeedTestCache.results.length} 个可用（${age}）`;
                }

                const valid = results.filter(r => r.ok && r.time < MAX_PROXY_TIME).sort((a, b) => a.time - b.time);

                let downloadUrl = null;
                if (valid.length > 0) {
                    downloadUrl = valid[0].url;
                } else if (sources.length > 0) {
                    downloadUrl = sources[Math.floor(Math.random() * sources.length)];
                }

                if (downloadUrl) {
                    if (newWindow) {
                        newWindow.location.href = downloadUrl;
                    } else {
                        window.open(downloadUrl, '_blank');
                    }
                    btn.innerHTML = `<span class="Button-content"><span class="Button-label">⚡ 加速下载</span></span>`;
                } else {
                    if (newWindow) newWindow.close();
                    btn.innerHTML = `<span class="Button-content"><span class="Button-label">❌ 无可用代理</span></span>`;
                    setTimeout(() => {
                        btn.innerHTML = `<span class="Button-content"><span class="Button-label">⚡ 加速下载</span></span>`;
                    }, 2000);
                }
                btn.disabled = false;
            };
        });
    }

    // --- 更新日志手动折叠(默认展开) ---
    function processReleaseNotes() {
        document.querySelectorAll('.markdown-body.tmp-my-3:not(.gh-notes-processed)').forEach(el => {
            el.classList.add('gh-notes-processed');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gh-notes-toggle';
            btn.innerHTML = `<span class="gh-notes-chevron"></span>更新日志`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const collapsed = el.classList.toggle('gh-notes-collapsed');
                btn.classList.toggle('is-collapsed', collapsed);
            });
            el.parentNode.insertBefore(btn, el);
        });
    }

    function refreshDetailsUI(details) {
        if (isEnabled('groupAndSort')) formatAndSortUI(details);
        processProxyButtons(details);
    }

    function processReleaseBox(details) {
        if (details.dataset.boxProcessed === "true") return;
        details.dataset.boxProcessed = "true";
        _processedDetails.push(details);

        if (details.open) {
            refreshDetailsUI(details);
        }

        const summary = details.querySelector('summary');
        const titleSpan = summary ? (summary.querySelector('.d-inline-flex.flex-items-center') || summary) : null;

        // OS 切换下拉框
        if (isEnabled('groupAndSort') && titleSpan && !summary.dataset.osSelectInjected) {
            summary.dataset.osSelectInjected = 'true';

            const select = document.createElement('select');
            select.className = 'gh-os-select';
            OS_OPTIONS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.value === (_selectedOS || DEFAULT_OS)) option.selected = true;
                select.appendChild(option);
            });

            // 阻止点击下拉框时折叠/展开 details
            select.addEventListener('click', (e) => e.stopPropagation());
            select.addEventListener('mousedown', (e) => e.stopPropagation());

            select.addEventListener('change', () => {
                _selectedOS = select.value;
                // 同步所有下拉框的选中状态
                document.querySelectorAll('.gh-os-select').forEach(s => { s.value = _selectedOS; });
                // 强制重新排序所有已处理的 details
                reprocessAllDetails();
            });

            titleSpan.appendChild(select);
        }

        // 架构切换下拉框
        if (isEnabled('groupAndSort') && titleSpan && !summary.dataset.archSelectInjected) {
            summary.dataset.archSelectInjected = 'true';

            const archSelect = document.createElement('select');
            archSelect.className = 'gh-arch-select';
            ARCH_OPTIONS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.value === (_selectedArch || DEFAULT_ARCH)) option.selected = true;
                archSelect.appendChild(option);
            });

            // 阻止点击下拉框时折叠/展开 details
            archSelect.addEventListener('click', (e) => e.stopPropagation());
            archSelect.addEventListener('mousedown', (e) => e.stopPropagation());

            archSelect.addEventListener('change', () => {
                _selectedArch = archSelect.value;
                // 同步所有架构下拉框的选中状态
                document.querySelectorAll('.gh-arch-select').forEach(s => { s.value = _selectedArch; });
                reprocessAllDetails();
            });

            titleSpan.appendChild(archSelect);

            // 架构说明按钮
            const helpBtn = document.createElement('button');
            helpBtn.type = 'button';
            helpBtn.className = 'gh-arch-help-btn';
            helpBtn.textContent = '?';
            helpBtn.title = '架构说明';
            helpBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            helpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showArchHelp();
            });
            titleSpan.appendChild(helpBtn);

            // 代理测速按钮
            const speedBtn = document.createElement('button');
            speedBtn.type = 'button';
            speedBtn.className = 'gh-arch-help-btn gh-speed-test-btn';
            speedBtn.textContent = '⏱';
            if (_globalSpeedTestCache) {
                const fastCount = _globalSpeedTestCache.results.filter(r => r.ok).length;
                const age = formatTimeAgo(_globalSpeedTestCache.timestamp);
                speedBtn.title = `测速完成: ${fastCount}/${_globalSpeedTestCache.results.length} 个可用（${age}）`;
            } else {
                speedBtn.title = '代理测速';
            }
            speedBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            speedBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 获取当前 release 的第一个文件 URL 用于测速
                const firstFile = details.querySelector('a[href*="/releases/download/"], a[href*="/archive/"]');
                if (!firstFile) {
                    alert('当前没有可测速的文件');
                    return;
                }

                const originalUrl = new URL(firstFile.getAttribute('href'), window.location.origin).href;
                const normalized = originalUrl.replace(window.location.origin, '');
                const proxyUrls = RELEASE_PROXY_SOURCES.map(([prefix]) => ({ prefix, url: prefix + normalized }));

                speedBtn.disabled = true;
                speedBtn.textContent = '⏳';
                speedBtn.title = '测速中...';

                const results = await raceN(proxyUrls.map(p => p.url), 3, 2000);
                _globalSpeedTestCache = {
                    results: results.map(r => {
                        const prefix = RELEASE_PROXY_SOURCES.find(([p]) => r.url.startsWith(p))?.[0] || r.url.split('https://github.com')[0];
                        return { prefix, time: r.time, ok: r.ok };
                    }),
                    timestamp: Date.now()
                };

                // 填充全局下拉框
                fillGlobalProxySelect();
                saveSpeedCache();

                const fastCount = results.filter(r => r.ok).length;
                const age = formatTimeAgo(_globalSpeedTestCache.timestamp);
                speedBtn.title = `测速完成: ${fastCount}/${results.length} 个可用（${age}）`;
                speedBtn.textContent = '⏱';
                speedBtn.disabled = false;
            });

            titleSpan.appendChild(speedBtn);

            // 全局代理选择下拉框
            let globalProxySelect = titleSpan.querySelector('.gh-global-proxy-select');
            if (!globalProxySelect) {
                globalProxySelect = document.createElement('select');
                globalProxySelect.className = 'gh-global-proxy-select';
                globalProxySelect.style.display = 'none';
                globalProxySelect.style.marginLeft = '4px';
                globalProxySelect.style.fontSize = '12px';
                globalProxySelect.style.padding = '2px 6px';
                globalProxySelect.style.borderRadius = '4px';
                globalProxySelect.style.border = '1px solid var(--color-border-default, #30363d)';
                globalProxySelect.style.backgroundColor = 'var(--color-canvas-default, #0d1117)';
                globalProxySelect.style.color = 'var(--color-fg-default, #e6edf3)';
                titleSpan.appendChild(globalProxySelect);
            }

            // 有缓存时填充下拉框
            if (_globalSpeedTestCache) {
                fillGlobalProxySelect();
            }
        }

        const observer = new MutationObserver(() => {
            if (details.open) {
                refreshDetailsUI(details);
            }
        });
        observer.observe(details, { childList: true, subtree: true });

        details.addEventListener('toggle', () => {
            if (details.open) {
                refreshDetailsUI(details);
            }
        });
    }

    let _scrollTopBtn = null;
    function injectScrollToTopButton() {
        if (_scrollTopBtn) return;
        const btn = document.createElement('button');
        btn.className = 'gh-scroll-top-btn';
        btn.title = '回到顶部';
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.25a.75.75 0 0 1 .53.22l4.25 4.25a.75.75 0 1 1-1.06 1.06L8 6.06 4.28 9.78a.75.75 0 1 1-1.06-1.06L7.47 4.47a.75.75 0 0 1 .53-.22Z"></path></svg>`;
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(btn);
        _scrollTopBtn = btn;
        const updateVisibility = () => {
            const threshold = 300;
            btn.classList.toggle('gh-visible', window.scrollY > threshold);
        };
        window.addEventListener('scroll', updateVisibility, { passive: true });
        updateVisibility();
    }

    function init() {
        loadSpeedCache();
        injectCSS();
        injectScrollToTopButton();

        if (!/^\/[^\/]+\/[^\/]+\/releases/.test(window.location.pathname)) return;

        if (isEnabled('collapsibleNotes')) {
            processReleaseNotes();
        }

        const detailsElements = document.querySelectorAll('details');
        detailsElements.forEach(details => {
            const summary = details.querySelector('summary');
            if (summary && /Assets/i.test(summary.textContent) && isEnabled('groupAndSort')) {
                processReleaseBox(details);
            }
        });

        const showallElement = document.querySelector('.js-release-asset-untruncate-btn')
        if (showallElement) {
            showallElement.click()
        }
    }

    init();
    document.addEventListener('turbo:load', init);
    document.addEventListener('pjax:end', init);

})();