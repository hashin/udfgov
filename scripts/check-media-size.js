#!/usr/bin/env node
// Warns (never fails the build) when src/uploads is approaching the point
// where storing images directly in this git repo stops being a good idea.
// Thresholds are set well below GitHub's own guidance and Cloudflare Pages'
// hard 20,000-file-per-deployment cap, so there's a real runway between the
// first warning and an actual problem -- see docs/HANDOFF.md for the
// Cloudflare R2 migration plan to follow once this fires.
const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "..", "src", "uploads");
const WARN_SIZE_MB = 250; // GitHub "ideally < 1 GB" per repo -- warn at ~25% of that
const WARN_FILE_COUNT = 3000; // Cloudflare Pages caps a deployment at 20,000 files total

function walk(dir) {
  let size = 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walk(full);
      size += sub.size;
      count += sub.count;
    } else {
      size += fs.statSync(full).size;
      count += 1;
    }
  }
  return { size, count };
}

if (!fs.existsSync(UPLOADS_DIR)) {
  console.log("check-media-size: src/uploads not found, skipping.");
  process.exit(0);
}

const { size, count } = walk(UPLOADS_DIR);
const sizeMB = size / (1024 * 1024);

console.log(`check-media-size: src/uploads is ${sizeMB.toFixed(1)} MB across ${count} files.`);

const overSize = sizeMB > WARN_SIZE_MB;
const overCount = count > WARN_FILE_COUNT;

if (overSize || overCount) {
  const reasons = [];
  if (overSize) reasons.push(`size ${sizeMB.toFixed(1)} MB exceeds ${WARN_SIZE_MB} MB`);
  if (overCount) reasons.push(`file count ${count} exceeds ${WARN_FILE_COUNT}`);
  console.log(
    `::warning::src/uploads is getting large (${reasons.join(
      "; "
    )}). Storing images directly in this git repo is starting to approach GitHub's size guidance and Cloudflare Pages' 20,000-file deployment cap. See "Image storage" in docs/HANDOFF.md for the free Cloudflare R2 migration plan.`
  );
}

process.exit(0);
