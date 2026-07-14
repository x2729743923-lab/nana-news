from __future__ import annotations

import datetime as dt
import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from paths import DATA_DIR, PROMPT_DIR, ROOT


def _client() -> OpenAI:
    load_dotenv(ROOT / ".env", encoding="utf-8-sig")
    key = os.getenv("DEEPSEEK_API_KEY")
    if not key or key.startswith("在这里"):
        raise RuntimeError("请先在 .env 里填写 DEEPSEEK_API_KEY")
    return OpenAI(
        api_key=key,
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    )


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    if isinstance(data, dict) and isinstance(data.get("articles"), list):
        return data["articles"]
    if isinstance(data, list):
        return data
    return []


def _record_usage(model: str, response: Any) -> None:
    if not getattr(response, "usage", None):
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    usage_payload = {
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "provider": "deepseek",
        "model": model,
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens,
    }
    with (DATA_DIR / "usage.jsonl").open("a", encoding="utf-8") as file:
        file.write(json.dumps(usage_payload, ensure_ascii=False) + "\n")


def rank_and_summarize(items: list[dict[str, Any]], model: str = "deepseek-v4-flash") -> list[dict[str, Any]]:
    if not items:
        return []
    client = _client()
    filter_prompt = (PROMPT_DIR / "filter.md").read_text(encoding="utf-8")
    summarize_prompt = (PROMPT_DIR / "summarize.md").read_text(encoding="utf-8")
    payload = json.dumps(items[:120], ensure_ascii=False)
    response = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": filter_prompt + "\n\n" + summarize_prompt},
            {"role": "user", "content": payload},
        ],
    )
    _record_usage(model, response)
    text = response.choices[0].message.content or "[]"
    try:
        return _extract_json(text)
    except json.JSONDecodeError:
        return [{"title": "AI 输出需要人工检查", "summary_zh": text, "category": "review_required", "importance_score": 0}]
