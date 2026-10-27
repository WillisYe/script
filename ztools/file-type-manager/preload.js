const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// 默认文件类型
const DEFAULT_FILE_TYPES = [
  { id: 'image', name: '图片', icon: '', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'], color: '#FF6B6B', description: 'JPG, PNG, GIF, BMP, WEBP, SVG 等' },
  { id: 'video', name: '视频', icon: '', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'mpeg', 'rmvb'], color: '#4ECDC4', description: 'MP4, AVI, MKV, MOV, WMV 等' },
  { id: 'audio', name: '音频', icon: '', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'], color: '#45B7D1', description: 'MP3, WAV, FLAC, AAC, OGG 等' },
  { id: 'browser-ext', name: '浏览器插件', icon: '', extensions: ['crx'], color: '#96CEB4', description: 'Chrome 扩展' },
  { id: 'vscode-ext', name: 'VSCode插件', icon: '', extensions: ['vsix'], color: '#5DADE2', description: 'VS Code 扩展' },
  { id: 'word', name: 'Word', icon: '', extensions: ['doc', 'docx'], color: '#2E86AB', description: 'Word 文档' },
  { id: 'excel', name: 'Excel', icon: '', extensions: ['xls', 'xlsx'], color: '#27AE60', description: 'Excel 表格' }
];

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { fileTypes: JSON.parse(JSON.stringify(DEFAULT_FILE_TYPES)) };
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// 尝试查找 Everything CLI 工具 es.exe
function findEverythingCli() {
  const esPaths = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Everything', 'es.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Everything', 'es.exe'),
    path.join(__dirname, 'es.exe'),
    path.join(process.env.USERPROFILE || '', 'es.exe'),
    'C:\\Program Files\\Everything\\es.exe',
    'C:\\Program Files (x86)\\Everything\\es.exe',
    'D:\\_other\\下载\\Everything-SDK\\es.exe'
  ];

  for (const p of esPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Everything 搜索（唯一搜索方式）
function scanWithEverything(extensions) {
  return new Promise((resolve, reject) => {
    const esPath = findEverythingCli();
    if (!esPath) {
      reject(new Error('Everything CLI (es.exe) not found. Please install Everything from https://www.voidtools.com and download the command-line tool.'));
      return;
    }

    // 构建搜索命令：es.exe -n 500000 ext:mp3;wav;flac !$Recycle.Bin
    const extPattern = extensions.map(e => e).join(';');
    const command = `"${esPath}" -n 500000 ext:${extPattern} !"$Recycle.Bin" !Recycled !Recycler`;

    console.log('Everything search:', command);

    exec(command, { maxBuffer: 100 * 1024 * 1024, timeout: 60000, encoding: 'buffer' }, (error, stdout) => {
      if (error) {
        console.error('Everything search error:', error);
        reject(error);
        return;
      }

      try {
        // 使用 GBK 解码中文路径（如果 iconv-lite 可用）
        let output;
        try {
          const iconv = require(path.join(__dirname, 'node_modules', 'iconv-lite'));
          output = iconv.decode(stdout, 'gbk');
          console.log('iconv-lite decoded successfully');
        } catch (e) {
          console.warn('iconv-lite decode failed:', e.message);
          output = stdout.toString('utf-8');
        }

        const lines = output.trim().split('\n').filter(line => line.trim());
        console.log('Everything raw results:', lines.length, 'files');

        const dirCounts = new Map();

        // 回收站路径关键词（大小写不敏感）
        const recycleKeywords = ['$Recycle.Bin', 'Recycled', 'Recycler'];

        for (const line of lines) {
          const filePath = line.trim();
          if (!filePath) continue;

          // 过滤掉回收站中的文件
          const isRecycle = recycleKeywords.some(keyword =>
            filePath.toLowerCase().includes(keyword.toLowerCase())
          );
          if (isRecycle) continue;

          const dir = path.dirname(filePath);
          dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
        }

        const results = Array.from(dirCounts.entries())
          .map(([dirPath, count]) => ({ path: dirPath, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        console.log('Everything results:', results.length, 'directories');
        resolve(results);
      } catch (e) {
        console.error('Parse Everything output error:', e);
        reject(e);
      }
    });
  });
}

// 查找包含特定扩展名最多的目录（仅使用 Everything）
function findTopDirectories(extensions) {
  return scanWithEverything(extensions);
}

// 打开目录
function openDirectory(dirPath) {
  return new Promise((resolve, reject) => {
    exec(`explorer "${dirPath}"`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

// 创建桌面快捷方式
function createShortcut(dirPath, name, iconEmoji) {
  return new Promise((resolve, reject) => {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutName = (iconEmoji ? iconEmoji + ' ' : '') + name;
    // 清理文件名中的非法字符
    const safeName = shortcutName.replace(/[<>:"\\/|?*]/g, '_');
    const shortcutPath = path.join(desktopPath, `${safeName}.lnk`);

    // 使用 PowerShell 创建快捷方式
    const psCommand = `
      $WshShell = New-Object -comObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
      $Shortcut.TargetPath = '${dirPath.replace(/'/g, "''")}'
      $Shortcut.WorkingDirectory = '${dirPath.replace(/'/g, "''")}'
      $Shortcut.Description = '快捷方式到 ${name.replace(/'/g, "''")}'
      $Shortcut.Save()
    `;

    const encodedScript = Buffer.from(psCommand, 'utf16le').toString('base64');
    const command = `powershell.exe -NoProfile -EncodedCommand ${encodedScript}`;

    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(shortcutPath);
      }
    });
  });
}

// 暴露服务
window.services = {
  loadConfig,
  saveConfig,
  findTopDirectories,
  openDirectory,
  createShortcut
};
