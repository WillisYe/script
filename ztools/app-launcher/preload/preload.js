const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 尝试加载 iconv-lite，如果失败则使用默认解码
let iconv = null;
try {
  iconv = require('iconv-lite');
} catch (e) {
  console.log('iconv-lite not available, using default encoding');
}

// 最近启动的应用记录 (存储在本地文件)
const HISTORY_FILE = path.join(__dirname, 'app-history.json');
const MAX_HISTORY = 20;

// 常用应用别名映射（中文、英文、拼音、缩写）
const APP_ALIASES = {
  // 钉钉
  '钉钉': ['DingtalkLauncher', 'DingDing'],
  'dingding': ['DingtalkLauncher', 'DingDing'],
  'dd': ['DingtalkLauncher', 'DingDing'],
  '钉钉dingding': ['DingtalkLauncher', 'DingDing'],
  // 微信
  '微信': ['WeChat', 'wechat', 'weixin'],
  'wechat': ['WeChat', '微信', 'weixin'],
  'weixin': ['WeChat', '微信', 'wechat'],
  'wx': ['WeChat', '微信', 'wechat'],
  // QQ
  'qq': ['QQ', 'qq'],
  '腾讯qq': ['QQ'],
  // 浏览器
  'chrome': ['chrome', '谷歌浏览器', 'Google Chrome'],
  '谷歌': ['chrome', '谷歌浏览器'],
  'edge': ['msedge', 'Edge', 'Microsoft Edge'],
  'firefox': ['firefox', '火狐浏览器', 'Mozilla Firefox'],
  '火狐': ['firefox', '火狐浏览器'],
  // VS Code
  'vscode': ['Code', 'Visual Studio Code', 'VS Code'],
  'code': ['Code', 'Visual Studio Code'],
  // 其他常用应用
  'notepad': ['notepad', '记事本'],
  '记事本': ['notepad'],
  'calc': ['calc', '计算器'],
  '计算器': ['calc'],
  'explorer': ['explorer', '资源管理器'],
  '资源管理器': ['explorer'],
  'cmd': ['cmd', '命令提示符'],
  'powershell': ['powershell', 'PowerShell'],
  'terminal': ['WindowsTerminal', 'Windows Terminal', '终端'],
  '终端': ['WindowsTerminal', 'Windows Terminal'],
  'idea': ['idea', 'IntelliJ IDEA', 'idea64'],
  'eclipse': ['eclipse', 'Eclipse'],
  'navicat': ['navicat', 'Navicat'],
  'postman': ['postman', 'Postman'],
  'fiddler': ['fiddler', 'Fiddler'],
  'git': ['git', 'Git Bash'],
  'vmware': ['vmware', 'VMware', 'vmware.exe'],
  'virtualbox': ['VirtualBox', 'VirtualBox VM'],
  'photoshop': ['photoshop', 'Photoshop', 'Adobe Photoshop', 'ps'],
  'word': ['winword', 'Word', 'Microsoft Word'],
  'excel': ['excel', 'Excel', 'Microsoft Excel'],
  'ppt': ['powerpnt', 'PowerPoint', 'Microsoft PowerPoint'],
  'powerpoint': ['powerpnt', 'PowerPoint', 'Microsoft PowerPoint'],
  'outlook': ['outlook', 'Outlook', 'Microsoft Outlook'],
  'teams': ['msteams', 'Teams', 'Microsoft Teams'],
  'zoom': ['Zoom', 'zoom.exe'],
  'feishu': ['feishu', '飞书', 'lark'],
  '飞书': ['feishu', 'lark'],
  'tim': ['TIM', 'tim.exe'],
  'bilibili': ['bili', 'bilibili', '哔哩哔哩'],
  'bili': ['bili', 'bilibili', '哔哩哔哩'],
  '网易云': ['cloudmusic', 'netease', '网易云音乐'],
  'music': ['cloudmusic', 'netease', 'qqmusic'],
  'qqmusic': ['qqmusic', 'QQ音乐'],
  'QQ音乐': ['qqmusic'],
  'vs': ['devenv', 'Visual Studio', 'IDE'],
  'visualstudio': ['devenv', 'Visual Studio']
};

// 应用显示名称映射（exe文件名 -> 中文显示名）
const APP_DISPLAY_NAMES = {
  'DingtalkLauncher.exe': '钉钉',
  'WeChat.exe': '微信',
  'QQ.exe': 'QQ',
  'TIM.exe': 'TIM',
  'chrome.exe': '谷歌浏览器',
  'msedge.exe': 'Microsoft Edge',
  'firefox.exe': '火狐浏览器',
  'Code.exe': 'Visual Studio Code',
  'idea64.exe': 'IntelliJ IDEA',
  'eclipse.exe': 'Eclipse',
  'Navicat.exe': 'Navicat',
  'Postman.exe': 'Postman',
  'Fiddler.exe': 'Fiddler',
  'vmware.exe': 'VMware',
  'VirtualBox.exe': 'VirtualBox',
  'photoshop.exe': 'Adobe Photoshop',
  'winword.exe': 'Microsoft Word',
  'excel.exe': 'Microsoft Excel',
  'powerpnt.exe': 'Microsoft PowerPoint',
  'outlook.exe': 'Microsoft Outlook',
  'msteams.exe': 'Microsoft Teams',
  'Zoom.exe': 'Zoom',
  'feishu.exe': '飞书',
  'lark.exe': '飞书',
  'bilibili.exe': '哔哩哔哩',
  'cloudmusic.exe': '网易云音乐',
  'qqmusic.exe': 'QQ音乐',
  'devenv.exe': 'Visual Studio',
  'WindowsTerminal.exe': 'Windows Terminal',
  'explorer.exe': '资源管理器',
  'notepad.exe': '记事本',
  'calc.exe': '计算器'
};

// 获取应用显示名称
function getAppDisplayName(exeName) {
  return APP_DISPLAY_NAMES[exeName] || exeName;
}

// 读取历史记录
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
}

// 保存历史记录
function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// 添加到历史记录
function addToHistory(appPath, keyword = '') {
  const history = loadHistory();

  // 移除已存在的相同路径
  const index = history.findIndex(item => item.path === appPath);
  if (index > -1) {
    history.splice(index, 1);
  }

  // 计算匹配度（如果有搜索关键词）
  const item = {
    path: appPath,
    name: getAppDisplayName(path.basename(appPath)),
    timestamp: Date.now()
  };

  if (keyword) {
    item.score = calculateMatchScore(item, keyword);
  }

  // 添加到开头
  history.unshift(item);

  // 限制历史记录数量
  if (history.length > MAX_HISTORY) {
    history.splice(MAX_HISTORY);
  }

  saveHistory(history);
}

// 获取最近启动的应用
function getRecentApps() {
  return loadHistory();
}

// 启动应用程序
function launchApp(appPath, keyword = '') {
  return new Promise((resolve, reject) => {
    // 添加到历史记录
    addToHistory(appPath, keyword);

    // 启动应用
    const command = `start "" "${appPath}"`;
    exec(command, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

// 执行命令
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

// 打开文件位置
function openFileLocation(filePath) {
  return new Promise((resolve, reject) => {
    // 使用 explorer /select 命令在资源管理器中选中文件
    // 路径需要用引号包裹以处理空格
    const command = `explorer /select,"${filePath}"`;
    exec(command, { windowsHide: true }, (error) => {
      if (error) {
        console.error('Failed to open file location:', error);
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

// 更新历史记录顺序
function updateHistoryOrder(history) {
  saveHistory(history);
}

// 从历史记录删除
function deleteFromHistory(appPath) {
  const history = loadHistory();
  const index = history.findIndex(item => item.path === appPath);
  if (index > -1) {
    history.splice(index, 1);
    saveHistory(history);
  }
}

// 使用 Everything 搜索应用程序
function searchWithEverything(keyword) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // 尝试查找 Everything 的命令行工具 es.exe
    // es.exe 下载地址: https://www.voidtools.com/zh-cn/downloads/#cli
    const esPaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Everything', 'es.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Everything', 'es.exe'),
      path.join(__dirname, 'es.exe'),  // 放在插件目录
      path.join(process.env.USERPROFILE || '', 'es.exe'),  // 用户目录
      'D:\\_other\\下载\\Everything-SDK\\es.exe'  // 用户指定的路径
    ].filter(Boolean);

    const findStartTime = Date.now();
    let esPath = null;
    for (const p of esPaths) {
      if (fs.existsSync(p)) {
        esPath = p;
        break;
      }
    }
    const findTime = Date.now() - findStartTime;

    if (!esPath) {
      // es.exe 不存在，返回错误，使用备用搜索方案
      reject(new Error('Everything command-line tool (es.exe) not found'));
      return;
    }

    // 使用 es.exe 搜索
    // es.exe 语法: es.exe [options] pattern
    // 下载地址: https://www.voidtools.com/ES-1.1.0.30.x64.zip
    // -n 50000: 最多返回 50000 个结果
    // 搜索所有 exe 文件，然后在解析时过滤
    const searchCommand = `"${esPath}" -n 50000 *.exe`;
    const searchStartTime = Date.now();

    exec(searchCommand, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      const searchTime = Date.now() - searchStartTime;
      const totalTime = Date.now() - startTime;

      if (error) {
        console.error('es.exe search failed:', error);
        reject(error);
        return;
      }

      try {
        const output = iconv ? iconv.decode(stdout, 'gbk') : stdout.toString('utf-8');
        const results = parseEverythingResults(output, keyword);

        // 打印性能统计
        console.log(`[Performance] Find es.exe: ${findTime}ms, Search .exe files: ${searchTime}ms, Total: ${totalTime}ms, Results: ${results.length}`);
        resolve(results);
      } catch (e) {
        console.error('Failed to parse es.exe output:', e);
        reject(e);
      }
    });
  });
}

// 解析 Everything 搜索结果（支持别名过滤）
function parseEverythingResults(output, keyword) {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const results = [];
  const seenPaths = new Set(); // 用于去重

  // 加载历史记录用于加分
  const history = loadHistory();
  const historyPaths = new Set(history.map(item => item.path.toLowerCase()));

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和不是有效路径的行
    if (!trimmed || !path.isAbsolute(trimmed)) {
      continue;
    }

    // 去重：如果路径已存在，跳过
    if (seenPaths.has(trimmed.toLowerCase())) {
      continue;
    }
    seenPaths.add(trimmed.toLowerCase());

    const ext = path.extname(trimmed).toLowerCase();
    const appName = path.basename(trimmed);

    // 只包含可执行文件，并且匹配关键词（使用别名匹配）
    if (['.exe', '.bat', '.cmd', '.lnk'].includes(ext)) {
      // 检查文件名或路径是否匹配关键词
      if (!keyword || checkAliasMatch(keyword, appName, trimmed)) {
        // 检查是否在历史记录中
        const inHistory = historyPaths.has(trimmed.toLowerCase());

        // 计算匹配度分数
        const score = calculateMatchScore(
          { name: getAppDisplayName(appName), path: trimmed, inHistory: inHistory },
          keyword
        );

        results.push({
          name: getAppDisplayName(appName),
          path: trimmed,
          score: score,
          inHistory: inHistory
        });
      }
    }
  }

  return results;
}

// 检查是否匹配别名
function checkAliasMatch(keyword, appName, fullPath = '') {
  keyword = keyword.toLowerCase();
  appName = appName.toLowerCase();
  const lowerPath = fullPath.toLowerCase();

  // 1. 直接匹配文件名
  if (appName.includes(keyword)) {
    return true;
  }

  // 2. 直接匹配完整路径（用于匹配目录名）
  if (fullPath && lowerPath.includes(keyword)) {
    return true;
  }

  // 3. 检查别名 - 查找所有可能的目标
  for (const [alias, targets] of Object.entries(APP_ALIASES)) {
    const lowerAlias = alias.toLowerCase();

    // 如果关键词匹配某个别名，则检查该别名对应的所有目标
    if (lowerAlias === keyword || keyword.includes(lowerAlias)) {
      for (const target of targets) {
        const lowerTarget = target.toLowerCase();
        // 检查文件名是否包含目标（不区分大小写）
        if (appName.includes(lowerTarget)) {
          return true;
        }
        // 检查路径是否包含目标
        if (fullPath && lowerPath.includes(lowerTarget)) {
          return true;
        }
      }
    }
  }

  return false;
}

// 主搜索函数
async function searchApps(keyword) {
  const trimmedKeyword = keyword.trim();

  // 如果关键词为空，返回最近启动的应用
  if (!trimmedKeyword) {
    return getRecentApps();
  }

  // 使用 Everything 搜索
  try {
    const everythingResults = await searchWithEverything(trimmedKeyword);
    // 对结果进行排序：先按匹配度排序，再按版本号排序
    if (everythingResults.length > 0) {
      return sortResults(everythingResults, trimmedKeyword);
    }
  } catch (e) {
    console.log('Everything search failed:', e.message);
  }

  // 如果没有搜索结果，返回空数组
  return [];
}

// 智能排序：先按匹配度，再按版本号
function sortResults(results, keyword) {
  return results.sort((a, b) => {
    // 计算匹配度
    const scoreA = calculateMatchScore(a, keyword);
    const scoreB = calculateMatchScore(b, keyword);

    // 先按匹配度排序（降序：匹配度高的在前）
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    // 匹配度相同时，按版本号排序
    const versionA = extractVersion(a.path);
    const versionB = extractVersion(b.path);

    if (versionA === null && versionB === null) return 0;
    if (versionA === null) return 1;
    if (versionB === null) return -1;

    return compareVersions(versionB, versionA); // 降序：新版本在前
  });
}

// 计算匹配度分数
function calculateMatchScore(item, keyword) {
  const lowerKeyword = keyword.toLowerCase();
  const lowerName = item.name.toLowerCase();
  const lowerPath = item.path.toLowerCase();

  let score = 0;

  // 0. 历史记录加分（如果在历史记录中，额外加分）
  if (item.inHistory) {
    score += 50;
  }

  // 0.1 文件名长度加分（文件名越短，分数越高，优先短文件名）
  // 例如：bun.exe 比 bunzip2.exe 更短，得分更高
  const nameLength = lowerName.length;
  const nameLengthScore = Math.max(0, 100 - nameLength * 2);
  score += nameLengthScore;

  // 0.2 路径长度加分（路径越短，分数越高）
  const pathLength = item.path.length;
  const lengthScore = Math.max(0, Math.min(100, 100 - (pathLength / 2)));
  score += lengthScore;

  // 0.3 路径中包含以.开头的目录扣分
  const pathParts = item.path.split(/[/\\]/);
  const hasDotDirectory = pathParts.some(part => part.startsWith('.'));
  if (hasDotDirectory) {
    score -= 30;
  }

  // 1. 精确匹配文件名（最高分）
  if (lowerName === lowerKeyword) {
    score += 100;
  }

  // 1.1 文件名精确匹配关键词（加分词+ .exe）
  if (lowerName === lowerKeyword + '.exe') {
    score += 150;
  }

  // 2. 文件名以关键词开头（但后面还有其他字符，扣分）
  if (lowerName.startsWith(lowerKeyword)) {
    // 如果是精确匹配（关键词就是整个文件名去掉.exe），已经在上面的1.1处理
    // 这里处理"bun"匹配"bunzip2.exe"的情况
    const remainingChars = lowerName.length - lowerKeyword.length;
    if (remainingChars > 4) {
      // 剩余字符较多，说明不是紧密匹配，扣分
      score += 80 - remainingChars * 5;
    } else if (remainingChars > 0) {
      // 少量剩余字符
      score += 80;
    } else {
      score += 80;
    }
  }
  // 文件名以关键词结尾
  else if (lowerName.endsWith(lowerKeyword)) {
    score += 60;
  }
  // 文件名包含关键词
  else if (lowerName.includes(lowerKeyword)) {
    score += 40;
  }

  // 3. 别名匹配
  for (const [alias, targets] of Object.entries(APP_ALIASES)) {
    const lowerAlias = alias.toLowerCase();
    if (lowerAlias.includes(lowerKeyword) || lowerKeyword.includes(lowerAlias)) {
      for (const target of targets) {
        const lowerTarget = target.toLowerCase();
        // 检查文件名是否匹配别名目标
        if (lowerName.includes(lowerTarget)) {
          // 完全匹配目标
          if (lowerName === lowerTarget + '.exe') {
            score += 90;
          }
          // 以目标开头
          else if (lowerName.startsWith(lowerTarget)) {
            score += 70;
          }
          // 包含目标
          else {
            score += 50;
          }
        }
      }
    }
  }

  // 4. 路径匹配
  if (lowerPath.includes(lowerKeyword)) {
    score += 20;
  }

  // 确保分数不为负数
  score = Math.max(0, score);

  return score;
}

// 从路径中提取版本号
function extractVersion(filePath) {
  // 匹配类似 [3.9.12.51] 或 3.9.12.51 的版本号
  const versionRegex = /\[(\d+(?:\.\d+)*)\]|(\d+(?:\.\d+){3})/;
  const match = filePath.match(versionRegex);

  if (match) {
    return match[1] || match[2];
  }

  // 尝试匹配路径中的数字版本（如 WeChat/3.9.12.51/）
  const pathVersionRegex = /\/(\d+(?:\.\d+)+)\//;
  const pathMatch = filePath.match(pathVersionRegex);

  return pathMatch ? pathMatch[1] : null;
}

// 比较两个版本号
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

// 向渲染进程暴露服务
window.services = {
  searchApps,
  launchApp,
  getRecentApps,
  executeCommand,
  openFileLocation,
  updateHistoryOrder,
  deleteFromHistory
};
