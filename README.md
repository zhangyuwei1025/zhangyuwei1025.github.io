# GitHub Pages 个人主页模板

这个仓库是一个可直接部署的 GitHub Pages 静态页面模板。

## 使用前先替换

把下面这些占位内容替换成你自己的信息：

- `your-username`
- `you@example.com`
- 项目列表与简介文字

## 发布到 GitHub

### 方式 1：个人主页（推荐）

如果你希望网址是 `https://<你的用户名>.github.io`，请在 GitHub 上创建一个同名仓库：

`<你的用户名>.github.io`

然后在本地执行：

```bash
git branch -M main
git add .
git commit -m "init github pages site"
git remote add origin https://github.com/<你的用户名>/<你的用户名>.github.io.git
git push -u origin main
```

推送后通常 1-2 分钟即可访问。

### 方式 2：项目主页

如果你使用其他仓库名（例如 `my-site`），页面地址会是：

`https://<你的用户名>.github.io/my-site`

然后到 GitHub 仓库的 **Settings -> Pages** 中确认部署来源为：

- Branch: `main`
- Folder: `/ (root)`

## 本地预览

这是纯静态页面，直接双击 `index.html` 即可预览。
