// =============================================================================
// Publish to the Chrome Web Store
// =============================================================================
//
// Uploads the packed zip to an existing Web Store item and submits it for review.
//
//   node scripts/publish-store.mjs [path/to/senannotate-x.y.z.zip]
//
// With no argument it picks the zip matching package.json's version, which is what CI
// does straight after `npm run pack`.
//
// API v2 (`chromewebstore.googleapis.com`), not the old `www.googleapis.com/chromewebstore/
// v1.1`: v1.1 is scheduled to stop serving on 15 October 2026, and v2 is the only one that
// accepts service-account credentials.
//
// Two things this cannot do, both by design of the Store rather than of this script:
//
//   - Create the item. The first submission — listing text, graphic assets, the privacy
//     form — has to be done by hand in the dashboard. This only ships new versions of an
//     item that already exists.
//   - Skip review. Publishing means "submitted for review". With a host permission that
//     review is a manual one, so the new version goes live days later, not on push.
//
// Dependency-free: `fetch` and `crypto` are both in Node.
// =============================================================================

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://chromewebstore.googleapis.com";

const {
  CWS_PUBLISHER_ID,
  CWS_EXTENSION_ID,
  CWS_SERVICE_ACCOUNT_JSON,
  CWS_CLIENT_ID,
  CWS_CLIENT_SECRET,
  CWS_REFRESH_TOKEN,
  CWS_UPLOAD_ONLY,
} = process.env;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Access token
// -----------------------------------------------------------------------------
//
// A service account is the better credential for CI and is tried first. The refresh-token
// flow is kept as a fallback for anyone who already has one, but it has a trap worth
// knowing: while the OAuth consent screen is in "Testing", Google expires refresh tokens
// after seven days, so releases start failing a week after setup for no visible reason. A
// service-account key does not expire.

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function tokenFromServiceAccount(raw) {
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    fail("CWS_SERVICE_ACCOUNT_JSON is set but is not valid JSON — paste the whole key file.");
  }
  if (!key.client_email || !key.private_key) {
    fail("CWS_SERVICE_ACCOUNT_JSON has no client_email/private_key — is it the right file?");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer
    .sign(key.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  return postToken({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
}

async function tokenFromRefreshToken() {
  return postToken({
    grant_type: "refresh_token",
    client_id: CWS_CLIENT_ID,
    client_secret: CWS_CLIENT_SECRET,
    refresh_token: CWS_REFRESH_TOKEN,
  });
}

async function postToken(fields) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const body = await response.text();

  if (!response.ok) {
    // Google's token errors are terse but the body names the cause — print it whole rather
    // than a summary, because "invalid_grant" alone sends you looking in the wrong place.
    fail(`Could not get an access token (HTTP ${response.status}).\n${body}`);
  }

  const { access_token: token } = JSON.parse(body);
  if (!token) fail(`The token response carried no access_token.\n${body}`);
  return token;
}

async function accessToken() {
  if (CWS_SERVICE_ACCOUNT_JSON) return tokenFromServiceAccount(CWS_SERVICE_ACCOUNT_JSON);
  if (CWS_CLIENT_ID && CWS_CLIENT_SECRET && CWS_REFRESH_TOKEN) return tokenFromRefreshToken();

  fail(
    "No Web Store credentials in the environment. Set either\n" +
      "  CWS_SERVICE_ACCOUNT_JSON  the whole service-account key file (recommended), or\n" +
      "  CWS_CLIENT_ID + CWS_CLIENT_SECRET + CWS_REFRESH_TOKEN\n" +
      "plus CWS_PUBLISHER_ID and CWS_EXTENSION_ID. See docs/chrome-store-publish/.",
  );
}

// -----------------------------------------------------------------------------
// Upload and publish
// -----------------------------------------------------------------------------

async function call(url, token, { body, contentType } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(contentType ? { "content-type": contentType } : {}),
    },
    body,
  });

  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

/**
 * Nothing configured at all means "not set up yet" — the Store item does not exist until
 * someone submits the first version by hand, and tagging a release must keep working until
 * then. That is a skip, not a failure.
 *
 * Some-but-not-all configured is the opposite: a typo in a secret name, or a credential
 * that was rotated away. Failing loudly there is the whole point, because the alternative
 * is releases that quietly stop reaching the Store.
 */
function configured() {
  const ids = [CWS_PUBLISHER_ID, CWS_EXTENSION_ID];
  const creds = [
    CWS_SERVICE_ACCOUNT_JSON,
    CWS_CLIENT_ID,
    CWS_CLIENT_SECRET,
    CWS_REFRESH_TOKEN,
  ];
  const anything = [...ids, ...creds].some(Boolean);

  if (!anything) {
    console.log(
      "\nNo Chrome Web Store credentials set — skipping the Store upload.\n" +
        "  Set CWS_PUBLISHER_ID, CWS_EXTENSION_ID and CWS_SERVICE_ACCOUNT_JSON to enable it.\n" +
        "  See docs/chrome-store-publish/.\n",
    );
    return false;
  }
  return true;
}

async function main() {
  // `--check` is invoked deliberately, to answer "are the secrets right?". Skipping quietly
  // there would answer with a green tick, which is the one wrong answer it could give — so
  // the skip applies only to the release path, and a bare `--check` fails instead.
  const checkOnly = process.argv.includes("--check");
  if (!checkOnly && !configured()) return;

  if (!CWS_PUBLISHER_ID) fail("CWS_PUBLISHER_ID is not set (Developer Dashboard → Account).");
  if (!CWS_EXTENSION_ID) fail("CWS_EXTENSION_ID is not set (the item's id in its dashboard URL).");

  const item = `publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`;

  // `--check` proves the credential chain and the two ids without touching the listing:
  // `:fetchStatus` only reads. Worth having, because the alternative way to discover that a
  // secret is wrong is a failed release, mid-release.
  if (process.argv.includes("--check")) {
    const token = await accessToken();
    const status = await call(`${API}/v2/${item}:fetchStatus`, token);
    if (!status.ok) {
      fail(
        `fetchStatus failed (HTTP ${status.status}).\n${status.text}\n\n` +
          `403/404 here almost always means CWS_PUBLISHER_ID or CWS_EXTENSION_ID is wrong,\n` +
          `or the service account has not been added under Developer Dashboard → Account.`,
      );
    }
    console.log(`credentials work. Store says:\n${status.text}`);
    return;
  }

  const { version } = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  const zipPath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(ROOT, `senannotate-${version}.zip`);

  let zip;
  try {
    zip = await readFile(zipPath);
  } catch {
    fail(`No zip at ${zipPath}. Run \`npm run pack\` first.`);
  }

  const token = await accessToken();

  console.log(`uploading ${zipPath} (${(zip.length / 1024).toFixed(0)} KB) as ${version}…`);
  const upload = await call(`${API}/upload/v2/${item}:upload`, token, {
    body: zip,
    contentType: "application/zip",
  });

  if (!upload.ok) {
    // The most common cause by far, and the message Google returns for it is not obvious:
    // the manifest version must be strictly higher than the published one.
    fail(
      `Upload failed (HTTP ${upload.status}).\n${upload.text}\n\n` +
        `If this mentions a version conflict: ${version} is not higher than what is already\n` +
        `on the Store. Bump package.json — the build stamps the manifest from it.`,
    );
  }
  console.log(`  uploaded${upload.text.trim() ? `: ${upload.text.trim()}` : ""}`);

  if (CWS_UPLOAD_ONLY === "true") {
    console.log("\nCWS_UPLOAD_ONLY=true — left as a draft, publish it from the dashboard.\n");
    return;
  }

  console.log("submitting for review…");
  const publish = await call(`${API}/v2/${item}:publish`, token);
  if (!publish.ok) {
    fail(
      `Publish failed (HTTP ${publish.status}).\n${publish.text}\n\n` +
        `The upload itself succeeded, so the version is on the Store as a draft — you can\n` +
        `submit it by hand from the dashboard.`,
    );
  }

  console.log(`  submitted${publish.text.trim() ? `: ${publish.text.trim()}` : ""}`);
  console.log(
    `\n${version} is in review. With a host permission that review is manual, so expect\n` +
      `days rather than minutes before it goes live.\n`,
  );
}

await main();
