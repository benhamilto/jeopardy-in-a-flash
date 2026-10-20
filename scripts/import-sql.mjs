import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const remote = process.argv.includes("--remote");
const temporary = process.argv.includes("--temporary");
const dirFlag = process.argv.find((arg) => arg.startsWith("--dir="));
const directory = dirFlag ? dirFlag.slice("--dir=".length) : "/tmp/jeopardy-data/sql";
const database = "jservice";

const files = (await readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No SQL files in ${directory}`);
}

for (const name of files) {
  const file = path.join(directory, name);
  console.log(`\nImporting ${name} (${remote ? "remote" : "local"})`);
  const args = [
    "wrangler",
    "d1",
    "execute",
    database,
    `--file=${file}`,
    remote ? "--remote" : "--local",
    "--yes",
    ...(temporary ? ["--temporary"] : []),
  ];
  const code = await new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code !== 0) {
    throw new Error(`${name} failed with exit code ${code}`);
  }
}
