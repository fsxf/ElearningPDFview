# 复旦 eLearning PDF 预览

这是一个面向复旦 eLearning SpeedGrader 的 Tampermonkey 用户脚本。它在 PDF 提交文件旁增加“预览 PDF”按钮，无需先把文件保存到电脑即可查看内容，同时保留网站原有的下载入口。

## 直接安装

1. 在 Chrome 中从官方渠道安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点击[安装复旦 eLearning PDF 预览脚本](https://raw.githubusercontent.com/fsxf/ElearningPDFview/main/fudan-elearning-pdf-preview.user.js)。
3. Tampermonkey 打开安装页面后，检查脚本权限并选择“安装”。
4. 刷新 eLearning 的 SpeedGrader 页面。

后续发布新版本时，Tampermonkey 会从本仓库检查脚本更新。

## 手动安装

1. 在 Chrome 中安装 Tampermonkey。
2. 打开 Tampermonkey 控制面板，选择“添加新脚本”。
3. 删除编辑器中的示例内容。
4. 将 `fudan-elearning-pdf-preview.user.js` 的全部内容粘贴进去并保存。
5. 刷新 eLearning 页面。

识别到 PDF 后，文件名旁会出现“预览 PDF”按钮。


## 权限与隐私

脚本采用 `@grant none`，并且只匹配：

```text
https://elearning.fudan.edu.cn/courses/*/gradebook/speed_grader*
```

脚本只请求当前复旦 eLearning 域名中的附件链接。PDF 内容仅保存在当前标签页的临时内存中，关闭预览或标签页后即被释放。

## 更新记录

- 0.1.1：修复 PDF 已完成载入后，加载提示仍覆盖预览区域的问题。
- 0.1.0：首个可测试版本。

## 许可证

MIT
