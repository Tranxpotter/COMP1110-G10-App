# Mock Transaction Datasets

Each CSV begins with a single `Initial Balance` row dated `2024-09-30`,
then 18 months of transactions from Oct 2024 through Mar 2026.
Schema: `AMOUNT, CNAME, DATE, TYPE, CURRENCY, DESCRIPTION, RNAME`.

## Categories

The `CNAME` column uses the vocabulary below. "Income" categories carry
`TYPE='income'`; all others carry `TYPE='spending'` — including
`Savings` and `Investment`, which are treated as outbound transfers.

### Income

| Category | Description | Example |
|---|---|---|
| `Initial Balance` | One-time opening cash position recorded before any real transactions. | HK$15,000 on 2024-09-30, `RNAME='Bank Account'` |
| `Salary` | Regular wage paid by an employer on a fixed day each month. | HK$35,000 from `ABC Marketing Ltd` on day 25 |

### Spending

| Category | Description | Example |
|---|---|---|
| `Rent` | Monthly housing payment to the landlord, recorded on day 1. | HK$14,000 → `Landlord` |
| `Utilities` | Recurring home bills for electricity, gas, water and internet. | HK$620 `CLP Power`, HK$218 `HKBN` |
| `Insurance` | Monthly premium for life, medical or property policies. | HK$1,600 `AIA Insurance` |
| `Groceries` | Supermarket runs for home food and household supplies. | HK$450 `Wellcome`, HK$320 `ParknShop` |
| `Dining` | Restaurants, cafés and food delivery — eating out. | HK$380 `Mott 32`, HK$42 `Starbucks` |
| `Entertainment` | Cinemas, bars, events and streaming services not tagged as `Subscriptions`. | HK$280 `Cinema City`, HK$93 `Netflix` |
| `Shopping` | Retail purchases — clothing, electronics, department stores. | HK$8,500 `Lane Crawford`, HK$380 `Uniqlo` |
| `Transport` | Commuting and within-city travel. | HK$55 `MTR`, HK$120 `Uber` |
| `Subscriptions` | Recurring service subscriptions charged at a fixed cadence (used for subscription-detection rules). | HK$178 `Adobe CC`, HK$93 `Netflix` |
| `Kids` | Children's expenses — tuition, supplies, emergencies. | HK$1,800 `Kumon`, HK$3,500 `HK Dental Clinic` |
| `Savings` | Money moved out of the checking account into a savings account. | HK$4,500 → `Mox Bank` |
| `Investment` | Money moved out of the checking account into an investment account. | HK$2,000 → `IBKR` (DCA) |
| `Other` | Miscellaneous purchases that do not fit any named category; also used for one-off refunds (recorded as income). | HK$45 `7-Eleven`, HK$1,500 refund from `HKBN` |

---

## Per-dataset configuration

Every dataset lists: initial balance, active categories, the alert rules
to wire up (with their thresholds) and the trend/projection graphs to
plot. All thresholds are read from `config.py`.

### `kelvin.csv` — Lifestyle Overspender

- **Initial balance:** HK$15,000
- **Income categories:** `Initial Balance`, `Salary`
- **Spending categories:** `Rent`, `Dining`, `Entertainment`, `Shopping`, `Transport`, `Other`

**Alerts**

| Rule | Config |
|---|---|
| Spending Limit | categories = `[Dining, Entertainment, Shopping]`, threshold = 55% × HK$35,000 = HK$19,250, reset day 1 |
| Big 1-Time Payment | categories = `[Shopping, Entertainment]`, threshold = 20% × HK$35,000 = HK$7,000 |
| Recurring Payment | N = 3 same-`RNAME` in rolling 60 days |
| Projected Monthly Spending Alert | trigger day 15, exclude `Rent`, threshold = 100% × HK$35,000 = HK$35,000 |
| Extra Surplus | month-end residual ≥ HK$4,000 |

**Projection graphs**

- **Monthly Spending Projection** — day-15 cumulative (excl. Rent) extrapolated to month-end, vs. trailing 3-mo avg.
- **Monthly spend by category** — stacked bar over 18 months.
- **Yearly Bills Projection** on `(Rent, Landlord)`.

---

### `auntie_mei.csv` — Paycheck-to-Paycheck

- **Initial balance:** HK$3,000
- **Income categories:** `Initial Balance`, `Salary`, `Other` (one-off utility refund Mar 2026)
- **Spending categories:** `Rent`, `Utilities`, `Insurance`, `Groceries`, `Kids`, `Transport`, `Dining`, `Entertainment`

**Alerts**

| Rule | Config |
|---|---|
| Spending Limit | categories = `[Groceries, Dining, Entertainment, Kids]`, threshold = 55% × HK$28,000 = HK$15,400, reset day 15 (payday) |
| Big 1-Time Payment | categories = `[Kids, Entertainment]`, threshold = 20% × HK$28,000 = HK$5,600 |
| Recurring Payment | N = 3 same-`RNAME` in rolling 60 days |
| Projected Monthly Spending Alert | trigger day 12, exclude `Rent, Utilities, Insurance`, threshold = 100% × HK$28,000 = HK$28,000 |
| Extra Surplus | month-end residual ≥ HK$1,200 |
| Runway / Payday Cushion | month-end residual below HK$400 fires; window = 3 days pre-payday |
| Recurring Bill Anomaly | per `(CNAME, RNAME)` in bill_pairs, current > 1.40 × 6-mo average |

**Projection graphs**

- **Runway / Balance to next payday** — daily balance curve with the HK$400 cushion line.
- **Yearly Bills Projection** on `(Utilities, CLP Power)`, `(Utilities, Towngas)`, `(Utilities, HKBN)`, `(Insurance, AIA Insurance)`, `(Rent, Landlord)`.
- **Monthly Spending Projection** (discretionary only).

---

### `ashley.csv` — Impulse Micro-spender

- **Initial balance:** HK$5,000
- **Income categories:** `Initial Balance`, `Salary`
- **Spending categories:** `Rent`, `Dining`, `Shopping`, `Entertainment`, `Transport`, `Other`

**Alerts**

| Rule | Config |
|---|---|
| Spending Limit | categories = `[Dining, Shopping, Entertainment]`, threshold = 80% × HK$20,000 = HK$16,000, reset day 1 |
| Big 1-Time Payment | categories = `[Shopping]`, threshold = 20% × HK$20,000 = HK$4,000 |
| Recurring Payment | N = 15 same-`RNAME` in rolling 90 days (fuzzy: Starbucks amounts vary HK$38–48) |
| Projected Monthly Spending Alert | trigger day 15, exclude `Rent`, threshold = 120% × HK$20,000 = HK$24,000 |
| Extra Surplus | month-end residual ≥ HK$10,000 |
| Late-Night Shopping | ≥ 5 transactions with `DESCRIPTION` containing `late-night` within a 7-day window |
| Micro-transaction Density | ≥ 75% of the month's transactions are under HK$100 |

**Projection graphs**

- **Subscription Projection** — annual run-rate of `Entertainment` subs (Netflix, Spotify, Disney+, YouTube, Apple).
- **Fuzzy recurring count per `RNAME`** — Starbucks visits per rolling 90-day window.
- **Monthly Spending Projection**.

---

### `brandon.csv` — Subscription Hoarder

- **Initial balance:** HK$50,000
- **Income categories:** `Initial Balance`, `Salary`
- **Spending categories:** `Rent`, `Subscriptions`, `Dining`, `Shopping`, `Groceries`, `Transport`, `Other`

**Alerts**

| Rule | Config |
|---|---|
| Spending Limit | categories = `[Shopping, Dining, Subscriptions]`, threshold = 50% × HK$45,000 = HK$22,500, reset day 1 |
| Big 1-Time Payment | categories = `[Shopping]`, threshold = 20% × HK$45,000 = HK$9,000 |
| Recurring Payment | N = 3 same-`RNAME` in rolling 90 days (17+ subs qualify) |
| Projected Monthly Spending Alert | trigger day 15, exclude `Rent`, threshold = 100% × HK$45,000 = HK$45,000 |
| Extra Surplus | month-end residual ≥ HK$20,000 |
| Subscription Creep | month-over-month increase in `Subscriptions` total ≥ HK$300 |
| Projected Subscription | current-month subs × 12 > HK$40,000 |

**Projection graphs**

- **Subscription Projection (annual)** — line of `current_subs × 12` over time; goal line at HK$40,000.
- **Subscription breakdown by `RNAME`** — stacked area over 18 months.
- **Monthly Spending Projection**.

---

### `priya.csv` — Responsible Spender

- **Initial balance:** HK$80,000
- **Income categories:** `Initial Balance`, `Salary` (plus 2× year-end bonus in Mar 2025)
- **Spending categories:** `Rent`, `Savings`, `Investment`, `Utilities`, `Groceries`, `Dining`, `Transport`, `Entertainment`, `Other`

**Alerts**

| Rule | Config |
|---|---|
| Spending Limit | categories = `[Dining, Entertainment, Other]`, threshold = 40% × HK$40,000 = HK$16,000, reset day 1 |
| Big 1-Time Payment | categories = `[Other]`, threshold = 20% × HK$40,000 = HK$8,000 |
| Recurring Payment | N = 3 same-`RNAME` in rolling 60 days |
| Projected Monthly Spending Alert | trigger day 15, exclude `Rent, Utilities, Savings, Investment`, threshold = 100% × HK$40,000 = HK$40,000 |
| Extra Surplus | month-end residual ≥ HK$20,000 OR ≥ 35% of monthly income |
| Monthly Savings Goal | `(Savings + Investment + residual) / income ≥ 20%` — positive notification |
| Future Savings Goal | cumulative `Savings + Investment` crosses HK$100,000 target by 2026-01-31 |

**Projection graphs**

- **Savings/Debt Projection** — cumulative `Savings + Investment` balance vs. the HK$100K target line.
- **Future Savings Goal trajectory** — 6-mo avg projection forward to 2026-01-31.
- **Yearly Bills Projection** on `(Rent, Landlord)`, `(Utilities, CLP Power)`, `(Utilities, Towngas)`.
- **Monthly Spending Projection** (discretionary only).

---

## Running

```bash
python generate_data.py --all      # writes data/*.csv
python validate.py                 # truth-table of alerts per persona per month
python validate.py --detail        # adds per-alert detail lines
```
