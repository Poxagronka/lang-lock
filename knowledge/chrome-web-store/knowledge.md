# Chrome Web Store — knowledge

## fetchStatus (API v2) is empty for a first submission

- Fact (2026-10-10, verified): while Lang Lock 1.0.0, the first submission of a new item, showed "Pending review" in the Developer Dashboard, `GET /v2/publishers/{publisherId}/items/{itemId}:fetchStatus` returned only `name`, `itemId` and `publicKey`. It returned no `submittedItemRevisionStatus` and no `publishedItemRevisionStatus`.
- Consequence: `npm run status` prints `submitted: none` during the first review. Use the dashboard Items list or the review email for the first review. The script is useful from the first published version on (to be verified on the next submission).
