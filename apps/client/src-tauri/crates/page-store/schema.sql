CREATE TABLE pages (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  y_doc_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE page_updates (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL REFERENCES pages(id),
  update_bytes BLOB NOT NULL,
  digest BLOB NOT NULL CHECK(length(digest)=32),
  UNIQUE(page_id,digest)
) STRICT;
CREATE TABLE client_page_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  page_id TEXT NOT NULL REFERENCES pages(id)
) STRICT;
PRAGMA user_version=2;
