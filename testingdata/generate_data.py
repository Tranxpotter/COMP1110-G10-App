"""Generate engineered mock transaction CSVs for each persona.

Usage:
    python generate_data.py --all
    python generate_data.py --persona kelvin
"""

from __future__ import annotations

import argparse
import os
from calendar import monthrange
from datetime import date, timedelta
from typing import Iterable

import numpy as np
import pandas as pd
from dateutil.relativedelta import relativedelta

from config import (
    ASHLEY_FIXED_SUBS,
    BRANDON_SUBSCRIPTIONS,
    DATA_DIR,
    END_DATE,
    INITIAL_BALANCE_DATE,
    INITIAL_BALANCES,
    PERSONAS,
    START_DATE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

COLUMNS = ["AMOUNT", "CNAME", "DATE", "TYPE", "CURRENCY", "DESCRIPTION", "RNAME"]


def month_iter(start: date, end: date) -> Iterable[tuple[int, int]]:
    cur = date(start.year, start.month, 1)
    while cur <= end:
        yield cur.year, cur.month
        cur = cur + relativedelta(months=1)


def last_day(y: int, m: int) -> int:
    return monthrange(y, m)[1]


def last_weekday_day(y: int, m: int) -> int:
    d = last_day(y, m)
    dt = date(y, m, d)
    while dt.weekday() >= 5:
        dt -= timedelta(days=1)
    return dt.day


def income_day(cfg, y: int, m: int) -> int:
    d = cfg["income_day"]
    if d == "last_weekday":
        return last_weekday_day(y, m)
    return min(int(d), last_day(y, m))


def round2(x: float) -> float:
    return round(float(x), 2)


def spread_amounts(rng: np.random.Generator, total: float, n: int,
                   min_amt: float = 10.0, jitter: float = 0.35) -> list[float]:
    """Split `total` into `n` positive amounts clustered around total/n."""
    if n <= 0 or total <= 0:
        return []
    raw = rng.uniform(1.0 - jitter, 1.0 + jitter, size=n)
    raw *= total / raw.sum()
    return [max(min_amt, round2(v)) for v in raw]


def row(amount, cname, dt: date, type_, description, rname) -> dict:
    return {
        "AMOUNT": round2(amount),
        "CNAME": cname,
        "DATE": dt.isoformat(),
        "TYPE": type_,
        "CURRENCY": "HKD",
        "DESCRIPTION": description,
        "RNAME": rname,
    }


def salary_row(cfg, y, m) -> dict:
    return row(
        cfg["monthly_income"], "Salary",
        date(y, m, income_day(cfg, y, m)),
        "income", "Monthly salary", cfg["income_rname"],
    )


def emit_category(rows, rng, y, m, cname, total, n, merchants,
                  *, day_pool=None, type_="spending", desc_prefix=""):
    if total <= 0 or n <= 0:
        return
    amounts = spread_amounts(rng, total, n)
    dmax = last_day(y, m)
    pool = day_pool if day_pool is not None else list(range(1, dmax + 1))
    for amt in amounts:
        d = int(rng.choice(pool))
        merchant = str(rng.choice(merchants))
        rows.append(row(
            amt, cname, date(y, m, d), type_,
            f"{desc_prefix}{merchant}".strip(), merchant,
        ))


def sort_rows(rows):
    return sorted(rows, key=lambda r: (r["DATE"], r["CNAME"], r["RNAME"]))


# ---------------------------------------------------------------------------
# Kelvin — Lifestyle Overspender
# ---------------------------------------------------------------------------

KELVIN_BUDGETS = {
    "Rent": 14000,
    "Dining": 7500,
    "Entertainment": 5500,
    "Shopping": 4500,
    "Transport": 3500,
    "Other": 3000,
}


def gen_kelvin_month(cfg, y, m, rng):
    rows = [salary_row(cfg, y, m)]
    b = dict(KELVIN_BUDGETS)

    # Engineered overrides
    front_load_dining = False
    if (y, m) == (2024, 12):
        b["Dining"], b["Entertainment"], b["Shopping"] = 12000, 9500, 9500
        front_load_dining = True
    elif (y, m) == (2025, 2):
        b["Dining"], b["Entertainment"], b["Shopping"] = 5500, 3500, 2500
    elif (y, m) == (2025, 6):
        b["Dining"], b["Entertainment"], b["Shopping"] = 14000, 11000, 4500

    # Rent — single payment day 1
    rows.append(row(b["Rent"], "Rent", date(y, m, 1),
                    "spending", "Monthly rent", "Landlord"))

    # Dining
    n = int(rng.integers(22, 30))
    day_pool = list(range(1, 15)) if front_load_dining else None
    emit_category(rows, rng, y, m, "Dining", b["Dining"], n,
                  cfg["merchants"]["Dining"], day_pool=day_pool,
                  desc_prefix="Dinner at ")

    # Entertainment
    n = int(rng.integers(10, 16))
    emit_category(rows, rng, y, m, "Entertainment", b["Entertainment"], n,
                  cfg["merchants"]["Entertainment"],
                  desc_prefix="Night out - ")

    # Shopping
    n = int(rng.integers(4, 9))
    emit_category(rows, rng, y, m, "Shopping", b["Shopping"], n,
                  cfg["merchants"]["Shopping"],
                  desc_prefix="Purchase at ")

    # One-time big Lane Crawford purchase — Oct 2025
    if (y, m) == (2025, 10):
        rows.append(row(8500, "Shopping", date(y, m, 18),
                        "spending", "Lane Crawford leather jacket",
                        "Lane Crawford"))

    # Transport
    n = int(rng.integers(20, 30))
    emit_category(rows, rng, y, m, "Transport", b["Transport"], n,
                  cfg["merchants"]["Transport"])

    # Other
    n = int(rng.integers(6, 12))
    emit_category(rows, rng, y, m, "Other", b["Other"], n,
                  cfg["merchants"]["Other"])

    return rows


# ---------------------------------------------------------------------------
# Auntie Mei — Paycheck-to-Paycheck
# ---------------------------------------------------------------------------

MEI_BUDGETS = {
    "Rent": 10000,
    "Groceries": 5600,
    "Kids": 4800,
    "Transport": 2200,
    "Dining": 1400,
    "Entertainment": 400,
}


def gen_mei_month(cfg, y, m, rng):
    rows = [salary_row(cfg, y, m)]
    b = dict(MEI_BUDGETS)

    # Rent — first of month
    rows.append(row(b["Rent"], "Rent", date(y, m, 1),
                    "spending", "Monthly rent", "Landlord"))

    # CLP bill — day 8 every month; Jul 2025 is the AC spike
    clp_mean, clp_std = 620, 40
    if (y, m) == (2025, 7):
        clp_amt = 980
    elif m in (6, 8):
        clp_amt = float(rng.normal(780, 30))  # summer-ish, raises 6-mo average
    else:
        clp_amt = float(rng.normal(clp_mean, clp_std))
    rows.append(row(max(200.0, clp_amt), "Utilities", date(y, m, 8),
                    "spending", "Electricity bill", "CLP Power"))

    # Towngas — day 10
    rows.append(row(float(rng.normal(180, 10)), "Utilities", date(y, m, 10),
                    "spending", "Gas bill", "Towngas"))
    # Internet — day 12
    rows.append(row(float(rng.normal(218, 2)), "Utilities", date(y, m, 12),
                    "spending", "Broadband", "HKBN"))

    # Insurance — day 20
    rows.append(row(float(rng.normal(1600, 15)), "Insurance", date(y, m, 20),
                    "spending", "Life insurance", "AIA Insurance"))

    # Groceries — 12-16 runs, mostly Wellcome/ParknShop
    n = int(rng.integers(12, 17))
    emit_category(rows, rng, y, m, "Groceries", b["Groceries"], n,
                  cfg["merchants"]["Groceries"],
                  desc_prefix="Groceries at ")

    # Kids — tuition day 5, plus smaller kids purchases
    rows.append(row(float(rng.normal(1800, 20)), "Kids", date(y, m, 5),
                    "spending", "Tuition fee", "Kumon"))
    rows.append(row(float(rng.normal(1200, 20)), "Kids", date(y, m, 5),
                    "spending", "Tuition fee", "Modern Education"))
    emit_category(rows, rng, y, m, "Kids", max(0, b["Kids"] - 3000),
                  int(rng.integers(4, 8)), cfg["merchants"]["Kids"],
                  desc_prefix="Kids - ")

    # Transport
    n = int(rng.integers(15, 22))
    emit_category(rows, rng, y, m, "Transport", b["Transport"], n,
                  cfg["merchants"]["Transport"])

    # Dining
    n = int(rng.integers(3, 7))
    emit_category(rows, rng, y, m, "Dining", b["Dining"], n,
                  cfg["merchants"]["Dining"], desc_prefix="Lunch - ")

    # Entertainment
    if b["Entertainment"] > 0:
        n = int(rng.integers(1, 3))
        emit_category(rows, rng, y, m, "Entertainment", b["Entertainment"], n,
                      cfg["merchants"]["Entertainment"])

    # Aug 2025 — runway: unplanned kids expense pushes balance to near zero 3 days before payday
    if (y, m) == (2025, 8):
        # Emergency kids dental ~HK$3500 on day 10 (5 days before 15th payday)
        rows.append(row(3500, "Kids", date(y, m, 10),
                        "spending", "Emergency dental", "HK Dental Clinic"))
        # Another grocery run right before payday
        rows.append(row(1500, "Groceries", date(y, m, 12),
                        "spending", "Big groceries run", "ParknShop"))

    # Mar 2026 — leave a small surplus at month-end via a refund
    if (y, m) == (2026, 3):
        rows.append(row(1500, "Other", date(y, m, 28),
                        "income", "Utility refund", "HKBN"))

    return rows


# ---------------------------------------------------------------------------
# Ashley — Impulse Micro-spender
# ---------------------------------------------------------------------------

ASHLEY_BUDGETS = {
    "Rent": 3000,
    "Dining": 6500,
    "Shopping": 5200,
    "Entertainment": 2000,
    "Transport": 2200,
    "Other": 900,
}


def gen_ashley_month(cfg, y, m, rng):
    rows = [salary_row(cfg, y, m)]

    # Rent
    rows.append(row(ASHLEY_BUDGETS["Rent"], "Rent", date(y, m, 1),
                    "spending", "Monthly rent", "Landlord"))

    # Fixed subscriptions — near-constant amounts
    for rname, amt, day in ASHLEY_FIXED_SUBS:
        d = min(day, last_day(y, m))
        jitter = float(rng.normal(0, 0.01))
        rows.append(row(max(1.0, amt * (1 + jitter)), "Entertainment",
                        date(y, m, d), "spending",
                        f"{rname} subscription", rname))

    # Starbucks — fuzzy recurring, 18-25x/month at HK$38-48
    n_starbucks = int(rng.integers(18, 26))
    if (y, m) == (2024, 11):
        n_starbucks = 22
    elif (y, m) == (2025, 3):
        n_starbucks = 0  # Mar 2025 clean month — Starbucks skipped
    for _ in range(n_starbucks):
        amt = float(rng.uniform(38, 48))
        d = int(rng.integers(1, last_day(y, m) + 1))
        rows.append(row(amt, "Dining", date(y, m, d), "spending",
                        "Morning coffee", "Starbucks"))

    # Dining (non-Starbucks): Foodpanda, Keeta, Pacific Coffee, ~10-18 small orders
    n = int(rng.integers(10, 18))
    remaining_dining = max(0, ASHLEY_BUDGETS["Dining"] - n_starbucks * 42)
    dining_non_sbux = [m_ for m_ in cfg["merchants"]["Dining"] if m_ != "Starbucks"]
    emit_category(rows, rng, y, m, "Dining", remaining_dining, n,
                  dining_non_sbux, desc_prefix="Food - ")

    # Shopping — full budget; Dec 2024 carves off a late-night batch
    shop_budget = ASHLEY_BUDGETS["Shopping"]
    if (y, m) == (2024, 12):
        emit_category(rows, rng, y, m, "Shopping", 1800, 7,
                      ["HKTVmall", "Taobao"],
                      day_pool=[8, 9, 10, 11, 12, 13, 14],
                      desc_prefix="late-night order - ")
        shop_budget -= 1800
    n = int(rng.integers(4, 8))
    emit_category(rows, rng, y, m, "Shopping", shop_budget, n,
                  cfg["merchants"]["Shopping"],
                  desc_prefix="Purchase - ")

    # Entertainment non-sub (cinema, events)
    n = int(rng.integers(2, 5))
    ent_non_sub = [m_ for m_ in cfg["merchants"]["Entertainment"]
                   if m_ not in {r for r, _, _ in ASHLEY_FIXED_SUBS}]
    fixed_sub_total = sum(a for _, a, _ in ASHLEY_FIXED_SUBS)
    if ent_non_sub:
        emit_category(rows, rng, y, m, "Entertainment",
                      max(0, ASHLEY_BUDGETS["Entertainment"] - fixed_sub_total),
                      n, ent_non_sub, desc_prefix="Fun - ")

    # Transport
    n = int(rng.integers(18, 28))
    emit_category(rows, rng, y, m, "Transport", ASHLEY_BUDGETS["Transport"], n,
                  cfg["merchants"]["Transport"])

    # Other — 4-7 small purchases
    n = int(rng.integers(4, 8))
    emit_category(rows, rng, y, m, "Other", ASHLEY_BUDGETS["Other"], n,
                  cfg["merchants"]["Other"], desc_prefix="Convenience - ")

    # Mar 2025 — clean, saving for travel: trim Shopping and misc
    if (y, m) == (2025, 3):
        rows = [r for r in rows if not (
            r["CNAME"] == "Shopping" and r["AMOUNT"] > 100
        )]

    # Sep 2025 — micro-density: inject many sub-HK$100 transactions
    if (y, m) == (2025, 9):
        for _ in range(120):
            amt = float(rng.uniform(20, 95))
            d = int(rng.integers(1, last_day(y, m) + 1))
            rows.append(row(amt, "Other", date(y, m, d), "spending",
                            "Micro purchase", "7-Eleven"))

    return rows


# ---------------------------------------------------------------------------
# Brandon — Subscription Hoarder
# ---------------------------------------------------------------------------

BRANDON_BUDGETS = {
    "Rent": 11000,
    "Dining": 4800,
    "Shopping": 3800,
    "Groceries": 3200,
    "Transport": 2500,
    "Other": 3200,
}


def sub_active(sub, y, m):
    rname, amt, day, added, removed = sub
    ym = (y, m)
    if added is not None and ym < added:
        return False
    if removed is not None and ym >= removed:
        return False
    return True


def gen_brandon_month(cfg, y, m, rng):
    rows = [salary_row(cfg, y, m)]

    # Rent
    rows.append(row(BRANDON_BUDGETS["Rent"], "Rent", date(y, m, 1),
                    "spending", "Monthly rent", "Landlord"))

    # Subscriptions — near-fixed amount, same day of month
    for sub in BRANDON_SUBSCRIPTIONS:
        if not sub_active(sub, y, m):
            continue
        rname, amt, day, _, _ = sub
        jitter = float(rng.normal(0, 0.01))  # stddev/mean < 0.1
        d = min(day, last_day(y, m))
        rows.append(row(max(1.0, amt * (1 + jitter)), "Subscriptions",
                        date(y, m, d), "spending",
                        f"{rname} subscription", rname))

    # Other categories
    emit_category(rows, rng, y, m, "Dining", BRANDON_BUDGETS["Dining"],
                  int(rng.integers(10, 16)),
                  cfg["merchants"]["Dining"], desc_prefix="Dinner - ")
    emit_category(rows, rng, y, m, "Shopping", BRANDON_BUDGETS["Shopping"],
                  int(rng.integers(3, 7)),
                  cfg["merchants"]["Shopping"])
    emit_category(rows, rng, y, m, "Groceries", BRANDON_BUDGETS["Groceries"],
                  int(rng.integers(6, 10)),
                  cfg["merchants"]["Groceries"])
    emit_category(rows, rng, y, m, "Transport", BRANDON_BUDGETS["Transport"],
                  int(rng.integers(15, 22)),
                  cfg["merchants"]["Transport"])
    emit_category(rows, rng, y, m, "Other", BRANDON_BUDGETS["Other"],
                  int(rng.integers(5, 10)),
                  cfg["merchants"]["Other"])

    return rows


# ---------------------------------------------------------------------------
# Priya — Responsible Spender
# ---------------------------------------------------------------------------

PRIYA_BUDGETS = {
    "Rent": 10000,
    "Savings": 4500,
    "Investment": 2000,
    "Groceries": 4500,
    "Dining": 3500,
    "Transport": 2000,
    "Utilities": 1500,
    "Entertainment": 800,
    "Other": 1200,
}


def gen_priya_month(cfg, y, m, rng):
    rows = [salary_row(cfg, y, m)]

    # Rent
    rows.append(row(PRIYA_BUDGETS["Rent"], "Rent", date(y, m, 1),
                    "spending", "Monthly rent", "Landlord"))

    # Monthly Savings transfer (day 28, after salary)
    savings_amt = PRIYA_BUDGETS["Savings"]
    rows.append(row(savings_amt, "Savings", date(y, m, min(28, last_day(y, m))),
                    "spending", "Auto-transfer to savings", "Mox Bank"))

    # Monthly Investment
    rows.append(row(PRIYA_BUDGETS["Investment"], "Investment",
                    date(y, m, min(28, last_day(y, m))),
                    "spending", "Monthly DCA", "IBKR"))

    # Utilities (CLP, Towngas)
    rows.append(row(float(rng.normal(650, 50)), "Utilities", date(y, m, 8),
                    "spending", "Electricity bill", "CLP Power"))
    rows.append(row(float(rng.normal(180, 10)), "Utilities", date(y, m, 10),
                    "spending", "Gas bill", "Towngas"))

    # Groceries
    emit_category(rows, rng, y, m, "Groceries", PRIYA_BUDGETS["Groceries"],
                  int(rng.integers(6, 11)),
                  cfg["merchants"]["Groceries"])

    # Dining
    emit_category(rows, rng, y, m, "Dining", PRIYA_BUDGETS["Dining"],
                  int(rng.integers(5, 10)),
                  cfg["merchants"]["Dining"], desc_prefix="Meal - ")

    # Transport
    emit_category(rows, rng, y, m, "Transport", PRIYA_BUDGETS["Transport"],
                  int(rng.integers(12, 18)),
                  cfg["merchants"]["Transport"])

    # Entertainment
    emit_category(rows, rng, y, m, "Entertainment", PRIYA_BUDGETS["Entertainment"],
                  int(rng.integers(1, 3)),
                  cfg["merchants"]["Entertainment"])

    # Other
    emit_category(rows, rng, y, m, "Other", PRIYA_BUDGETS["Other"],
                  int(rng.integers(2, 5)),
                  cfg["merchants"]["Other"])

    # Mar 2025 — year-end bonus: 2x salary
    if (y, m) == (2025, 3):
        rows.append(row(cfg["monthly_income"] * 2, "Salary",
                        date(y, m, income_day(cfg, y, m)),
                        "income", "Year-end bonus", cfg["income_rname"]))

    return rows


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

GENERATORS = {
    "kelvin": gen_kelvin_month,
    "auntie_mei": gen_mei_month,
    "ashley": gen_ashley_month,
    "brandon": gen_brandon_month,
    "priya": gen_priya_month,
}


def generate(persona: str) -> pd.DataFrame:
    cfg = PERSONAS[persona]
    rng = np.random.default_rng(cfg["seed"])
    gen = GENERATORS[persona]
    rows = [row(
        INITIAL_BALANCES[persona], "Initial Balance", INITIAL_BALANCE_DATE,
        "income", "Opening balance", "Bank Account",
    )]
    for y, m in month_iter(START_DATE, END_DATE):
        rows.extend(gen(cfg, y, m, rng))
    rows = sort_rows(rows)
    df = pd.DataFrame(rows, columns=COLUMNS)
    df["AMOUNT"] = df["AMOUNT"].round(2)
    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--persona", choices=list(PERSONAS.keys()))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--out-dir", default=DATA_DIR)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    targets = list(PERSONAS.keys()) if args.all else [args.persona]
    if not targets or targets == [None]:
        parser.error("Pass --all or --persona NAME")

    for p in targets:
        df = generate(p)
        path = os.path.join(args.out_dir, f"{p}.csv")
        df.to_csv(path, index=False)
        print(f"  wrote {path}  ({len(df)} rows, "
              f"{df['DATE'].min()} .. {df['DATE'].max()})")


if __name__ == "__main__":
    main()
