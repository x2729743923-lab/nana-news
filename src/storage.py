from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  original_title TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT,
  language TEXT,
  category TEXT,
  published_at TEXT,
  summary TEXT,
  importance_score REAL,
  relevance_score REAL,
  is_top_news INTEGER DEFAULT 0,
  tags TEXT,
  raw_payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  digest_date TEXT UNIQUE NOT NULL,
  markdown_path TEXT,
  html_path TEXT,
  sent_to_feishu INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn
