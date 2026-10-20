const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");

async function get(path) {
  const response = await fetch(`${base}${path}`);
  const body = await response.json();
  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const health = await get("/api/health");
assert(health.response.status === 200, "health status");
assert(health.body.clue_count > 1000, `expected a loaded database, got ${health.body.clue_count}`);

const random = await get("/api/random?count=1");
assert(random.response.status === 200, "random status");
assert(Array.isArray(random.body) && random.body.length === 1, "random returns one clue");
const clue = random.body[0];
assert(typeof clue.question === "string" && clue.question.length > 0, "clue question");
assert(typeof clue.answer === "string" && clue.answer.length > 0, "clue answer");
assert(clue.category && typeof clue.category.id === "number", "embedded category");
assert(clue.category.clues_count >= 1, "category clue count");
assert(random.response.headers.get("access-control-allow-origin") === "*", "CORS header");

const categoryClues = await get(`/api/clues?category=${clue.category.id}`);
assert(categoryClues.response.status === 200, "clues status");
assert(categoryClues.body.length >= 1 && categoryClues.body.length <= 100, "clues page size");
assert(
  categoryClues.body.every((row) => row.category.id === clue.category.id),
  "clues stay in the requested category"
);
assert(
  categoryClues.body.some((row) => row.id === clue.id),
  "random clue is in its category"
);

const board = categoryClues.body.slice(0, 5);
assert(board.length >= 1 && board[0].category.title === clue.category.title, "board title");

const finalClue = await get("/api/final?count=1");
assert(finalClue.body.length === 1 && finalClue.body[0].value == null, "final clue has no value");

const categories = await get("/api/categories");
assert(categories.body.length === 1, "categories defaults to one, matching jService");
const two = await get("/api/categories?count=2");
assert(two.body.length === 2, "categories count");

const single = await get(`/api/category?id=${clue.category.id}`);
assert(single.response.status === 200, "category status");
assert(single.body.clues.length === clue.category.clues_count, "category includes its clues");
assert(!("created_at" in single.body.clues[0]), "nested clues omit created_at");

const missing = await get("/api/category?id=999999999");
assert(missing.response.status === 404, "missing category");

const preflight = await fetch(`${base}/api/random`, { method: "OPTIONS" });
assert(preflight.status === 204, "preflight");

const marked = await fetch(`${base}/api/invalid?id=${clue.id}`, { method: "POST" });
const markedBody = await marked.json();
assert(marked.status === 200, "mark invalid");
assert(markedBody.invalid_count === (clue.invalid_count || 0) + 1, "invalid count incremented");

console.log(
  JSON.stringify(
    {
      ok: true,
      clue_count: health.body.clue_count,
      sample: {
        category: clue.category.title,
        value: clue.value,
        question: clue.question,
        answer: clue.answer,
      },
    },
    null,
    2
  )
);
