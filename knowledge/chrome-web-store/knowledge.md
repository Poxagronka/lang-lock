# Chrome Web Store — knowledge

## fetchStatus (API v2) is empty for a first submission

- Fact (2026-10-10, verified): while Lang Lock 1.0.0, the first submission of a new item, showed "Pending review" in the Developer Dashboard, `GET /v2/publishers/{publisherId}/items/{itemId}:fetchStatus` returned only `name`, `itemId` and `publicKey`. It returned no `submittedItemRevisionStatus` and no `publishedItemRevisionStatus`.
- Consequence: `npm run status` prints `submitted: none` during the first review. Use the dashboard Items list or the review email for the first review. The script is useful from the first published version on (verified 2026-10-24: it showed `published: PUBLISHED [1.0.1@100%]`).

## Publish API v2: upload, submit, service account (verified 2026-10-24 against developer.chrome.com docs)

- Scope for upload and publish: `https://www.googleapis.com/auth/chromewebstore`. The `.readonly` scope of `scripts/status.mjs` cannot upload.
- Upload: `POST https://chromewebstore.googleapis.com/upload/v2/publishers/<publisher>/items/<item>:upload`. When `uploadState` is `IN_PROGRESS`, poll `:fetchStatus` and read `lastAsyncUploadState` (`SUCCEEDED`, `IN_PROGRESS`, `FAILED`, `NOT_FOUND`).
- Submit: `POST .../items/<item>:publish`. Optional body fields: `publishType` (`DEFAULT_PUBLISH`, `STAGED_PUBLISH`), `deployInfos`, `skipReview`, `blockOnWarnings`.
- A service account works with the API once its email is added in the Developer Dashboard. Only one service account per publisher.
- The owner Google account needs 2-step verification to publish updates.
- cmux-cua could not drive the dashboard in Chrome Beta: AX tree has no page content, and background or foreground pixel input often did not land. Add the service account by hand.
