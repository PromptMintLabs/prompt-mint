# Marketplace read caching

## Summary

Public marketplace listing reads now use a stale-while-revalidate strategy. The browse experience serves the last known marketplace data immediately while a fresh read is triggered in the background.

## Behavior

- The browse page reads from the PromptHash contract first.
- If the live read succeeds, the response is written to local storage and used as the next cached snapshot.
- If the live read fails and a cached snapshot exists, the UI serves that cached snapshot while a background revalidation attempt continues.
- Cached content is considered stale after 60 seconds and may still be shown for up to 5 minutes while revalidation is attempted.
- Once the stale window expires, the cached snapshot is ignored and the UI surfaces the network error instead of silently serving old data.

## Permissions and authority

- Marketplace access checks still run through the separate access query and the on-chain `hasAccess` call.
- The cache only stores public listing metadata. It does not bypass the wallet or permission checks for individual prompts.
- Purchases, unlocks, and other write flows remain unchanged and continue to invalidate the prompt queries after success.

## Edge cases

- No cache yet: the page shows a loading state and then the live data if the read succeeds.
- Network timeout with no cache: the page shows a clear sync error.
- Network timeout with stale cache: the page shows the last known data plus a notice that the live refresh is retrying.
- Offline state: the badge indicates offline/degraded mode and cached data is shown if present.

## Compatibility

This change is backward compatible. Existing marketplace flows continue to work without migration; the only visible change is that browse reads become more resilient to transient network issues.
