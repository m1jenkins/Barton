# SEO-03 performance evidence

Measured September 19, 2026 UTC (September 18 in America/Los_Angeles). **Complete local diagnostic evidence; no production or field pass asserted.**

This packet owns measurement evidence only. The coordinator integrated the measured GTM-loading-order fix in the pricing, process, About, Resources and three root-guide templates, and owns the release decision. The pricing HTML used by the successful temporary probe is byte-identical to the final pricing HTML (`52a41dda4663f8caa55548035e6a79f1bdcde8a609ed359180530c7473ea4ccf`). Full source hashes, individual measurements, observation windows, exclusion counts and raw-trace checksums are in [performance-evidence.json](performance-evidence.json).

## Result and supported fix

Pricing reproduced a large initial layout shift under Slow 4G / CPU 4. The trace records Google tag functions forcing layout before the blocking stylesheets finish: `eG`/`oK`/`rK`/`OK` from `www.googletagmanager.com/gtag/js` at roughly 0.70–0.74 seconds, followed by Clarity layout work as styles finish around 1.93 seconds. The initial geometry is unstyled; it changes when CSS applies.

A controlled temporary copy moved the **unchanged GTM bootstrap after the blocking stylesheet links**. The one-run control had LCP 1.996s and CLS 1.05844; the reordered copy had LCP 2.012s and CLS 0.03056. The exact-setting buffered PerformanceObserver agreed with both CLS values. The 16ms LCP difference is within the variation in the five initial pricing runs; it is not evidence of an LCP regression or improvement. An early body-margin reset did not solve it (LCP 1.979s, CLS 1.05370), so it was not recommended. No project files were changed for these probes.

Do not suppress the initial shift merely because its timestamp precedes `firstPaint`. A faster independent browser check omitted it, but the exact Slow 4G / CPU 4 observer reproduced it. Primary CLS retains it. `post_first_paint_cls_diagnostic` in the JSON is only a debugging decomposition, never a substitute CLS score.

## Final candidate mobile: five runs per template

390×844 CSS pixels, DPR 3, mobile/touch emulation, Slow 4G, CPU slowdown 4. All five samples for each template use the final source manifest.

| Template | n | LCP median seconds (range) | CLS median (range) |
|---|---:|---:|---:|
| Homepage | 5 | 2.005 (2.001–2.006) | 0.01025 |
| Pricing | 5 | 2.011 (2.007–2.012) | 0.03056 |
| MSRP guide | 5 | 1.828 (1.808–1.833) | 0.00000 |

All final mobile samples met the runbook's local LCP/CLS diagnostic targets. Pricing's median LCP was 35ms later than the initial candidate batch while CLS fell from 1.05844 to 0.03056. This supports the loading-order correction; it does not establish a field result or a statistically significant timing change.

## Baseline mobile: five runs per template

Archived revision `3bf03f6288a16b578e49cb1375254c7285a70855`, identical preview server/settings, separate localhost port.

| Template | n | LCP median seconds (range) | CLS median (range) |
|---|---:|---:|---:|
| Homepage | 5 | 2.014 (1.967–2.068) | 0.01025 |
| Pricing | 5 | 1.966 (1.946–2.028) | 1.02420 |
| MSRP guide | 5 | 1.873 (1.816–1.883) | 0.00872 (0.00000–0.35989) |

## Initial candidate mobile, before the measured loading-order fix

These are diagnostic development-state samples, not the final release measurement. The initial guide contained the proposed editorial revision; that body was subsequently returned to a private draft, and final root-guide measurements use the coordinator's retained baseline editorial body plus authorized offer updates. Acquisition/retry JavaScript also changed after some initial runs; individual source manifests preserve that distinction.

| Template | n | LCP median seconds (range) | CLS median (range) |
|---|---:|---:|---:|
| Homepage | 5 | 1.998 (1.985–2.012) | 0.01025 |
| Pricing | 5 | 1.975 (1.958–2.003) | 1.05844 |
| MSRP guide | 5 | 1.879 (1.829–1.922) | 0.35989 (0.00872–0.36980) |

## Desktop samples

1440×900 CSS pixels, DPR 1, Fast 4G, CPU slowdown 1. One sample per page per cohort is a spot check, not a distribution.

Baseline:

| Template | n | LCP median seconds (range) | CLS median (range) |
|---|---:|---:|---:|
| Homepage | 1 | 0.553 | 0.00165 |
| Pricing | 1 | 0.508 | 0.76730 |
| MSRP guide | 1 | 0.484 | 0.68060 |

Final candidate:

| Template | n | LCP median seconds (range) | CLS median (range) |
|---|---:|---:|---:|
| Homepage | 1 | 0.551 | 0.00058 |
| Pricing | 1 | 0.534 | 0.00189 |
| MSRP guide | 1 | 0.479 | 0.00000 |

## Method and reproducibility

- Reported browser user agent `HeadlessChrome/153.0.0.0`, `chrome-devtools-axi` 0.1.34, underlying Chrome DevTools MCP 1.9.0, isolated session `seo-perf`; the coordinator used a different browser session. Preview servers run Node 24.
- Candidate origin: `http://127.0.0.1:4175`. Baseline: `http://127.0.0.1:4176`, created with `git archive` of the starting revision into a temporary directory. The same `scripts/preview.mjs` serves both. Probe copies used port 4177. No deployment, purchase or form submission was performed.
- Each run opens its URL, clears local/session storage, records with `perf-start --file …json.gz`, then calls `perf-stop`. The underlying trace tool navigates through `about:blank`, navigates back, and automatically stops five seconds after load; actual navigation observation windows are recorded per run. [Chrome DevTools MCP trace implementation](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/src/tools/performance.ts).
- The local server sends `Cache-Control: no-store`; local HTML/CSS/JS/fonts are uncached. The browser is reused and third-party HTTP cache is not explicitly cleared. These are **not cold-browser or production-network tests**. The browser/CPU host is shared with other local work, so small timing differences are noise-sensitive.
- LCP selects the last `largestContentfulPaint::Candidate` matching the target main frame **and navigation ID**, and subtracts that navigation's start. Empty-URL auxiliary navigation events are ignored. LCP is a navigation diagnostic; no interaction-based INP can be inferred. [LCP definition](https://web.dev/articles/lcp).
- CLS includes matching-main-frame layout shifts after navigation start whose `had_recent_input` is false. It uses the largest session-window sum, not the sum of all shifts: gaps below 1 second, total window below 5 seconds. Parser boundary assertions cover both limits. No other-frame layout shifts were observed in the collected traces; the JSON records this check for every run. [CLS definition and limitations](https://web.dev/articles/cls).
- Raw pre-paint shifts and primary CLS remain in the evidence. Filmstrip inspection and read-only buffered PerformanceObservers were used to investigate the unusually large initial entries. No synthetic input was dispatched during the traces; every run records the input-dispatch count.
- SHA-256 manifests before and after every run detect source changes during measurement. They include the page, root CSS/JS, buying CSS/JS, and buying assets. Raw traces remain in `/private/tmp/barton-seo-perf-traces/`; only sanitized metrics/hashes are retained in the repository artifacts. No request query strings, browser-account data or contact information are included in the JSON.

## Evidence validation

All 51 formal traces were reparsed and checked against the saved metrics: 15 baseline mobile, 15 initial candidate mobile, 15 final candidate mobile, and six desktop samples. Three controlled pricing probes are recorded separately. All formal runs had stable source manifests, matching navigation IDs, zero unexpected input dispatches, and zero other-frame layout shifts. Observation windows ranged from 5.567 to 10.174 seconds. The final five mobile and one desktop sample for each template match the current source files exactly.

No local resource failed. The pricing and guide runs each recorded four failures to Google Ads collection endpoints; the sanitized paths and aggregate counts are retained in the JSON. They are browser-environment observations and do not establish production tracking failure or successful account delivery.

Final page SHA-256 values:

| Page | SHA-256 |
|---|---|
| `index.html` | `471f42b8c4aa6ff3f1325a07e78d6993c379b6215eaecae1a6d6415619ef2bde` |
| `schedule.html` | `52a41dda4663f8caa55548035e6a79f1bdcde8a609ed359180530c7473ea4ccf` |
| `blog-buy-new-car-below-msrp.html` | `24d754838e7e464d4177bb79250aa7765193214cd76ffd388c1c0747191d5e00` |

Example capture commands (use separate files for every run):

```sh
CHROME_DEVTOOLS_AXI_SESSION=seo-perf chrome-devtools-axi emulate --viewport '390x844x3,mobile,touch' --network 'Slow 4G' --cpu 4
CHROME_DEVTOOLS_AXI_SESSION=seo-perf chrome-devtools-axi open http://127.0.0.1:4175/schedule.html
CHROME_DEVTOOLS_AXI_SESSION=seo-perf chrome-devtools-axi perf-start --file /private/tmp/pricing-mobile.json.gz
CHROME_DEVTOOLS_AXI_SESSION=seo-perf chrome-devtools-axi perf-stop --file /private/tmp/pricing-mobile.json.gz
```

## Field evidence and limits

Authenticated Search Console for `https://www.driverightcarbuying.com/` showed **not enough usage data in the last 90 days** for both Mobile and Desktop in the Core Web Vitals report (last updated September 15, 2026). Both report buttons were disabled. Field LCP, INP and CLS are **unavailable**, not zero and not pass/fail. See [SEO-02 account evidence](SEO-02.md) and the [property report](https://search.google.com/search-console/core-web-vitals?resource_id=https%3A%2F%2Fwww.driverightcarbuying.com%2F).

The available CLI Lighthouse path supplied accessibility/best-practices/SEO categories to the coordinator, not a performance score. This packet claims no Lighthouse performance score, no field percentile, and no INP result. A short navigation trace does not cover lifetime CLS, form/checkout interactions, production CDN/TLS, actual visitor devices, or consent states. Recheck deployed loading order and available field data after authorized activation.
