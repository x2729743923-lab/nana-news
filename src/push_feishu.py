from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv
from paths import ROOT


def _signature(secret: str, timestamp: str) -> str:
    string_to_sign = f"{timestamp}\n{secret}".encode("utf-8")
    digest = hmac.new(string_to_sign, b"", digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def send_text(text: str) -> dict[str, Any]:
    load_dotenv(ROOT / ".env", encoding="utf-8-sig")
    webhook = os.getenv("FEISHU_WEBHOOK")
    secret = os.getenv("FEISHU_SECRET", "")
    if not webhook:
        raise RuntimeError("请先在 .env 里填写 FEISHU_WEBHOOK")

    payload: dict[str, Any] = {
        "msg_type": "text",
        "content": {"text": text[:18000]},
    }
    if secret:
        timestamp = str(int(time.time()))
        payload["timestamp"] = timestamp
        payload["sign"] = _signature(secret, timestamp)

    response = requests.post(webhook, json=payload, timeout=20)
    response.raise_for_status()
    return response.json()
