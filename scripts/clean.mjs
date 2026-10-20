export function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (entity, digits) => {
      const code = Number(digits);
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) {
        return entity;
      }
      return String.fromCodePoint(code);
    })
    .replace(/&amp;/gi, "&");
}

export function cleanText(value, { unwrapQuotes = false } = {}) {
  let text = String(value ?? "");
  if (
    unwrapQuotes &&
    text.length >= 2 &&
    text.startsWith("'") &&
    text.endsWith("'")
  ) {
    text = text.slice(1, -1);
  }
  text = text.replace(/<[^>]*>/g, " ");
  text = decodeEntities(text);
  text = text.replace(/\\'/g, "'");
  return text.replace(/\s+/g, " ").trim();
}

export function parseValue(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "none" || text.toLowerCase() === "null") {
    return null;
  }
  const amount = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function toAirdate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? "").trim());
  if (!match) return null;
  return `${match[1]}T12:00:00.000Z`;
}
