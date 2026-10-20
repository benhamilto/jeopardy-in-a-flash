DROP TABLE IF EXISTS clues;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS meta;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  clues_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE clues (
  id INTEGER PRIMARY KEY,
  answer TEXT NOT NULL,
  question TEXT NOT NULL,
  value INTEGER,
  airdate TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  game_id INTEGER,
  invalid_count INTEGER,
  final_pos INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories (id)
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
