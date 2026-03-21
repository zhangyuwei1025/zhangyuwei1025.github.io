const yearEl = document.getElementById("year");

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const markdownHost = document.querySelector("[data-markdown-src]");
const markdownStatus = document.querySelector("[data-markdown-status]");

if (markdownHost) {
  renderMarkdownArticle(markdownHost);
}

async function renderMarkdownArticle(container) {
  const source = container.dataset.markdownSrc;

  if (!source) {
    return;
  }

  try {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`Failed to load ${source}: ${response.status}`);
    }

    const markdown = await response.text();
    container.innerHTML = renderMarkdown(markdown);

    if (markdownStatus) {
      markdownStatus.hidden = true;
    }
  } catch (error) {
    const safeSource = escapeHtml(source);

    container.innerHTML = `
      <p>暂时无法加载 Markdown 内容。</p>
      <p>请直接打开 <a href="${safeSource}">${safeSource}</a> 查看原文。</p>
      <p>如果你是在本地直接双击 HTML 预览，浏览器可能会拦截文件读取；通过 HTTP(S) 访问时即可正常渲染。</p>
    `;

    if (markdownStatus) {
      markdownStatus.hidden = false;
      markdownStatus.textContent = "正文暂时加载失败";
    }

    console.error(error);
  }
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const paragraphLines = [];
  const listStack = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLanguage = "";

  function closeParagraph() {
    if (!paragraphLines.length) {
      return;
    }

    html.push(`<p>${renderParagraph(paragraphLines)}</p>`);
    paragraphLines.length = 0;
  }

  function closeLists(targetLevel = 0) {
    while (listStack.length > targetLevel) {
      html.push("</li></ul>");
      listStack.pop();
    }
  }

  function closeCodeBlock() {
    if (!inCodeBlock) {
      return;
    }

    const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
    html.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    inCodeBlock = false;
    codeLines = [];
    codeLanguage = "";
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^```([\w-]*)\s*$/);
    if (fenceMatch) {
      closeParagraph();
      closeLists();

      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        inCodeBlock = true;
        codeLanguage = fenceMatch[1];
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      closeParagraph();
      closeLists();
      html.push("<hr>");
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph();
      closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (listMatch) {
      closeParagraph();
      const level = Math.floor(listMatch[1].replace(/\t/g, "    ").length / 4) + 1;

      while (listStack.length < level) {
        html.push("<ul><li>");
        listStack.push(level);
      }

      while (listStack.length > level) {
        html.push("</li></ul>");
        listStack.pop();
      }

      if (html[html.length - 1] !== "<ul><li>") {
        html.push("</li><li>");
      }

      html.push(renderInline(listMatch[2].trim()));
      continue;
    }

    closeLists();
    paragraphLines.push(line);
  }

  closeParagraph();
  closeLists();
  closeCodeBlock();

  return html.join("");
}

function renderParagraph(lines) {
  const parts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    parts.push(renderInline(trimmed));

    if (index < lines.length - 1) {
      const separator = line.endsWith("  ") ? "<br>" : " ";
      parts.push(separator);
    }
  }

  return parts.join("");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
