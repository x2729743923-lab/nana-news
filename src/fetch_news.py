from __future__ import annotations

import datetime as dt
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import yaml

from paths import CONFIG_DIR


def _published(entry: Any) -> str | None:
    raw = getattr(entry, "published", None) or getattr(entry, "updated", None)
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw).isoformat()
    except Exception:
        return raw


def fetch_rss_items() -> list[dict[str, Any]]:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    items: list[dict[str, Any]] = []
    for category in config["categories"]:
        for source in category.get("sources", []):
            if source.get("type") != "rss":
                continue
            feed = feedparser.parse(source["url"])
            for entry in feed.entries[:20]:
                items.append({
                    "title": getattr(entry, "title", "").strip(),
                    "url": getattr(entry, "link", "").strip(),
                    "source": source["name"],
                    "language": source.get("language", "unknown"),
                    "category": category["id"],
                    "category_name": category["name"],
                    "published_at": _published(entry),
                    "summary": getattr(entry, "summary", ""),
                    "bilingual": bool(source.get("bilingual")),
                    "paywall_sensitive": bool(source.get("paywall_sensitive")),
                    "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                })
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        if not item["url"] or item["url"] in seen:
            continue
        seen.add(item["url"])
        deduped.append(item)
    return deduped
