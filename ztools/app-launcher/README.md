# 应用启动器 (App Launcher)

一个用于搜索和启动本地 Windows 应用程序的 ZTools 插件。

## 功能

- **应用搜索**: 使用 Everything 搜索本地应用程序（如：`exe music` 搜索包含 "music" 的应用）
- **快速启动**: 在搜索结果列表中直接点击启动应用
- **历史记录**: 当搜索结果为空或关键词为空时，显示最近启动的应用
- **备用搜索**: 当 Everything 不可用时，自动切换到目录搜索模式

## 使用方法

1. 在 ZTools 主界面输入关键词：
   - `exe music` - 搜索包含 "music" 的应用
   - `exe` 或 `app` - 显示最近启动的应用

2. 选择并启动应用

## 依赖

### Everything 命令行工具（推荐用于快速搜索）

**重要说明**：`es.exe` 不包含在 Everything SDK 中，它是一个独立的工具。

1. **下载 Everything 主程序**：https://www.voidtools.com/zh-cn/downloads/
   - 安装并运行 Everything（必须在后台运行）

2. **下载 es.exe（命令行工具）**：https://www.voidtools.com/zh-cn/downloads/#cli
   - 64位版本：https://www.voidtools.com/ES-1.1.0.30.x64.zip (67 KB)
   - 32位版本：https://www.voidtools.com/ES-1.1.0.30.x86.zip (56 KB)

3. **解压并放置 es.exe**：
   将 `es.exe` 放置在以下任意位置之一：
   - `C:\Program Files\Everything\es.exe`
   - `C:\Program Files (x86)\Everything\es.exe`
   - 插件目录：`app-launcher/es.exe`
   - 用户主目录：`es.exe`
   - 您的自定义路径：`E:\_other\下载\Everything-SDK\es.exe`

### 备用搜索方法
如果未找到 `es.exe`，插件将使用目录搜索（速度较慢）：
- 搜索常见应用目录：`Program Files`、`Program Files (x86)`、开始菜单等

## 技术细节

- 搜索最近启动的应用列表存储在 `preload/app-history.json`
- 最多保存 20 条历史记录
- 支持 `.exe`, `.bat`, `.cmd` 可执行文件

## 开发

插件使用 Node.js preload 脚本实现搜索和启动功能。
