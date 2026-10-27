const fs = require('fs');
const path = require('path');
// 导出插件功能
window.exports = {
    'html': {
        mode: 'none',
        args: {
            // 进入插件时调用
            enter: ({ code, type, payload = '' }) => {
                const HtmlFile = path.join(__dirname, 'to-render.html');
                fs.writeFileSync(HtmlFile, payload);
                ztools.shellOpenExternal(HtmlFile);
                ztools.outPlugin();
            }
        }
    }
}