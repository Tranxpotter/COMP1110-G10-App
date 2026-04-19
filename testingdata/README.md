# Mock Transaction Data — Personal Finance App

Engineered mock transaction CSVs for five personas, each spanning Oct 2024 –
Mar 2026 (18 months). Specific months are tuned so specific alerts fire.

## Files

- `config.py` — persona profiles, alert thresholds, subscription/bill tags.
- `generate_data.py` — CLI generator; `--all` or `--persona NAME`.
- `validate.py` — runs every alert rule month-by-month, prints a truth-table.
- `data/{persona}.csv` — 18 months of transactions per persona.

## Schema

Every row: `AMOUNT, CNAME, DATE, TYPE, CURRENCY, DESCRIPTION, RNAME`.
`TYPE` ∈ `{'spending', 'income'}`. Savings/Investment transfers are recorded
as spending with `CNAME='Savings'` or `'Investment'`. All amounts in HKD.

## Run

```bash
python generate_data.py --all      # writes data/*.csv
python validate.py                 # prints truth-table of alerts per month
python validate.py --detail        # adds per-alert detail lines
```

## Expected Alert Calendar

Legend: `X` = alert fires. `Recurring` fires every month for every persona
because monthly rent/bills/subscriptions naturally produce same-`RNAME`
repeats — this is baseline behavior, not a warning.

### 1. Kelvin — Lifestyle Overspender
Salary HK$35,000 on day 25 from `ABC Marketing Ltd`.

| Month    | Alerts                                    | Notes |
|----------|-------------------------------------------|-------|
| 2024-12  | SpendLimit, ProjSpend                     | Christmas blowout; front-loaded Dining/Ent/Shopping projects to ~HK$62K |
| 2025-02  | (clean)                                   | CNY restraint — Dining+Ent+Shopping kept low |
| 2025-06  | SpendLimit, ProjSpend                     | Dining+Entertainment splurge past 50% of trailing income |
| 2025-10  | SpendLimit, BigPayment                    | HK$8,500 Lane Crawford purchase (>20% of income) |
| other    | (clean)                                   | |

### 2. Auntie Mei — Paycheck-to-Paycheck
Salary HK$28,000 on day 15 from `Hospital Authority`.

| Month    | Alerts                                    | Notes |
|----------|-------------------------------------------|-------|
| 2025-07  | BillAnomaly                               | CLP summer AC bill HK$980 vs ~HK$647 6-mo avg (+51%) |
| 2025-08  | ProjSpend, Runway                         | Emergency dental + extra grocery run — residual goes negative |
| 2026-03  | Surplus                                   | HK$1,500 utility refund pushes residual past HK$1,200 threshold |
| other    | (clean)                                   | |

### 3. Ashley — Impulse Micro-spender
Salary HK$20,000 on last weekday from `Design Studio HK`.

| Month    | Alerts                                    | Notes |
|----------|-------------------------------------------|-------|
| 2024-11  | Recurring (Starbucks 22 in 90d)           | Fuzzy recurring — HK$38–48 per visit; rule fires from month 1 and persists |
| 2024-12  | LateNight                                 | 7 HKTVmall/Taobao orders tagged `late-night order` in one week |
| 2025-03  | (clean — travel saving)                   | Starbucks skipped, shopping trimmed |
| 2025-09  | MicroDensity                              | 120 sub-HK$100 micro-transactions — under-100 density crosses 75% |
| other    | Recurring only                            | Starbucks always appears ≥15× in rolling 90 days |

Note: Ashley's fixed subscriptions (Netflix, Spotify, Disney+, YouTube,
Apple) have stddev/mean well under 0.1 to pass strict recurring detection.
Starbucks varies 38-48 to test fuzzy recipient-only recurring.

### 4. Brandon — Subscription Hoarder
Salary HK$45,000 on day 1 from `TechCorp HK`.

| Month    | Alerts                                    | Notes |
|----------|-------------------------------------------|-------|
| all      | Recurring (17+ low-variance subscriptions) | 17 core subs; creep adds 2 in May-25, then gradual additions |
| 2025-05  | SubCreep                                  | +Perplexity HK$156, +Midjourney HK$240 |
| 2026-02  | SubCreep, ProjSub                         | Bulk additions push monthly subs past HK$3,334; projected annual HK$41.8K |
| 2026-03  | ProjSub                                   | Creep settles; projection remains above threshold |
| other    | Recurring only                            | |

### 5. Priya — Responsible Spender
Salary HK$40,000 on day 28 from `Pacific Asset Management`. Persistent
positive notifications.

| Month    | Alerts                                    | Notes |
|----------|-------------------------------------------|-------|
| every    | SavingsGoal                               | Rate (explicit S+I + residual) / income ≈ 43%, always ≥ 20% |
| 2025-03  | + Surplus                                 | 2× salary bonus → month-end surplus HK$90.7K |
| 2026-01  | + FutureSavings                           | Cumulative S+I crosses HK$100K target (HK$104K) |

## Acceptance Criteria — checked

- [x] `python generate_data.py --all` writes 5 CSVs (~18 months each),
      sorted ascending by DATE.
- [x] `python validate.py` truth-table matches the calendar above.
- [x] Clean months exist for every persona except Priya.
- [x] Fuzzy Starbucks amounts (38–48) for Ashley; strict subscription
      amounts (CV < 1%) for Brandon + Ashley fixed subs.
- [x] Recurring detector fires on recipient (`RNAME`), category-agnostic.
- [x] Late-night detection via `DESCRIPTION` keyword cluster in a 7-day
      window (Ashley Dec 2024).

## Tuning Notes

Thresholds and budgets are deliberately loose where the spec's stated
numbers would conflict with clean months:

- **Kelvin spending_limit threshold_pct**: 0.55 (spec suggested 0.45).
  At 0.45 baseline Dining+Ent+Shopping (≈HK$17.5K) already exceeds the
  limit, firing every month. 0.55 keeps clean months clean while Dec/Jun/Oct
  engineering still crosses.
- **Kelvin extra_surplus threshold_hkd**: 4000. Kelvin's typical residual
  is negative (~−3000), so this only catches the Feb-25 restrained-month
  surplus or similar outliers.
- **Ashley spending_limit threshold_pct**: 0.80, projected_spend: 1.20.
  Ashley's spec engineering does not target these alerts; thresholds are
  set above random-variance noise.
- **Priya extra_surplus**: threshold_hkd=20000, threshold_pct=0.35.
  Normal residual is ~HK$10.7K, well below. Only the Mar-25 bonus
  (residual HK$90.7K) fires.
- **Priya savings schedule**: Savings HK$4,500/mo + Investment HK$2,000/mo
  = HK$6,500/mo, chosen so cumulative crosses HK$100K exactly in Jan 2026
  (rather than the HK$8K/HK$4K suggested in the brief, which would have
  crossed earlier).
