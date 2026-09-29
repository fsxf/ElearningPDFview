# 复旦 eLearning PDF 预览

这是一个面向复旦 eLearning SpeedGrader 的 Tampermonkey 用户脚本。它在 PDF 提交文件旁增加“预览 PDF”按钮，让教师无需先把文件保存到电脑即可查看内容，同时保留网站原有的下载入口。

## 直接安装

1. 在 Chrome 中从官方渠道安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点击[安装复旦 eLearning PDF 预览脚本](https://raw.githubusercontent.com/fsxf/ElearningPDFview/main/fudan-elearning-pdf-preview.user.js)。
3. Tampermonkey 打开安装页面后，检查脚本权限并选择“安装”。
4. 刷新 eLearning 的 SpeedGrader 页面。

后续发布新版本时，Tampermonkey 会从本仓库检查脚本更新。

## 功能

- 在 SpeedGrader 中识别 PDF 提交文件。
- 使用当前 eLearning 登录状态读取文件。
- 在页面内的大窗口中调用浏览器自带的 PDF 阅读器。
- 支持在新标签页打开或继续下载原文件。
- 自动适应切换学生、切换提交记录等动态页面变化。
- 不写死课程、作业、学生或附件编号。
- 不上传 PDF，不连接第三方服务器，也不保存文件内容。

## 手动安装

1. 在 Chrome 中安装 Tampermonkey。
2. 打开 Tampermonkey 控制面板，选择“添加新脚本”。
3. 删除编辑器中的示例内容。
4. 将 `fudan-elearning-pdf-preview.user.js` 的全部内容粘贴进去并保存。
5. 刷新 eLearning 的 SpeedGrader 页面。

识别到 PDF 后，文件名旁会出现“预览 PDF”按钮。

> 安装浏览器扩展会授予扩展一定的网页访问能力。请从 Tampermonkey 官方发布渠道安装，并在安装前检查本脚本的源代码和权限声明。

## 权限与隐私

脚本采用 `@grant none`，并且只匹配：

```text
https://elearning.fudan.edu.cn/courses/*/gradebook/speed_grader*
```

脚本只请求当前复旦 eLearning 域名中的附件链接。PDF 内容仅保存在当前标签页的临时内存中，关闭预览或标签页后即被释放。

脚本不会：

- 将文件或个人信息发送到其他网站；
- 记录学生、课程、作业或评分数据；
- 修改成绩、评语或提交内容；
- 自动下载或永久保存 PDF。

## 分发建议

可以直接分享本仓库地址或上面的“直接安装”链接。发布新版本时应提升脚本头部的 `@version`，Tampermonkey 才会识别并安装更新。

## 已知限制

- 当前版本依赖 Chrome 自带的 PDF 阅读器。如果用户关闭了浏览器 PDF 预览功能，页面内预览可能无法显示，但仍可使用“新标签页打开”或“下载原文件”。
- 只有文件名或链接信息中明确包含 `.pdf` 的提交才会出现预览按钮，避免把 Word、图片等文件误判成 PDF。
- eLearning 如果改变附件链接或 SpeedGrader 页面结构，可能需要更新识别规则。
- 跨域 iframe 中的附件列表无法被本脚本访问；同域 SpeedGrader 内容不受影响。

## 更新记录

- 0.1.1：修复 PDF 已完成载入后，加载提示仍覆盖预览区域的问题。
- 0.1.0：首个可测试版本。

## 故障排查

- 没有看到“预览 PDF”：确认当前页面地址包含 `/gradebook/speed_grader`，并检查文件名是否以 `.pdf` 结尾。
- 提示返回内容不是 PDF：刷新页面确认登录仍有效，然后重试。
- 弹窗出现但 PDF 区域空白：点击“新标签页打开”；如果仍无法显示，请确认 Chrome 没有设置为始终下载 PDF。
- 页面结构发生变化：提供 SpeedGrader 页面截图、PDF 文件名对应的链接地址，以及浏览器控制台中的错误信息。

## 开发验证

脚本没有构建步骤或外部依赖，可使用 Node.js 做语法检查：

```powershell
node --check .\fudan-elearning-pdf-preview.user.js
```

## 许可证

MIT
