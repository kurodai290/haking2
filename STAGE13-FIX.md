BLACKBOX v4.1 - Stage 13 Network Fix

- Stage 13 now makes a real same-origin GET request to /api/session_KS.
- The endpoint returns fictional lab-only JSON and is safe to inspect in DevTools.
- To test: open stage13.html, press F12, select Network > Fetch/XHR, reload the page, and select session_KS.
- Existing stage 01-15 answer list entries were compared with v3.5; they are unchanged.
- Note: Railway live end-to-end testing has not been performed.
