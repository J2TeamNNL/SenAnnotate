# Context — the API, the credential, and the setup

## Use API v2, not v1.1

The widely-copied recipe for this uses `www.googleapis.com/chromewebstore/v1.1/items/{id}`.
That endpoint is **scheduled to stop serving on 15 October 2026**. Anything written against
it now has weeks of life left, so this uses v2:

| | v2 |
|---|---|
| Upload | `POST https://chromewebstore.googleapis.com/upload/v2/publishers/{PUBLISHER_ID}/items/{EXTENSION_ID}:upload` |
| Publish | `POST https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER_ID}/items/{EXTENSION_ID}:publish` |
| Token | `POST https://oauth2.googleapis.com/token` |
| Scope | `https://www.googleapis.com/auth/chromewebstore` |

The publisher id in the path is the visible difference from v1.1, and the reason a v1.1
recipe cannot simply have its hostname swapped.

## Service account, not a refresh token

Both work. The service account is the default here because the refresh-token flow has a trap
that only shows up a week later: **while the OAuth consent screen is in "Testing", Google
expires refresh tokens after seven days.** Set it up, watch the release work, and the next
release silently fails with `invalid_grant` for no reason connected to anything that changed.
Avoiding that means remembering to move the consent screen to production — a step nothing in
the repo can enforce.

A service-account key does not expire. Its own cost is real but smaller: a long-lived private
key lives in a GitHub secret, and only **one service account can be attached per publisher**,
so it is a shared credential rather than a per-pipeline one.

The refresh-token path is still supported by the script, for anyone who already has one.

The JWT for the service account is assembled and signed by hand — `crypto.createSign`
("RSA-SHA256") plus base64url, about fifteen lines — rather than pulling in `googleapis`.
That keeps the repo's zero-dependency property, and this is the one place where a
hand-rolled crypto detail could silently produce a token that never works, so it was
verified rather than assumed: signed with a throwaway RSA key, Google answers
`invalid_grant: account not found` — it parsed and **accepted the signature**, and rejected
only the non-existent account. A malformed or mis-signed assertion answers
`Invalid JWT Signature` instead.

## Setup, once

1. **Google Cloud** — create or pick a project, enable **Chrome Web Store API**.
2. **Service account** — create one in that project. It needs no IAM roles. Create a JSON
   key and download it.
3. **Developer Dashboard → Account** — add the service account's email address. Only one is
   allowed per publisher, so if one is already attached, reuse it.
4. **Collect two ids.** `CWS_EXTENSION_ID` is the item id, visible in the dashboard URL for
   the item. `CWS_PUBLISHER_ID` is on the same **Account** page as the service-account
   field. Google's own docs do not spell out where the publisher id is displayed, so if the
   first run answers 403 or 404, that value is the thing to re-check before anything else.
5. **Repository secrets** — Settings → Secrets and variables → Actions:

   | Secret | Value |
   |---|---|
   | `CWS_PUBLISHER_ID` | from step 4 |
   | `CWS_EXTENSION_ID` | from step 4 |
   | `CWS_SERVICE_ACCOUNT_JSON` | the entire key file, pasted |

6. **Submit the first version by hand.** The API ships new versions of an item that already
   exists; it cannot create the listing.

Optional: set the repository **variable** `CWS_UPLOAD_ONLY` to `true` to upload without
submitting for review — useful when a release should reach the Store but wait for a human.

## Why the step skips instead of failing

Until step 6 happens there is no item to upload to, and a red release run for that reason
would be noise on every tag. So no credentials at all is a skip with a printed reason, exit
0.

The opposite case is deliberately loud: if *some* of the values are present, the run fails.
That is what a renamed secret or a rotated key looks like, and the failure mode to avoid is
releases that keep going green while nothing reaches the Store.

## Ordering inside the workflow

The Store step runs **after** `gh release create`. The GitHub Release is ours and always
succeeds; the Store call depends on Google. If it were first, an outage on their side would
cost us the release artifact too.

Secrets are scoped to that one step rather than the job, so `npm ci` and the build cannot
read them. The step's `run:` interpolates no `${{ }}` expression — every value arrives as an
environment variable, which is also why the existing tag-check step reads `GITHUB_REF_NAME`
instead of `${{ github.ref_name }}`.

## Sources

- [Use the Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Introducing a new Chrome Web Store API](https://developer.chrome.com/blog/cws-api-v2) — the 15 October 2026 sunset
- [Use a service account with the Chrome Web Store API](https://developer.chrome.com/docs/webstore/service-accounts)
