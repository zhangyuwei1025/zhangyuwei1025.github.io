# GitHub Pages 个人主页

这个仓库现在使用 `GitHub Pages + Jekyll` 生成页面，内容主要由 Markdown 和布局模板组成。

## 当前结构

- `_config.yml`：Jekyll 站点配置
- `_layouts/`：页面布局模板
- `index.md`：主页内容
- `multimodal/index.md`：多模态理解列表页
- `multimodal/qwen3-vl.md`：文章内容

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

推送后通常 1-2 分钟即可访问，GitHub Pages 会自动构建 Jekyll 页面。

### 方式 2：项目主页

如果你使用其他仓库名（例如 `my-site`），页面地址会是：

`https://<你的用户名>.github.io/my-site`

然后到 GitHub 仓库的 **Settings -> Pages** 中确认部署来源为：

- Branch: `main`
- Folder: `/ (root)`

## 本地预览

如果本机安装了 Ruby / Jekyll，可以在仓库目录执行：

```bash
bundle exec jekyll serve
```

然后访问本地预览地址。
