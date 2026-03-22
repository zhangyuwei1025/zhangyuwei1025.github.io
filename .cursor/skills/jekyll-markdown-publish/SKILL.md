---
name: jekyll-markdown-publish
description: Maintain this repository's Jekyll-based markdown content workflow. Use when the user adds a new markdown article, wants an existing markdown note cleaned up for blog rendering, needs parent section links or homepage buttons updated, or asks to commit, push, and verify a Jekyll article page on GitHub Pages.
---

# Jekyll Markdown Publish

## Scope

This skill is for this repository's blog workflow:

- GitHub Pages + Jekyll
- content authored in `.md`
- page structure driven by `_layouts/`
- section landing pages such as `multimodal/index.md`

Do not reintroduce runtime markdown rendering with browser JavaScript unless the user explicitly asks for it.

## Quick Start

When the user adds a new markdown article or asks to publish one:

1. Read the target markdown file and relevant parent pages.
2. Normalize the markdown structure so Jekyll/Kramdown renders it cleanly.
3. Add or update front matter on the article.
4. Add or update the article's left-side table of contents when the article is long enough to need one.
5. Add or update the parent section entry button/link.
6. Add or update homepage entry points if the user expects section-level navigation from the homepage.
7. Check for stale files or old logic and remove them if no longer needed.
8. Run lints for changed files when applicable.
9. Commit only when the user asks.
10. Push only when the user asks.
11. Verify the live page after push with a web fetch.

## Repository Conventions

### Layouts

- Homepage content lives in `index.md` and uses `layout: home`
- Section list pages live in paths like `multimodal/index.md` and use `layout: section`
- Article pages live as markdown files such as `multimodal/qwen3-vl.md` and use `layout: article`

### Article Front Matter

For article pages, use front matter like:

```yaml
---
layout: article
title: Article Title | Section Name
description: Short summary for metadata.
section_url: /section-name/
section_label: Section Name
article_title: Article Title
article_subtitle: One-sentence summary.
article_type: 学习笔记
article_topic: Topic Name
---
```

Keep the visible article title in front matter. If the markdown body also begins with the same `# Title`, remove the duplicate heading unless the user specifically wants it repeated.

### Article TOC Pattern

Long articles should include a left-side table of contents via front matter:

```yaml
article_toc:
  - title: Section A
    id: section-a
    children:
      - title: Subsection A1
        id: subsection-a1
      - title: Subsection A2
        id: subsection-a2
```

Use stable ASCII ids whenever possible, even for Chinese headings. Then add matching heading attributes in the markdown body:

```markdown
## 代码 {#code}
### processor {#processor}
#### PatchMerger {#patchmerger}
```

The current repository convention is:

- TOC is rendered in the article layout on the left side on desktop
- TOC collapses above the article on narrow screens
- TOC should list meaningful sections only; do not dump every tiny heading unless the article truly benefits from it

### Section Entry Pattern

For section index pages such as `multimodal/index.md`, keep entries simple:

```html
<section class="card">
  <h2>专题页面</h2>
  <ul>
    <li><a href="{{ "/multimodal/example.html" | relative_url }}">Example 页面</a></li>
  </ul>
</section>
```

Note: linking to `example.html` is normal even when the source file is `example.md`; Jekyll outputs the page route as `.html`.

### Homepage Entry Pattern

If a section should be reachable from the homepage, add or update a card in `index.md`:

```html
<section class="card">
  <h2>多模态理解</h2>
  <p>整理多模态模型学习笔记与阅读记录。</p>
  <p><a href="{{ "/multimodal/" | relative_url }}">进入多模态理解专区</a></p>
</section>
```

## Markdown Cleanup Rules

Prefer markdown that renders reliably in Jekyll/Kramdown:

- Use real headings for major subsections instead of pretending headings are list items
- Keep nested lists shallow when possible
- Add blank lines before and after fenced code blocks
- Add blank lines before subheadings
- Keep inline code wrapped in backticks
- Keep long technical sections as `####` headings plus bullet lists when that reads more clearly than deeply nested bullets
- Add explicit heading ids for any heading that will appear in the left TOC

### Preferred Transformations

Good:

```markdown
#### PatchMerger

输入是中间层或最后一层的 `hidden_states`。

- 中间层：先将 4 个 token 拼成一个向量，再做 norm
- 最后层：先做 norm，再把 4 个向量拼成一个向量
```

Avoid:

```markdown
- PatchMerger（输入是中间层或最后一层的 `hidden_states`）
    - 中间层：先将 4 个 token 拼成一个向量，再做 norm
    - 最后层：先做 norm，再把 4 个向量拼成一个向量
```

## Old Logic Cleanup

When migrating or extending pages, remove obsolete logic if it is no longer used:

- runtime markdown loading via JavaScript
- external markdown parser CDNs
- dead buttons such as "查看原文" when the article now renders inline through Jekyll
- stale `.html` shells that only existed to fetch markdown at runtime
- outdated README instructions that still describe the old workflow

Before deleting anything, confirm the file is genuinely obsolete and not still referenced by the current Jekyll structure.

## Verification Workflow

After push, verify the live result:

1. Fetch the homepage URL and confirm the relevant entry link exists.
2. Fetch the article URL and confirm the page content is rendered, not just raw markdown fallback text.
3. If the article has a TOC, confirm the TOC heading labels are visible in the rendered page.
4. If the page still looks stale, note that GitHub Pages may take 1-2 minutes and recheck.

Use this verification checklist:

- [ ] homepage entry exists
- [ ] section page entry exists
- [ ] article title is visible
- [ ] main body content is visible
- [ ] left-side TOC is visible when expected
- [ ] no obvious old fallback text remains

## Commit and Push

When the user asks to commit:

1. Run `git status --short --branch`, `git diff --staged; git diff`, and `git log --oneline -5`
2. Stage only the relevant files
3. Write a concise message focused on the publishing change

When the user asks to push:

1. Push the current branch
2. Recheck `git status --short --branch`
3. Verify the live page with a web fetch

## Typical File Set

For a new article in an existing section, expect to touch some of:

- `section-name/new-article.md`
- `section-name/index.md`
- `index.md`
- `README.md`
- `_layouts/article.html`
- `styles.css`

For a new section, expect to touch some of:

- `new-section/index.md`
- one or more article markdown files
- `index.md`
- possibly `_layouts/` only if the user wants a new page pattern

## Response Pattern

When completing this workflow for the user:

- say what content was added or cleaned up
- mention which navigation entry points were updated
- say whether commit and push were done
- if pushed, report whether the live page verification succeeded
