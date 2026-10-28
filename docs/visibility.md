# Website visibility

The customer dashboard opens with **Visibility**. Each record connects the visitor, referring source, supplied search term, landing page, declared goal or published crawler function, and observed page journey. Filters and table drilldowns use the same records; Export visits preserves the selected filters.

## Evidence rules

- **Crawler:** a recognized client header with a published indexing, training or crawling role. Identity confidence is shown separately; a header alone is a claim.
- **Agent / fetcher:** a recognized user-requested retrieval client, or a self-reported agent declaration. This does not establish who the end user is.
- **Other automation:** a script/browser automation signal without evidence of AI control.
- **Unclassified:** insufficient or conflicting evidence. A missing agent header does not prove a human visitor.
- **Search query:** an allowlisted query parameter actually supplied in the referring URL. A declaration about discovery is displayed separately. A landing query is not assigned to later pages as if it caused a new arrival.
- **Goal:** questionnaire answer, when supplied. A crawler's published function is labeled as such; it is not a private task inferred from its behavior.
- **Activity:** recorded paths and descriptive tags such as documentation, pricing, robots rules and sitemap requests. Tags do not establish motive.

Search crawlers often discover pages through links, sitemaps or earlier crawls, before a user searches. Requests cannot reveal an undisclosed search query, private prompt, citation, recommendation or ranking. Search Console query/page performance would be a separate aggregate integration; it is not currently connected.

## Scope and operation

`GET /api/admin/visibility` and `/api/admin/visibility/export` use the authenticated workspace. Filters: range, kind, provider, client, source, query, page, search and includeDemo. Activity pages contain 15 visits; offset selects the next page. CSV exports all matching records within the report ceiling.

Reports scan the latest 5,000 visits in the selected date range and flag the ceiling when reached. Each visit includes up to 100 distinct recorded page paths, plus its entry and latest path. Ranked tables show up to 50 clients/sources or 100 queries/pages, and client rows are grouped by provider, client and visitor type. Page events count request/page-view events, not unique people or conversions. Demo visits are excluded by default. Existing history is enriched on read without rewriting declarations.

The standard client installation is unchanged. No additional Whiteye-specific code is needed. Collection does not depend on the visibility report or its identity-feed refresh; content remains available under the existing observation policy.
