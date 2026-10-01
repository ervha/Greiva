ALTER TABLE sync_operations ADD COLUMN local_result TEXT CHECK(local_result IS NULL OR json_valid(local_result));
ALTER TABLE sync_operations ADD COLUMN local_error TEXT;
ALTER TABLE sync_operations ADD COLUMN resolution TEXT CHECK(resolution IS NULL OR json_valid(resolution));
ALTER TABLE sync_state ADD COLUMN head_cursor TEXT;
ALTER TABLE sync_state ADD COLUMN last_server_order INTEGER NOT NULL DEFAULT 0 CHECK(last_server_order>=0);
CREATE TABLE structured_server_entities (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task','relation')),
  entity_id TEXT NOT NULL,
  server_order INTEGER NOT NULL CHECK(server_order>0),
  entity TEXT NOT NULL CHECK(json_valid(entity)),
  PRIMARY KEY(entity_type,entity_id)
) STRICT;
CREATE TABLE structured_received (
  operation_id TEXT PRIMARY KEY NOT NULL,
  server_order INTEGER NOT NULL UNIQUE CHECK(server_order>0),
  result TEXT NOT NULL CHECK(json_valid(result))
) STRICT;
CREATE TABLE structured_conflicts (
  id TEXT PRIMARY KEY NOT NULL,
  server_order INTEGER NOT NULL CHECK(server_order>0),
  record TEXT NOT NULL CHECK(json_valid(record))
) STRICT;
PRAGMA user_version=4;
