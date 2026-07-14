const categoryNames = {
  all: "全部",
  international_politics: "国际政治",
  global_economy: "全球经济",
  ai_industry: "AI行业",
  cybersecurity: "网络安全",
  china_globalization: "国内出海",
  review_required: "待检查",
};

const categoryIcons = {
  all: "◎",
  international_politics: "政",
  global_economy: "经",
  ai_industry: "AI",
  cybersecurity: "安",
  china_globalization: "海",
  review_required: "核",
};

let latest = { items: [] };
let activeCategory = "all";
let query = "";

const content = document.querySelector("#content");
const tabs = document.querySelector("#tabs");
const nav = document.querySelector("#categoryNav");
const search = document.querySelector("#searchInput");
const refresh = document.querySelector("#refreshButton");

function getTitle(item) {
  return item.title || item.title_zh || item.original_title || "无标题";
}

function isEnglish(item) {
  return String(item.language || "").toLowerCase().startsWith("en") || Boolean(item.summary_en);
}

function esc(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function categories(items) {
  const keys = ["all", ...new Set(items.map((item) => item.category || "review_required"))];
  return keys;
}

function filteredItems() {
  const needle = query.trim().toLowerCase();
  return latest.items.filter((item) => {
    const categoryOk = activeCategory === "all" || item.category === activeCategory;
    const haystack = [
      getTitle(item),
      item.original_title,
      item.source,
      item.summary_zh,
      item.summary,
      item.summary_en,
      item.why_it_matters_zh,
    ]
      .join(" ")
      .toLowerCase();
    return categoryOk && (!needle || haystack.includes(needle));
  });
}

function groupItems(items) {
  return items.reduce((acc, item) => {
    const key = item.category || "review_required";
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function renderControls() {
  const keys = categories(latest.items);
  tabs.innerHTML = keys
    .map(
      (key) =>
        `<button class="tab ${key === activeCategory ? "active" : ""}" data-category="${esc(key)}">${esc(
          categoryNames[key] || key
        )}</button>`
    )
    .join("");
  nav.innerHTML = keys
    .map(
      (key) =>
        `<button class="nav-dot ${key === activeCategory ? "active" : ""}" data-category="${esc(key)}" title="${esc(
          categoryNames[key] || key
        )}">${esc(categoryIcons[key] || "•")}</button>`
    )
    .join("");
}

function renderOverview() {
  const items = latest.items || [];
  const top = items
    .slice()
    .sort((a, b) => Number(b.importance_score || 0) - Number(a.importance_score || 0))
    .slice(0, 5);
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  document.querySelector("#pageTitle").textContent = `Nana新闻推送-${new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
  document.querySelector("#overviewText").textContent = `今日(${today}) 共筛选 ${items.length} 条新闻，重点关注：${top
    .map(getTitle)
    .join("；")}。`;
  document.querySelector("#metricCount").textContent = items.length;
  document.querySelector("#metricTop").textContent = items.filter((item) => item.is_top_news).length || top.length;
  document.querySelector("#metricEnglish").textContent = items.filter(isEnglish).length;
}

function summaryHtml(item) {
  const zh = item.summary_zh || item.summary || item.reason || "目前信息有限";
  const whyZh = item.why_it_matters_zh || item.why_it_matters || "";
  const en = item.summary_en || "";
  const whyEn = item.why_it_matters_en || "";
  return `
    <div class="summary-block">
      <div><strong>中文摘要：</strong>${esc(zh)}</div>
      ${whyZh ? `<div><strong>为什么重要：</strong>${esc(whyZh)}</div>` : ""}
      ${
        isEnglish(item)
          ? `<div class="en"><strong>English Summary:</strong> ${esc(en || "Not available.")}</div>${
              whyEn ? `<div class="en"><strong>Why it matters:</strong> ${esc(whyEn)}</div>` : ""
            }`
          : ""
      }
    </div>`;
}

function renderTable(category, items) {
  const rows = items
    .slice()
    .sort((a, b) => Number(b.importance_score || 0) - Number(a.importance_score || 0))
    .map((item, index) => {
      const title = getTitle(item);
      const original = item.original_title && item.original_title !== title ? item.original_title : "";
      const link = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(title)}</a>` : esc(title);
      return `<tr>
        <td>${index + 1}</td>
        <td>${link}${original ? `<div class="original-title">原题：${esc(original)}</div>` : ""}</td>
        <td>${esc(item.source || "-")}<div class="meta">${esc(String(item.published_at || "").slice(0, 10))}</div></td>
        <td><span class="score">${esc(item.importance_score || "-")}</span></td>
        <td>${summaryHtml(item)}</td>
      </tr>`;
    })
    .join("");

  const topNames = items.slice(0, 3).map(getTitle).join("；");
  return `<section class="category-section">
    <div class="category-head">
      <h2>${esc(categoryNames[category] || category)}</h2>
      <p>本类共 ${items.length} 条，重点关注：${esc(topNames || "暂无")}。</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>序号</th><th>新闻</th><th>来源/时间</th><th>重要性</th><th>摘要</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderContent() {
  renderControls();
  renderOverview();
  const items = filteredItems();
  const grouped = groupItems(items);
  const order = ["international_politics", "global_economy", "ai_industry", "cybersecurity", "china_globalization", "review_required"];
  const html = order.filter((key) => grouped[key]?.length).map((key) => renderTable(key, grouped[key])).join("");
  content.innerHTML = html || `<div class="empty">没有匹配的新闻。可以换个关键词，或重新生成日报。</div>`;
}

async function loadLatest() {
  const response = await fetch("/api/latest");
  latest = await response.json();
  latest.items ||= [];
  renderContent();
}

async function regenerate() {
  refresh.disabled = true;
  refresh.textContent = "…";
  try {
    const response = await fetch("/api/regenerate", { method: "POST" });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "重新生成失败");
    latest = payload.latest;
    latest.items ||= [];
    renderContent();
  } catch (error) {
    alert(error.message);
  } finally {
    refresh.disabled = false;
    refresh.textContent = "↻";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderContent();
});

search.addEventListener("input", (event) => {
  query = event.target.value;
  renderContent();
});

refresh.addEventListener("click", regenerate);
loadLatest();
