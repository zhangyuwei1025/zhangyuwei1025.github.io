(function () {
  const tocRoot = document.querySelector("[data-generated-toc]");
  const tocContent = document.querySelector("[data-generated-toc-content]");
  const article = document.querySelector("[data-article-content]");

  if (!tocRoot || !tocContent || !article) {
    return;
  }

  const headings = Array.from(article.querySelectorAll("h2, h3, h4"));

  if (headings.length === 0) {
    return;
  }

  let generatedCount = 0;

  for (const heading of headings) {
    if (!heading.id) {
      generatedCount += 1;
      heading.id = createHeadingId(heading.textContent || "", generatedCount);
    }
  }

  const tocTree = buildTocTree(headings);
  const tocList = renderTocList(tocTree);

  tocList.className = "article-toc-list";
  tocContent.appendChild(tocList);
  tocRoot.hidden = false;

  function buildTocTree(nodes) {
    const tree = [];
    let currentH2 = null;
    let currentH3 = null;

    for (const heading of nodes) {
      const level = Number(heading.tagName.slice(1));
      const item = {
        id: heading.id,
        title: (heading.textContent || "").trim(),
        children: [],
      };

      if (level === 2) {
        tree.push(item);
        currentH2 = item;
        currentH3 = null;
        continue;
      }

      if (level === 3) {
        if (!currentH2) {
          tree.push(item);
          currentH2 = item;
        } else {
          currentH2.children.push(item);
        }
        currentH3 = item;
        continue;
      }

      if (level === 4) {
        if (currentH3) {
          currentH3.children.push(item);
        } else if (currentH2) {
          currentH2.children.push(item);
        } else {
          tree.push(item);
        }
      }
    }

    return tree;
  }

  function renderTocList(items) {
    const list = document.createElement("ul");

    for (const item of items) {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${item.id}`;
      link.textContent = item.title;
      listItem.appendChild(link);

      if (item.children.length > 0) {
        listItem.appendChild(renderTocList(item.children));
      }

      list.appendChild(listItem);
    }

    return list;
  }

  function createHeadingId(text, index) {
    const normalized = text
      .toLowerCase()
      .trim()
      .replace(/[`~!@#$%^&*()+=\[\]{}|\\:;"'<>,.?/]+/g, "")
      .replace(/\s+/g, "-");

    if (normalized) {
      return normalized;
    }

    return `section-${index}`;
  }
})();
