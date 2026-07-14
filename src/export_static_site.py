from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import shutil
from pathlib import Path

from dotenv import load_dotenv

from paths import DATA_DIR, ROOT


PUBLIC_DIR = ROOT / "public"
WEB_DIR = ROOT / "web"


def _derive_key(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000, dklen=32)


def _xor_stream(data: bytes, key: bytes, nonce: bytes) -> bytes:
    output = bytearray()
    counter = 0
    while len(output) < len(data):
        block = hashlib.sha256(key + nonce + counter.to_bytes(8, "big")).digest()
        output.extend(block)
        counter += 1
    return bytes(value ^ output[index] for index, value in enumerate(data))


def _mac(key: bytes, nonce: bytes, ciphertext: bytes) -> str:
    return hashlib.sha256(key + nonce + ciphertext).hexdigest()


def encrypt_payload(payload: dict, password: str) -> dict:
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(16)
    key = _derive_key(password, salt)
    plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ciphertext = _xor_stream(plaintext, key, nonce)
    return {
        "version": 1,
        "kdf": "pbkdf2-sha256",
        "iterations": 200000,
        "salt": base64.b64encode(salt).decode("ascii"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "mac": _mac(key, nonce, ciphertext),
    }


def main() -> None:
    load_dotenv(ROOT / ".env", encoding="utf-8-sig")
    password = os.getenv("NANA_NEWS_PASSWORD", "Nanaonlinenews")
    latest_path = DATA_DIR / "latest.json"
    if not latest_path.exists():
        raise SystemExit("data/latest.json 不存在，请先运行 src/run_daily.py --dry-run")

    latest = json.loads(latest_path.read_text(encoding="utf-8"))
    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    PUBLIC_DIR.mkdir(parents=True)
    (PUBLIC_DIR / "data").mkdir()

    index = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    index = index.replace('<script src="/app.js"></script>', '<script src="/static-app.js"></script>')
    index = index.replace('href="/styles.css"', 'href="styles.css"')
    index = index.replace('src="/static-app.js"', 'src="static-app.js"')
    (PUBLIC_DIR / "index.html").write_text(index, encoding="utf-8")
    for filename in ["styles.css", "static-app.js"]:
        shutil.copy2(WEB_DIR / filename, PUBLIC_DIR / filename)

    encrypted = encrypt_payload(latest, password)
    (PUBLIC_DIR / "data" / "encrypted-latest.json").write_text(
        json.dumps(encrypted, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
