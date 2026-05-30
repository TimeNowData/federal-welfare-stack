# Federal-Level Welfare Stack BETA

Prototype B for the **Taxpayer-Paid Welfare Stack** project.

A polished, searchable static dashboard mapping federal public-support program families
that transfer taxpayer-funded value through household benefits, subsidies, credits,
loans, insurance, guarantees, direct services, grants, and state/local pass-throughs.

- **Module:** Federal-Level Welfare Stack BETA
- **Scope:** 55 federal program families that transfer taxpayer-funded value (cash, in-kind benefits, subsidies, credits, loans, insurance, guarantees, direct services, grants, or state/local pass-throughs).
- **Stack:** Vanilla HTML + CSS + JS, static JSON/CSV assets. No build step. Serve any way.
- **Source:** `/home/user/workspace/timenowdata-federal-program-index-prototype-b.csv` and `.pplx.md`.

Live demo: https://federal.timenowdata.app

## Files

| Path | Purpose |
|---|---|
| `index.html` | Single-page dashboard markup |
| `styles.css` | Design tokens, responsive layout, dark mode |
| `app.js` | Data loading, search/filter, KPI counts, modal detail |
| `favicon.svg` | Small SVG mark |
| `data/programs.json` | 55-program JSON (built from source CSV) |
| `data/programs.csv` | CSV mirror of source |
| `data/expansion_batches.json` | 10 expansion batches A–J (roadmap) |
| `data/initial_batches.json` | 16 MVP batch distribution metadata |
| `scripts/build_data.py` | Rebuilds JSON assets from source CSV |
| `qa/` | Playwright QA screenshots (excluded from deploy) |

## Rebuild data

```
python3 scripts/build_data.py
```

## Run locally

```
python3 -m http.server 8788
```

Then open http://localhost:8788/

## What this preview includes

- KPI row: 6 counts (total program families, direct household value, state-administered, state database candidates, assistance mechanisms, agencies)
- Full-text search across name, agency, mechanism, recipient, rationale, stack relationship
- 8 filter groups: agency · need · recipient · mechanism · welfare-stack relationship · flags · priority batch · verification
- Cards and table views
- Program detail modal with mechanism, recipients, need categories, flags, welfare-stack relationship, rationale, official source URL, verification status
- **Count discipline** panel explaining program family vs. state implementation vs. broad federal assistance listing, with overclaim warning
- **Future merge path** panel: Federal Program Family → State Implementation → State Supplement/Waiver → Estimated Household Support Value
- **10 expansion batches** panel (A–J) with focus, estimated count, examples
- **16-batch initial distribution** panel
- Disclaimers: research prototype only; not legal/benefits/financial advice; source verification required; tax-expenditure and mechanism classifications are analytical tags
- Mobile + iPad responsive layout
- Light/dark mode toggle

## Disclaimer

Research prototype. Not legal, benefits, or financial advice. Verify all program details against the linked official source. Tax-expenditure and program-mechanism classifications are analytical tags applied by the research team, not legal categorizations. Counts reflect distinct federal authorization families, not state-by-state variants.
