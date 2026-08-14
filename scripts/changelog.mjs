// =============================================================================
// Generate CHANGELOG.md from the tags and the commits between them
// =============================================================================
//
// `gh release create --generate-notes` writes a release body from merged pull
// requests. This repo has none — work lands on `main` directly and a release is
// squashed into one or two commits — so the generated notes came out as a bare
// two-line commit list for a release carrying five features. See
// `docs/release-changelog/context.md`.
//
// Every commit in the history parses as a Conventional Commit, which is what
// makes generation viable at all: the subjects are already written as prose, so
// grouping them by type loses almost nothing and costs nobody a hand-written
// file that would go stale.
//
// Two modes:
//
//   node scripts/changelog.mjs              rewrite CHANGELOG.md from git
//   node scripts/changelog.mjs --extract X  print version X's section to stdout
//
// `--extract` reads the committed CHANGELOG.md and nothing else, and exits 1
// when the section is missing or empty. `release.yml` calls it that way, so a
// tag with no changelog fails the release before anything is published.
//
// Shells out to `git` rather than take a dependency, the same trade `pack.mjs`
// makes with the system `zip`.
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const COMPARE = "https://github.com/thangnm93/SenAnnotate/compare";

// Section order is the reading order: what breaks you, then what you gain, then
// what got repaired, then the rest. `Other` catches anything that does not parse
// as a Conventional Commit — it should stay empty, and if it does not, that is a
// commit message worth fixing rather than a case worth handling silently.
const SECTIONS = [
  { title: "Breaking changes", types: [] }, // filled by the `!` / BREAKING CHANGE rule
  { title: "Added", types: ["feat"] },
  { title: "Fixed", types: ["fix"] },
  { title: "Changed", types: ["refactor", "perf", "style"] },
  { title: "Documentation", types: ["docs"] },
  { title: "Internal", types: ["chore", "test", "ci", "build"] },
  { title: "Other", types: [] }, // filled by the unparsed rule
];

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

// -----------------------------------------------------------------------------
// Versions
// -----------------------------------------------------------------------------

const parseVersion = (text) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const compareVersions = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// Sorted by parsed semver, never by creation date: v0.3.1 and v0.3.2 were tagged
// minutes apart, and a rebase or a re-push would reorder them by date while the
// numbers stay correct.
function releasedTags() {
  const tags = git("tag", "-l", "v*.*.*")
    .split("\n")
    .filter(Boolean)
    .map((name) => ({ name, version: parseVersion(name) }))
    .filter((t) => t.version);
  tags.sort((a, b) => compareVersions(a.version, b.version));
  return tags;
}

// The version in package.json is the top section whether or not it has been
// tagged yet. When the tag exists the range ends there; when it does not, the
// range runs to HEAD and the section is marked unreleased. Every release passes
// through the second state — that is the state you generate the file in, just
// before committing the bump.
function timeline() {
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const tags = releasedTags();
  const entries = [];

  tags.forEach((tag, i) => {
    entries.push({
      version: tag.name.slice(1),
      date: git("log", "-1", "--format=%cs", tag.name),
      range: i === 0 ? tag.name : `${tags[i - 1].name}..${tag.name}`,
      previous: i === 0 ? null : tags[i - 1].name,
      ref: tag.name,
      released: true,
    });
  });

  if (!tags.some((t) => t.name === `v${version}`)) {
    const newest = tags[tags.length - 1];
    entries.push({
      version,
      date: git("log", "-1", "--format=%cs", "HEAD"),
      range: newest ? `${newest.name}..HEAD` : "HEAD",
      previous: newest ? newest.name : null,
      ref: "HEAD",
      released: false,
    });
  }

  return entries.reverse();
}

// -----------------------------------------------------------------------------
// Commits
// -----------------------------------------------------------------------------

const UNIT = "\x1f";
const RECORD = "\x1e";

// Unit separators between fields and a record separator between commits: a body
// spans newlines, so splitting on them would tear records in half.
function commitsIn(range) {
  const raw = git("log", "--no-merges", `--format=%H${UNIT}%s${UNIT}%b${RECORD}`, range);
  return raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, body = ""] = record.split(UNIT);
      return { sha, subject, body };
    });
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;

// Subjects carry two kinds of release bookkeeping that read as noise inside a
// section already headed by the version:
//
//   fix: keep the hover label inside the viewport; 0.5.3
//   chore: release 0.6.0, with README screenshots and the Web Store link
//
// The trailing `; <version>` goes. The `release <version>` prefix goes too, but
// only the prefix — that second commit also carries the README and Store-link
// work, and dropping the whole commit would lose it. A subject that is *nothing
// but* the bump has nothing left to say and is dropped.
function cleanSubject(type, text) {
  let subject = text.replace(/[;,]\s*v?\d+\.\d+\.\d+\s*$/, "").trim();

  if (type === "chore") {
    const bump = /^release\s+v?\d+\.\d+\.\d+\s*(?:[,:]\s*(?:with\s+)?)?/i;
    const rest = subject.replace(bump, "").trim();
    if (bump.test(subject)) subject = rest;
  }

  return subject;
}

function classify(commit) {
  const match = CONVENTIONAL.exec(commit.subject);
  if (!match) return { section: "Other", text: commit.subject, sha: commit.sha };

  const [, type, scope, bang, rawSubject] = match;
  const subject = cleanSubject(type, rawSubject);
  if (!subject) return null;

  const breaking = Boolean(bang) || /^BREAKING CHANGE:/m.test(commit.body);
  const section = breaking
    ? "Breaking changes"
    : (SECTIONS.find((s) => s.types.includes(type))?.title ?? "Other");

  return { section, text: scope ? `**${scope}:** ${subject}` : subject, sha: commit.sha };
}

function groupCommits(range) {
  const grouped = new Map(SECTIONS.map((s) => [s.title, []]));
  for (const commit of commitsIn(range)) {
    const entry = classify(commit);
    if (entry) grouped.get(entry.section).push(entry);
  }
  return grouped;
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

const HEADER = `# Changelog

All notable changes to SenAnnotate, newest first.

Generated by \`npm run changelog\` from the \`v*.*.*\` tags and the
[Conventional Commit](https://www.conventionalcommits.org/) subjects between them —
edit the commits, not this file. \`.github/workflows/release.yml\` reads the section
matching the tag being released and refuses to publish without one.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`;

function renderEntry(entry) {
  return `- ${entry.text} (${entry.sha.slice(0, 7)})`;
}

function renderVersion(entry) {
  const grouped = groupCommits(entry.range);
  const lines = [];

  const heading = entry.released
    ? `## [${entry.version}] — ${entry.date}`
    : `## [${entry.version}] — unreleased`;
  lines.push(heading, "");

  // The compare link points at `v<version>` even before that tag exists. `...HEAD`
  // would be correct at the moment of release and wrong a month later, when HEAD
  // has moved on and the link shows a diff spanning several releases. The tag is
  // the stable target, and the window where it 404s is the minutes between the
  // version bump and `git push --tags` — the same window the heading calls
  // unreleased.
  if (entry.previous) {
    lines.push(
      `[Compare with ${entry.previous}](${COMPARE}/${entry.previous}...v${entry.version})`,
      "",
    );
  }

  let empty = true;
  for (const { title } of SECTIONS) {
    const entries = grouped.get(title);
    if (!entries.length) continue;
    empty = false;
    lines.push(`### ${title}`, "", ...entries.map(renderEntry), "");
  }

  if (empty) lines.push("_No commits recorded for this version._", "");

  return lines.join("\n");
}

function generate() {
  const body = timeline().map(renderVersion).join("\n");
  writeFileSync(CHANGELOG, `${HEADER}\n${body}`);
  console.log(`changelog → ${CHANGELOG}`);
}

// -----------------------------------------------------------------------------
// Extraction
// -----------------------------------------------------------------------------

// Reads the committed file, never git — CI must be able to tell "this tag has no
// changelog" apart from "the generator would produce one if you ran it". Those
// are the same thing only when the file is up to date, and the whole point of
// the gate is to catch the release where it is not.
function extract(version) {
  let text;
  try {
    text = readFileSync(CHANGELOG, "utf8");
  } catch {
    console.error(`No CHANGELOG.md at ${CHANGELOG}. Run \`npm run changelog\`.`);
    process.exit(1);
  }

  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) {
    console.error(
      `CHANGELOG.md has no section for ${version}. Bump package.json, run ` +
        "`npm run changelog`, and commit the result before tagging.",
    );
    process.exit(1);
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## [")) {
      end = i;
      break;
    }
  }

  const section = lines.slice(start + 1, end).join("\n").trim();
  if (!section || section.startsWith("_No commits recorded")) {
    console.error(`CHANGELOG.md's section for ${version} is empty.`);
    process.exit(1);
  }

  console.log(section);
}

// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = args.indexOf("--extract");

if (flag !== -1) {
  const version = args[flag + 1];
  if (!version || !parseVersion(version)) {
    console.error("Usage: node scripts/changelog.mjs --extract <version>");
    process.exit(1);
  }
  extract(version.replace(/^v/, ""));
} else {
  generate();
}
