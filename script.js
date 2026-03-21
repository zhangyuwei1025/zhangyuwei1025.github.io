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

    if (!window.marked) {
      throw new Error("Marked is not available.");
    }

    container.innerHTML = window.marked.parse(markdown);

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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
