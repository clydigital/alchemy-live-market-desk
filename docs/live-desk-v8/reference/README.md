# Static V8 Shell Reference

`index.html` is the checked-in visual shell exemplar for the approved V8 direction.

It preserves:

- the deep-purple Live Desk identity;
- the compact workspace header;
- the final visible two-row navigation;
- dense equal-width panels;
- compact badges and status states;
- illustrative Overview hierarchy.

The full page behaviour is specified in `../V8_PAGE_SPEC.md`. The original multi-page V8 mockup was created as a disposable static prototype with illustrative data. Production implementation must use the existing Next.js and Supabase data contracts rather than treating the prototype JavaScript or values as runtime code.

The navigation links intentionally mirror the final route set. During implementation, these static `.html` targets become the Next.js routes defined in `../IMPLEMENTATION_GAP_ANALYSIS.md`.
