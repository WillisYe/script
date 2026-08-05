# UniApp Easycom Jumper

支持 uni-app easycom 组件自动引入模式的 VS Code 点击跳转插件。

## 功能

- 在 `.vue` 文件的 `<template>` 中，按住 `Ctrl`（Mac `Cmd`）点击组件标签名，直接跳转到对应组件定义文件
- 支持 `pages.json` 中自定义的 `easycom` 规则
- 支持路径别名（`@/`, `~/` 等）
- 支持 `.vue` / `.nvue` / `.uvue` 扩展名

## 安装

### 方式一：本地安装

1. 将本文件夹复制到 VS Code 扩展目录：
   - Windows: `%USERPROFILE%\.vscode\extensions\`
   - macOS: `~/.vscode/extensions/`
   - Linux: `~/.vscode/extensions/`

2. 重启 VS Code

### 方式二：开发模式加载

1. 按 `Ctrl+Shift+P`（Mac `Cmd+Shift+P`）
2. 输入 `Extensions: Install from VSIX`
3. 或按 `F5` 在 Extension Host 中调试

## 打包为 VSIX

如果你需要把插件发布成 `.vsix` 安装包，可以按下面步骤操作：

1. 进入插件目录：

```bash
cd niapp-easycom-jumper-1.0.0
```

2. 直接使用 `npx` 执行打包命令：

```bash
npx @vscode/vsce package
```

执行成功后，会在当前目录生成类似：

```text
uniapp-easycom-jumper-1.0.0.vsix
```

然后可以在 VS Code 中通过 `Extensions: Install from VSIX` 进行安装。

## 发布到 VS Code Marketplace

如果你打算发布到 Marketplace，需要先准备好：

- `publisher` 已填写
- `LICENSE` 已提供
- `README.md` 已完善
- `npx @vscode/vsce` 可用

发布命令如下：

```bash
npx @vscode/vsce publish
```

如果是第一次发布，通常需要先登录：

```bash
npx @vscode/vsce login uniapp-helper
```

然后按照提示完成 Azure DevOps 账号登录。

## 配置

在 VS Code 设置中搜索 `uniappEasycom`：

```json
{
  "uniappEasycom.pagesJsonPath": "pages.json",
  "uniappEasycom.alias": {
    "@": "src",
    "~": "src"
  }
}
```

## 支持的 easycom 规则

### 默认规则（autoscan）

组件放在 `components/组件名/组件名.vue` 目录下即可自动识别。

### 自定义规则

支持 `pages.json` 中的 `easycom.custom`：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^uni-(.*)": "@/components/uni-$1.vue",
      "^my-(.*)": "@/components/my-$1/index.vue"
    }
  }
}
```

## 使用

在任意 `.vue` 文件中，将光标放在 `<template>` 内的组件标签名上：

```vue
<template>
  <view>
    <my-button />  <!-- Ctrl+点击跳转到 components/my-button/my-button.vue -->
    <uni-card />   <!-- Ctrl+点击跳转到 components/uni-card/uni-card.vue -->
  </view>
</template>
```
