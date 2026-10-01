CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
  due TEXT,
  version INTEGER NOT NULL CHECK(version>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
) STRICT;
CREATE TABLE relations (
  id TEXT PRIMARY KEY NOT NULL,
  from_type TEXT NOT NULL CHECK(from_type IN ('page','task')),
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL CHECK(to_type IN ('page','task')),
  to_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
) STRICT;
CREATE TABLE sync_operations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task','relation')),
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('create','update','delete')),
  base_version INTEGER,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','acknowledged','rejected')),
  base_entity TEXT CHECK(base_entity IS NULL OR json_valid(base_entity)),
  dependency_operation_id TEXT REFERENCES sync_operations(operation_id),
  prepared_wire TEXT CHECK(prepared_wire IS NULL OR json_valid(prepared_wire))
) STRICT;
CREATE INDEX sync_operations_pending ON sync_operations(status,seq);
CREATE INDEX sync_operations_entity ON sync_operations(entity_type,entity_id,seq);
CREATE TABLE sync_state (
  stream TEXT PRIMARY KEY NOT NULL CHECK(stream='structured'),
  cursor TEXT,
  last_successful_sync_at TEXT
) STRICT;
CREATE TABLE structured_client (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  client_id TEXT NOT NULL
) STRICT;
INSERT INTO sync_state VALUES ('structured',NULL,NULL);
PRAGMA user_version=3;
