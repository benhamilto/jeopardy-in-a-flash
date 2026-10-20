import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { cleanText, parseValue, toAirdate } from "./clean.mjs";

const inputPath = process.argv[2] || "/tmp/jeopardy-data/JEOPARDY_QUESTIONS1.json";
const outputDir = process.argv[3] || "/tmp/jeopardy-data/sql";
const maxStatementBytes = 90_000;
const maxFileBytes = 3_000_000;

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  return value == null ? "NULL" : String(value);
}

class SqlWriter {
  constructor(directory) {
    this.directory = directory;
    this.index = 0;
    this.stream = null;
    this.fileBytes = 0;
    this.currentName = "";
  }

  async openNext() {
    if (this.stream) {
      this.stream.end();
      await finished(this.stream);
    }
    this.index += 1;
    this.currentName = `${String(this.index).padStart(4, "0")}.sql`;
    this.stream = createWriteStream(path.join(this.directory, this.currentName));
    this.fileBytes = 0;
  }

  async write(sql) {
    if (!this.stream || this.fileBytes + sql.length > maxFileBytes) {
      await this.openNext();
    }
    this.stream.write(sql);
    this.fileBytes += sql.length;
  }

  async insert(table, columns, rows) {
    const prefix = `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n`;
    let batch = [];
    let bytes = prefix.length;

    const flush = async () => {
      if (batch.length === 0) return;
      await this.write(`${prefix}${batch.join(",\n")};\n`);
      batch = [];
      bytes = prefix.length;
    };

    for (const row of rows) {
      const line = `(${row.join(", ")})`;
      if (batch.length > 0 && bytes + line.length + 2 > maxStatementBytes) {
        await flush();
      }
      batch.push(line);
      bytes += line.length + 2;
    }
    await flush();
  }

  async close() {
    if (!this.stream) return;
    this.stream.end();
    await finished(this.stream);
    this.stream = null;
  }
}

const raw = JSON.parse(await readFile(inputPath, "utf8"));
const categories = new Map();
let skipped = 0;

for (const row of raw) {
  const question = cleanText(row.question, { unwrapQuotes: true });
  const answer = cleanText(row.answer);
  const title = cleanText(row.category);
  if (!question || !answer || !title) {
    skipped += 1;
    continue;
  }

  const airdate = toAirdate(row.air_date);
  const value = parseValue(row.value);
  const gameId = Number(row.show_number);
  const gameKey = Number.isInteger(gameId) ? gameId : "unknown";
  const key = `${gameKey}|${row.round || ""}|${title}`;
  let category = categories.get(key);
  if (!category) {
    category = {
      id: categories.size + 1,
      title,
      createdAt: airdate || "1984-09-10T12:00:00.000Z",
      clues: [],
      seen: new Set(),
    };
    categories.set(key, category);
  }

  const dedupeKey = `${value ?? "final"}|${question}|${answer}`;
  if (category.seen.has(dedupeKey)) {
    skipped += 1;
    continue;
  }
  category.seen.add(dedupeKey);
  category.clues.push({
    question,
    answer,
    value,
    airdate,
    gameId: Number.isInteger(gameId) ? gameId : null,
    createdAt: airdate || category.createdAt,
  });
}

let clueId = 0;
let finalPos = 0;
const categoryRows = [];
const clueRows = [];

for (const category of categories.values()) {
  category.clues.sort((a, b) => {
    if (a.value == null && b.value == null) return 0;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return a.value - b.value;
  });

  for (const clue of category.clues) {
    clueId += 1;
    const isFinal = clue.value == null;
    if (isFinal) finalPos += 1;
    clueRows.push([
      sqlNumber(clueId),
      sqlString(clue.answer),
      sqlString(clue.question),
      sqlNumber(clue.value),
      clue.airdate ? sqlString(clue.airdate) : "NULL",
      sqlString(clue.createdAt),
      sqlString(clue.createdAt),
      sqlNumber(category.id),
      sqlNumber(clue.gameId),
      "0",
      isFinal ? sqlNumber(finalPos) : "NULL",
    ]);
  }

  categoryRows.push([
    sqlNumber(category.id),
    sqlString(category.title),
    sqlString(category.createdAt),
    sqlString(category.createdAt),
    sqlNumber(category.clues.length),
  ]);
}

await mkdir(outputDir, { recursive: true });
const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
await writeFile(path.join(outputDir, "0000_schema.sql"), schema);

const writer = new SqlWriter(outputDir);
await writer.insert("categories", ["id", "title", "created_at", "updated_at", "clues_count"], categoryRows);
await writer.insert(
  "clues",
  [
    "id",
    "answer",
    "question",
    "value",
    "airdate",
    "created_at",
    "updated_at",
    "category_id",
    "game_id",
    "invalid_count",
    "final_pos",
  ],
  clueRows
);
await writer.close();

const indexes = `CREATE INDEX IF NOT EXISTS idx_clues_category_id ON clues(category_id);
CREATE INDEX IF NOT EXISTS idx_clues_airdate ON clues(airdate);
CREATE INDEX IF NOT EXISTS idx_clues_game_id ON clues(game_id);
CREATE INDEX IF NOT EXISTS idx_clues_value ON clues(value);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clues_final_pos ON clues(final_pos) WHERE final_pos IS NOT NULL;
INSERT INTO meta (key, value) VALUES ('clue_count', ${clueId});
INSERT INTO meta (key, value) VALUES ('final_count', ${finalPos});
`;
await writeFile(path.join(outputDir, "zzzz_indexes.sql"), indexes);

console.log(
  JSON.stringify(
    {
      sourceRows: raw.length,
      categories: categoryRows.length,
      clues: clueId,
      finals: finalPos,
      skipped,
      outputDir,
    },
    null,
    2
  )
);
