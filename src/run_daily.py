from __future__ import annotations

import argparse
import json

from ai_process import rank_and_summarize
from fetch_news import fetch_rss_items
from generate_digest import write_reports
from paths import DATA_DIR, REPORT_DIR
from push_feishu import send_text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只生成报告，不推送飞书")
    parser.add_argument("--no-ai", action="store_true", help="跳过 AI，用抓取结果生成测试简报")
    args = parser.parse_args()

    raw_items = fetch_rss_items()
    if args.no_ai:
        items = [
            {
                **item,
                "importance_score": 5,
                "relevance_score": 5,
                "is_top_news": False,
                "original_title": item.get("title"),
            }
            for item in raw_items[:25]
        ]
    else:
        items = rank_and_summarize(raw_items)

    md_path, html_path = write_reports(items, REPORT_DIR)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    latest_path = DATA_DIR / "latest.json"
    latest_path.write_text(
        json.dumps(
            {
                "markdown": str(md_path),
                "html": str(html_path),
                "count": len(items),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"markdown": str(md_path), "html": str(html_path), "count": len(items)}, ensure_ascii=False, indent=2))

    if not args.dry_run:
        digest_text = md_path.read_text(encoding="utf-8")
        send_text(digest_text)


if __name__ == "__main__":
    main()
