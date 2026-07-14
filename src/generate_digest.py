from __future__ import annotations

import datetime as dt
import html
from pathlib import Path
from typing import Any

CATEGORY_NAMES = {
    "international_politics": "国际政治",
    "global_economy": "全球经济最新动态",
    "ai_industry": "AI行业上下游",
    "cybersecurity": "网络安全",
    "china_globalization": "国内出海动态",
}

CATEGORY_ORDER = [
    "international_politics",
    "global_economy",
    "ai_industry",
    "cybersecurity",
    "china_globalization",
]


def _clean(value: Any) -> str:
    return str(value or "").replace("\n", " ").strip()


def _score(value: Any) -> str:
    if value in (None, ""):
        return "-"
    try:
        return str(round(float(value), 1)).rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return _clean(value)


def _is_english(item: dict[str, Any]) -> bool:
    language = _clean(item.get("language")).lower()
    return language.startswith("en") or bool(_clean(item.get("summary_en")))


def _title(item: dict[str, Any]) -> str:
    return _clean(item.get("title") or item.get("title_zh") or item.get("original_title") or "无标题")


def _summary_cell(item: dict[str, Any], html_mode: bool = False) -> str:
    zh = _clean(item.get("summary_zh") or item.get("summary") or item.get("reason"))
    en = _clean(item.get("summary_en"))
    why_zh = _clean(item.get("why_it_matters_zh") or item.get("why_it_matters"))
    why_en = _clean(item.get("why_it_matters_en"))
    parts: list[str] = []
    if zh:
        parts.append(f"中文摘要：{zh}")
    if why_zh:
        parts.append(f"为什么重要：{why_zh}")
    if _is_english(item):
        if en:
            parts.append(f"English Summary: {en}")
        if why_en:
            parts.append(f"Why it matters: {why_en}")
    sep = "<br>" if html_mode else "<br>"
    return sep.join(parts) if parts else "目前信息有限"


def _group(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {key: [] for key in CATEGORY_ORDER}
    for item in sorted(items, key=lambda x: float(x.get("importance_score") or 0), reverse=True):
        grouped.setdefault(item.get("category", "未分类"), []).append(item)
    return {key: value for key, value in grouped.items() if value}


def _category_summary(entries: list[dict[str, Any]]) -> str:
    headlines = [_title(item) for item in entries[:3]]
    if not headlines:
        return "暂无入选新闻。"
    return f"本类共 {len(entries)} 条入选新闻，重点关注：" + "；".join(headlines) + "。"


def render_markdown(items: list[dict[str, Any]], digest_date: dt.date) -> str:
    grouped = _group(items)
    display_date = digest_date.strftime("%Y/%m/%d 08:25")
    month_day = f"{digest_date.month}月{digest_date.day}日"
    top = [x for x in items if x.get("is_top_news")]
    if not top:
        top = sorted(items, key=lambda x: float(x.get("importance_score") or 0), reverse=True)[:5]

    lines = [f"# 今日新闻-{display_date}", ""]
    lines.append(f"## 今日({month_day}) 新闻总览")
    lines.append(f"总结：今日共筛选 {len(items)} 条新闻，重点关注 " + "、".join(_title(item) for item in top[:5]) + "。")
    lines.append("")
    lines.append("---")
    lines.append("")

    for category, entries in grouped.items():
        category_name = CATEGORY_NAMES.get(category, category)
        lines.append(f"## {category_name}")
        lines.append(f"总结：{_category_summary(entries)}")
        lines.append("")
        lines.append("| 序号 | 新闻 | 来源/时间 | 重要性 | 摘要 |")
        lines.append("|---:|---|---|---:|---|")
        for idx, item in enumerate(entries[:5], 1):
            title = _title(item)
            original = _clean(item.get("original_title"))
            title_cell = f"[{title}]({item.get('url', '')})"
            if original and original != title:
                title_cell += f"<br>原题：{original}"
            source_cell = _clean(item.get("source"))
            if item.get("published_at"):
                source_cell += f"<br>{_clean(item.get('published_at'))[:10]}"
            lines.append(
                f"| {idx} | {title_cell} | {source_cell} | {_score(item.get('importance_score'))} | {_summary_cell(item)} |"
            )
        lines.append("")
    return "\n".join(lines)


def render_html(markdown_text: str, digest_date: dt.date, items: list[dict[str, Any]] | None = None) -> str:
    items = items or []
    grouped = _group(items)
    display_date = digest_date.strftime("%Y/%m/%d 08:25")
    month_day = f"{digest_date.month}月{digest_date.day}日"
    top = [x for x in items if x.get("is_top_news")]
    if not top:
        top = sorted(items, key=lambda x: float(x.get("importance_score") or 0), reverse=True)[:5]

    sections: list[str] = []
    for category, entries in grouped.items():
        category_name = CATEGORY_NAMES.get(category, category)
        rows = []
        for idx, item in enumerate(entries[:5], 1):
            title = html.escape(_title(item))
            url = html.escape(_clean(item.get("url")))
            original = html.escape(_clean(item.get("original_title")))
            title_html = f'<a href="{url}">{title}</a>' if url else title
            if original and original != title:
                title_html += f'<div class="original">原题：{original}</div>'
            rows.append(
                "<tr>"
                f"<td>{idx}</td>"
                f"<td>{title_html}</td>"
                f"<td>{html.escape(_clean(item.get('source')))}</td>"
                f"<td>{html.escape(_score(item.get('importance_score')))}</td>"
                f"<td>{_summary_cell(item, html_mode=True)}</td>"
                "</tr>"
            )
        sections.append(
            f"""
            <section>
              <h2>{html.escape(category_name)}</h2>
              <p class="summary"><strong>总结：</strong>{html.escape(_category_summary(entries))}</p>
              <table>
                <thead><tr><th>序号</th><th>新闻</th><th>来源</th><th>重要性</th><th>摘要</th></tr></thead>
                <tbody>{''.join(rows)}</tbody>
              </table>
            </section>
            """
        )

    top_text = "、".join(html.escape(_title(item)) for item in top[:5])
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>今日新闻-{display_date}</title>
  <style>
    body {{ margin: 0; background: #f7f7fb; color: #24272e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.65; }}
    main {{ max-width: 1080px; margin: 32px auto; background: #fff; border: 1px solid #d7d9e0; border-radius: 12px; overflow: hidden; }}
    header {{ background: #f0e8ff; padding: 24px 28px; }}
    h1 {{ margin: 0; color: #7437f2; font-size: 30px; }}
    .overview {{ padding: 28px; font-size: 20px; border-bottom: 1px solid #ddd; }}
    section {{ padding: 24px 28px 32px; border-bottom: 1px solid #ececf1; }}
    h2 {{ margin: 0 0 8px; font-size: 24px; }}
    .summary {{ margin: 0 0 18px; font-size: 18px; }}
    table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
    th, td {{ border: 1px solid #dfe3ea; padding: 10px 12px; vertical-align: top; }}
    th {{ background: #f5f6fa; text-align: left; }}
    th:nth-child(1), td:nth-child(1) {{ width: 52px; text-align: right; }}
    th:nth-child(3), td:nth-child(3) {{ width: 130px; }}
    th:nth-child(4), td:nth-child(4) {{ width: 70px; text-align: right; }}
    a {{ color: #2468ff; text-decoration: none; }}
    .original {{ color: #6b7280; font-size: 13px; margin-top: 4px; }}
  </style>
</head>
<body>
  <main>
    <header><h1>今日新闻-{display_date}</h1></header>
    <div class="overview"><strong>今日({month_day}) 新闻总览</strong><br>总结：今日共筛选 {len(items)} 条新闻，重点关注 {top_text}。</div>
    {''.join(sections)}
  </main>
</body>
</html>"""


def write_reports(items: list[dict[str, Any]], out_dir: Path, digest_date: dt.date | None = None) -> tuple[Path, Path]:
    digest_date = digest_date or dt.date.today()
    out_dir.mkdir(parents=True, exist_ok=True)
    markdown = render_markdown(items, digest_date)
    html_text = render_html(markdown, digest_date, items)
    md_path = out_dir / f"daily-digest-{digest_date.isoformat()}.md"
    html_path = out_dir / f"daily-digest-{digest_date.isoformat()}.html"
    md_path.write_text(markdown, encoding="utf-8")
    html_path.write_text(html_text, encoding="utf-8")
    return md_path, html_path
