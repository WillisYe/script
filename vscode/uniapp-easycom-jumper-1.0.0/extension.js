const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * 激活插件
 */
function activate(context) {
    const provider = new EasycomDefinitionProvider();

    const disposable = vscode.languages.registerDefinitionProvider(
        { scheme: 'file', language: 'vue' },
        provider
    );

    context.subscriptions.push(disposable);

    console.log('UniApp Easycom Jumper 已激活');
}

/**
 * 解析路径别名
 */
function resolveAlias(filePath, aliasMap, workspaceRoot) {
    for (const [prefix, replacement] of Object.entries(aliasMap)) {
        if (filePath.startsWith(prefix)) {
            const resolved = path.join(workspaceRoot, replacement, filePath.slice(prefix.length));
            return resolved;
        }
    }
    return filePath;
}

/**
 * 读取并解析 pages.json 中的 easycom 配置
 */
function getEasycomConfig(document) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(document.uri.fsPath);
    if (!workspaceRoot) return null;

    const config = vscode.workspace.getConfiguration('uniappEasycom');
    const pagesJsonPath = config.get('pagesJsonPath', 'src/pages.json');
    const aliasConfig = config.get('alias', { '@': 'src', '~': 'src' });

    const fullPath = path.isAbsolute(pagesJsonPath)
        ? pagesJsonPath
        : path.join(workspaceRoot, pagesJsonPath);

    if (!fs.existsSync(fullPath)) {
        // 默认 easycom 规则
        return {
            autoscan: true,
            custom: {},
            alias: aliasConfig,
            workspaceRoot
        };
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // 去除注释（简单处理）
        const cleanContent = content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        const pagesConfig = JSON.parse(cleanContent);

        return {
            autoscan: pagesConfig.easycom?.autoscan !== false, // 默认 true
            custom: pagesConfig.easycom?.custom || {},
            alias: aliasConfig,
            workspaceRoot
        };
    } catch (e) {
        console.error('解析 pages.json 失败:', e);
        return {
            autoscan: true,
            custom: {},
            alias: aliasConfig,
            workspaceRoot
        };
    }
}

/**
 * 根据 easycom 规则查找组件文件
 */
function findComponentFile(componentName, easycomConfig) {
    const { autoscan, custom, alias, workspaceRoot } = easycomConfig;
    const candidates = [];

    // 1. 先检查自定义规则
    for (const [pattern, template] of Object.entries(custom)) {
        const regex = new RegExp(pattern);
        const match = componentName.match(regex);
        if (match) {
            // 替换模板中的占位符
            let filePath = template;
            // $1, $2... 替换
            for (let i = 1; i < match.length; i++) {
                filePath = filePath.replace(new RegExp('\\$' + i, 'g'), match[i] || '');
            }
            // 解析别名
            filePath = resolveAlias(filePath, alias, workspaceRoot);
            candidates.push(filePath);
        }
    }

    // 2. 默认 autoscan 规则: components/组件名/组件名.vue
    if (autoscan && candidates.length === 0) {
        const defaultPaths = [
            path.join(workspaceRoot, 'components', componentName, componentName + '.vue'),
            path.join(workspaceRoot, 'src', 'components', componentName, componentName + '.vue'),
            path.join(workspaceRoot, 'components', componentName + '.vue'),
            path.join(workspaceRoot, 'src', 'components', componentName + '.vue'),
        ];
        candidates.push(...defaultPaths);
    }

    // 3. 检查文件是否存在（优先返回第一个存在的）
    for (const candidate of candidates) {
        const extensions = ['.vue', '.nvue', '.uvue'];
        // 如果已经有扩展名，直接检查
        if (path.extname(candidate)) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } else {
            // 尝试加扩展名
            for (const ext of extensions) {
                const withExt = candidate + ext;
                if (fs.existsSync(withExt)) {
                    return withExt;
                }
            }
        }
    }

    return null;
}

/**
 * 判断位置是否在 template 区域内
 */
function isInTemplate(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);

    const templateStart = text.indexOf('<template');
    const templateEnd = text.indexOf('</template>');

    if (templateStart === -1 || templateEnd === -1) return false;

    return offset > templateStart && offset < templateEnd;
}

/**
 * 获取当前位置的组件名（标签名）
 */
function getComponentNameAtPosition(document, position) {
    const line = document.lineAt(position.line).text;
    const char = position.character;

    // 先按整行中的标签起始位置扫描，确保在标签名任意位置点击时都能拿到完整组件名
    const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/g;
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const start = match.index + 1;
        const end = start + match[2].length;
        if (char >= start && char <= end) {
            return match[2];
        }
    }

    // 兜底：当光标位于标签名中间时，拼接前后字符串得到完整标签名
    const before = line.slice(0, char);
    const after = line.slice(char);
    const tagStartMatch = before.match(/<\s*(\/?)([a-zA-Z][a-zA-Z0-9-]*)$/);
    const afterMatch = after.match(/^([a-zA-Z0-9-]*)/);

    if (tagStartMatch && afterMatch) {
        const fullName = tagStartMatch[2] + afterMatch[1];
        if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(fullName)) {
            return fullName;
        }
    }

    return null;
}

/**
 * 判断是否是 HTML 内置标签（跳过这些）
 */
function isHtmlTag(name) {
    const htmlTags = new Set([
        'view', 'text', 'image', 'button', 'input', 'textarea', 'scroll-view',
        'swiper', 'swiper-item', 'navigator', 'rich-text', 'progress', 'checkbox',
        'checkbox-group', 'radio', 'radio-group', 'switch', 'slider', 'picker',
        'picker-view', 'picker-view-column', 'form', 'label', 'template', 'slot',
        'block', 'cover-view', 'cover-image', 'movable-area', 'movable-view',
        'icon', 'canvas', 'map', 'video', 'audio', 'camera', 'live-player',
        'live-pusher', 'web-view', 'official-account', 'open-data',
        // 标准 HTML 标签
        'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td',
        'th', 'thead', 'tbody', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr',
        'strong', 'em', 'i', 'b', 'pre', 'code', 'section', 'article', 'aside',
        'header', 'footer', 'main', 'nav', 'figure', 'figcaption'
    ]);
    return htmlTags.has(name.toLowerCase());
}

class EasycomDefinitionProvider {
    provideDefinition(document, position, token) {
        // 1. 检查是否在 template 中
        if (!isInTemplate(document, position)) {
            return null;
        }

        // 2. 获取组件名
        const componentName = getComponentNameAtPosition(document, position);
        if (!componentName) {
            return null;
        }

        // 3. 跳过内置标签
        if (isHtmlTag(componentName)) {
            return null;
        }

        // 4. 获取 easycom 配置
        const easycomConfig = getEasycomConfig(document);
        if (!easycomConfig) {
            return null;
        }

        // 5. 查找组件文件
        const filePath = findComponentFile(componentName, easycomConfig);
        if (!filePath) {
            return null;
        }

        // 6. 返回定义位置
        const uri = vscode.Uri.file(filePath);
        return new vscode.Location(uri, new vscode.Position(0, 0));
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
