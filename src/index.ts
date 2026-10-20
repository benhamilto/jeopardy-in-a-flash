const CLUE_SELECT = `
  c.id AS id,
  c.answer AS answer,
  c.question AS question,
  c.value AS value,
  c.airdate AS airdate,
  c.created_at AS created_at,
  c.updated_at AS updated_at,
  c.category_id AS category_id,
  c.game_id AS game_id,
  c.invalid_count AS invalid_count,
  cat.id AS cat_id,
  cat.title AS cat_title,
  cat.created_at AS cat_created_at,
  cat.updated_at AS cat_updated_at,
  cat.clues_count AS cat_clues_count
`;

type ClueRow = {
  id: number;
  answer: string;
  question: string;
  value: number | null;
  airdate: string | null;
  created_at: string;
  updated_at: string;
  category_id: number;
  game_id: number | null;
  invalid_count: number | null;
  cat_id: number;
  cat_title: string;
  cat_created_at: string;
  cat_updated_at: string;
  cat_clues_count: number;
  final_pos?: number;
};

type CategoryRow = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  clues_count: number;
};

type NestedClueRow = {
  id: number;
  answer: string;
  question: string;
  value: number | null;
  airdate: string | null;
  category_id: number;
  game_id: number | null;
  invalid_count: number | null;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "cache-control": "no-store",
    },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify(event));
}

function routePath(url: URL): string {
  const trimmed = url.pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function intParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) return undefined;
  return value;
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value == undefined) return fallback;
  return Math.min(max, Math.max(min, value));
}

function dateBound(raw: string | null, end: boolean): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  if (!match) return null;
  return end ? `${match[1]}T23:59:59.999Z` : `${match[1]}T00:00:00.000Z`;
}

function categoryFromClue(row: ClueRow) {
  return {
    id: row.cat_id,
    title: row.cat_title,
    created_at: row.cat_created_at,
    updated_at: row.cat_updated_at,
    clues_count: row.cat_clues_count,
  };
}

function categoryJson(row: CategoryRow) {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    clues_count: row.clues_count,
  };
}

function clueJson(row: ClueRow) {
  return {
    id: row.id,
    answer: row.answer,
    question: row.question,
    value: row.value,
    airdate: row.airdate,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category_id: row.category_id,
    game_id: row.game_id,
    invalid_count: row.invalid_count,
    category: categoryFromClue(row),
  };
}

function placeholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

async function metaCount(db: D1Database, key: string): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .bind(key)
    .first<{ value: number }>();
  return row?.value ?? 0;
}

function randomPositions(total: number, count: number): number[] {
  const picks = new Set<number>();
  const size = Math.min(count, total);
  while (picks.size < size) {
    picks.add(1 + Math.floor(Math.random() * total));
  }
  return [...picks];
}

async function cluesByColumn(
  db: D1Database,
  column: "id" | "final_pos",
  positions: number[]
): Promise<ClueRow[]> {
  if (positions.length === 0) return [];
  const result = await db
    .prepare(
      `SELECT ${CLUE_SELECT}, c.final_pos AS final_pos
       FROM clues c
       JOIN categories cat ON cat.id = c.category_id
       WHERE c.${column} IN (${placeholders(positions.length)})`
    )
    .bind(...positions)
    .all<ClueRow>();
  const byPosition = new Map(
    result.results.map((row) => [column === "id" ? row.id : row.final_pos, row])
  );
  return positions
    .map((position) => byPosition.get(position))
    .filter((row): row is ClueRow => row != undefined);
}

async function randomClues(db: D1Database, count: number, finalOnly: boolean): Promise<ClueRow[]> {
  if (count === 0) return [];
  const total = await metaCount(db, finalOnly ? "final_count" : "clue_count");
  if (total === 0) return [];
  const positions = randomPositions(total, count);
  return cluesByColumn(db, finalOnly ? "final_pos" : "id", positions);
}

async function listClues(db: D1Database, url: URL): Promise<Response> {
  const filters: string[] = [];
  const binds: Array<number | string> = [];

  const value = intParam(url, "value");
  if (url.searchParams.has("value")) {
    if (value == undefined) return json([]);
    filters.push("c.value = ?");
    binds.push(value);
  }

  const category = intParam(url, "category");
  if (url.searchParams.has("category")) {
    if (category == undefined) return json([]);
    filters.push("c.category_id = ?");
    binds.push(category);
  }

  const gameId = intParam(url, "game_id");
  if (url.searchParams.has("game_id")) {
    if (gameId == undefined) return json([]);
    filters.push("c.game_id = ?");
    binds.push(gameId);
  }

  const minDate = dateBound(url.searchParams.get("min_date"), false);
  const maxDate = dateBound(url.searchParams.get("max_date"), true);
  if ((url.searchParams.has("min_date") && !minDate) || (url.searchParams.has("max_date") && !maxDate)) {
    return json([]);
  }
  if (minDate) {
    filters.push("c.airdate >= ?");
    binds.push(minDate);
  }
  if (maxDate) {
    filters.push("c.airdate <= ?");
    binds.push(maxDate);
  }

  const offset = bounded(intParam(url, "offset"), 0, 0, 1_000_000_000);
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await db
    .prepare(
      `SELECT ${CLUE_SELECT}
       FROM clues c
       JOIN categories cat ON cat.id = c.category_id
       ${where}
       ORDER BY c.id
       LIMIT 100 OFFSET ?`
    )
    .bind(...binds, offset)
    .all<ClueRow>();

  return json(result.results.map((row) => clueJson(row)));
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = routePath(url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (path === "/api/health" && request.method === "GET") {
    const clueCount = await metaCount(env.DB, "clue_count");
    const finalCount = await metaCount(env.DB, "final_count");
    return json({ ok: clueCount > 0, clue_count: clueCount, final_count: finalCount });
  }

  if (path === "/api/random" && request.method === "GET") {
    const count = bounded(intParam(url, "count"), 1, 0, 100);
    const clues = await randomClues(env.DB, count, false);
    return json(clues.map((row) => clueJson(row)));
  }

  if (path === "/api/final" && request.method === "GET") {
    const count = bounded(intParam(url, "count"), 1, 0, 100);
    const clues = await randomClues(env.DB, count, true);
    return json(clues.map((row) => clueJson(row)));
  }

  if (path === "/api/clues" && request.method === "GET") {
    return listClues(env.DB, url);
  }

  if (path === "/api/categories" && request.method === "GET") {
    const count = bounded(intParam(url, "count"), 1, 0, 100);
    const offset = bounded(intParam(url, "offset"), 0, 0, 1_000_000_000);
    const result = await env.DB
      .prepare(
        `SELECT id, title, created_at, updated_at, clues_count
         FROM categories
         ORDER BY id
         LIMIT ? OFFSET ?`
      )
      .bind(count, offset)
      .all<CategoryRow>();
    return json(result.results.map((row) => categoryJson(row)));
  }

  if (path === "/api/category" && request.method === "GET") {
    const id = intParam(url, "id");
    if (id == undefined) return json({ error: "id is required" }, 400);
    const category = await env.DB
      .prepare(
        "SELECT id, title, created_at, updated_at, clues_count FROM categories WHERE id = ?"
      )
      .bind(id)
      .first<CategoryRow>();
    if (!category) return json({ error: "category not found" }, 404);
    const clues = await env.DB
      .prepare(
        `SELECT id, answer, question, value, airdate, category_id, game_id, invalid_count
         FROM clues
         WHERE category_id = ?
         ORDER BY id`
      )
      .bind(id)
      .all<NestedClueRow>();
    return json({ ...categoryJson(category), clues: clues.results });
  }

  if (path === "/api/invalid" && request.method === "POST") {
    let id = intParam(url, "id");
    if (id == undefined) {
      const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
      if (typeof body?.id === "number" && Number.isInteger(body.id)) id = body.id;
      if (typeof body?.id === "string" && Number.isInteger(Number(body.id))) id = Number(body.id);
    }
    if (id == undefined) return json({ error: "id is required" }, 400);
    const updated = await env.DB
      .prepare(
        `UPDATE clues
         SET invalid_count = COALESCE(invalid_count, 0) + 1,
             updated_at = ?
         WHERE id = ?
         RETURNING id, answer, question, value, airdate, created_at, updated_at, category_id, game_id, invalid_count`
      )
      .bind(new Date().toISOString(), id)
      .first<NestedClueRow & { created_at: string; updated_at: string }>();
    if (!updated) return json({ error: "clue not found" }, 404);
    return json(updated);
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const started = Date.now();
    try {
      const response = await handle(request, env);
      log({
        level: response.ok ? "info" : "error",
        message: "request",
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "request failed",
          method: request.method,
          path: url.pathname,
          durationMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return json({ error: "internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
