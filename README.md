# dsh-comfyui

ComfyUI 按需启停的 DSH 插件：画图前拉起本地生图服务，闲置自动休眠释放显存

## 包含

- comfyui-pilot：起服务、用完自动关，走 127.0.0.1:8188，不依赖任何 API key

## 安装

每个子目录都是独立的 DSH bundle，分别安装：

    plugin_manager install_bundle "<path>\<subdir>"

## 说明

本仓库是归档：源码的活体在工作区，这里随发版同步。
