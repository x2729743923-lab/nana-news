const categoryNames = {
  all: "全部",
  international_politics: "国际政治",
  global_economy: "全球经济",
  ai_industry: "AI行业",
  cybersecurity: "网络安全",
  china_globalization: "国内出海",
  review_required: "待检查",
};

let latest = { items: [] };
let activeCategory = "all";
let query = "";

const content = document.querySelector("#content");
const tabs = document.querySelector("#tabs");
const search = document.querySelector("#searchInput");
const refresh = document.querySelector("#refreshButton");

function esc(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getTitle(item) {
  return item.title || item.title_zh || item.original_title || "无标题";
}

function isEnglish(item) {
  return String(item.language || "").toLowerCase().startsWith("en") || Boolean(item.summary_en);
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function deriveStream(password, salt, length) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const key = new Uint8Array(bits);
  const stream = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const blockInput = new Uint8Array(key.length + window.currentNonce.length + 8);
    blockInput.set(key, 0);
    blockInput.set(window.currentNonce, key.length);
    new DataView(blockInput.buffer).setBigUint64(key.length + window.currentNonce.length, BigInt(counter), false);
    const block = await sha256(blockInput);
    stream.set(block.slice(0, Math.min(block.length, length - offset)), offset);
    offset += block.length;
    counter += 1;
  }
  return { key, stream };
}

async function decryptData(password) {
  const encrypted = await fetch("/data/encrypted-latest.json", { cache: "no-store" }).then((response) => response.json());
  const salt = base64ToBytes(encrypted.salt);
  const nonce = base64ToBytes(encrypted.nonce);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  window.currentNonce = nonce;
  const { key, stream } = await deriveStream(password, salt, ciphertext.length);
  const macInput = new Uint8Array(key.length + nonce.length + ciphertext.length);
  macInput.set(key, 0);
  macInput.set(nonce, key.length);
  macInput.set(ciphertext, key.length + nonce.length);
  const mac = Array.from(await sha256(macInput)).map((value) => value.toString(16).padStart(2, "0")).join("");
  if (mac !== encrypted.mac) throw new Error("密码不正确");
  const plaintext = ciphertext.map((value, index) => value ^ stream[index]);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function loginTemplate() {
  return `<main class="login-card">
    <div class="brand-mark login-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <p class="eyebrow">Daily Intelligence</p>
    <h1>Nana新闻推送</h1>
    <form id="loginForm" class="login-form">
      <label>访问密码<input id="password" type="password" autocomplete="current-password" autofocus /></label>
      <button type="submit">进入新闻站点</button>
      <p id="loginMessage" class="login-message"></p>
    </form>
  </main>`;
}

function renderLogin() {
  document.body.classList.add("login-page");
  document.body.innerHTML = loginTemplate();
  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#loginMessage");
    message.textContent = "正在解锁...";
    try {
      latest = await decryptData(document.querySelector("#password").value);
      sessionStorage.setItem("nana_news_password", document.querySelector("#password").value);
      location.reload();
    } catch {
      message.textContent = "密码不正确，请重新输入。";
    }
  });
}

function categories(items) {
  return ["all", ...new Set(items.map((item) => item.category || "review_required"))];
}

function filteredItems() {
  const needle = query.trim().toLowerCase();
  return latest.items.filter((item) => {
    const categoryOk = activeCategory === "all" || item.category === activeCategory;
    const haystack = [getTitle(item), item.original_title, item.source, item.summary_zh, item.summary, item.summary_en]
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
  tabs.innerHTML = categories(latest.items)
    .map((key) => `<button class="tab ${key === activeCategory ? "active" : ""}" data-category="${key}">${esc(categoryNames[key] || key)}</button>`)
    .join("");
}

function renderOverview() {
  const items = latest.items || [];
  const top = items.slice().sort((a, b) => Number(b.importance_score || 0) - Number(a.importance_score || 0)).slice(0, 5);
  document.querySelector("#pageTitle").textContent = "Nana新闻推送";
  document.querySelector("#overviewText").textContent = `今日共筛选 ${items.length} 条新闻，重点关注：${top.map(getTitle).join("；")}。`;
  document.querySelector("#metricCount").textContent = items.length;
  document.querySelector("#metricTop").textContent = items.filter((item) => item.is_top_news).length || top.length;
  document.querySelector("#metricEnglish").textContent = items.filter(isEnglish).length;
}

function summaryHtml(item) {
  const zh = item.summary_zh || item.summary || item.reason || "目前信息有限";
  const whyZh = item.why_it_matters_zh || item.why_it_matters || "";
  const en = item.summary_en || "";
  const whyEn = item.why_it_matters_en || "";
  return `<div class="summary-block">
    <div><strong>中文摘要：</strong>${esc(zh)}</div>
    ${whyZh ? `<div><strong>为什么重要：</strong>${esc(whyZh)}</div>` : ""}
    ${isEnglish(item) ? `<div class="en"><strong>English Summary:</strong> ${esc(en || "Not available.")}</div>${whyEn ? `<div class="en"><strong>Why it matters:</strong> ${esc(whyEn)}</div>` : ""}` : ""}
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
      return `<tr><td>${index + 1}</td><td>${link}${original ? `<div class="original-title">原题：${esc(original)}</div>` : ""}</td><td>${esc(item.source || "-")}</td><td><span class="score">${esc(item.importance_score || "-")}</span></td><td>${summaryHtml(item)}</td></tr>`;
    })
    .join("");
  return `<section class="category-section"><div class="category-head"><h2>${esc(categoryNames[category] || category)}</h2><p>本类共 ${items.length} 条。</p></div><div class="table-wrap"><table><thead><tr><th>序号</th><th>新闻</th><th>来源</th><th>重要性</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderContent() {
  renderControls();
  renderOverview();
  const grouped = groupItems(filteredItems());
  const order = ["international_politics", "global_economy", "ai_industry", "cybersecurity", "china_globalization", "review_required"];
  content.innerHTML = order.filter((key) => grouped[key]?.length).map((key) => renderTable(key, grouped[key])).join("") || `<div class="empty">没有匹配的新闻。</div>`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderContent();
});

search?.addEventListener("input", (event) => {
  query = event.target.value;
  renderContent();
});

refresh?.addEventListener("click", () => alert("线上版会按计划自动更新；手动刷新请重新运行 GitHub Actions。"));

(async function boot() {
  const password = sessionStorage.getItem("nana_news_password");
  if (!password) {
    renderLogin();
    return;
  }
  try {
    latest = await decryptData(password);
    renderContent();
  } catch {
    sessionStorage.removeItem("nana_news_password");
    renderLogin();
  }
})();
