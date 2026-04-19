"""Run every alert rule against each persona's CSV and report a month-by-month
table of which alerts fire. This is the acceptance test.

Usage:
    python validate.py            # full report
    python validate.py --persona priya
"""

from __future__ import annotations

import argparse
import os
from datetime import date, timedelta

import pandas as pd

from config import DATA_DIR, END_DATE, PERSONAS, START_DATE
from generate_data import month_iter, last_day


ALERT_CODES = [
    "SpendLimit",    # Rule 1
    "BigPayment",    # Rule 2
    "Recurring",     # Rule 3
    "Surplus",       # Rule 4
    "SavingsGoal",   # Rule 5
    "ProjSpend",     # Rule 10 (trend + alert)
    "SubCreep",      # Rule 12 variant
    "ProjSub",       # Rule 12
    "FutureSavings", # Rule 11
    "Runway",        # Auntie Mei variant
    "LateNight",     # Ashley
    "MicroDensity",  # Ashley
    "BillAnomaly",   # Optional
]


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_csv(persona: str) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, f"{persona}.csv")
    df = pd.read_csv(path, parse_dates=["DATE"])
    df["YEAR"] = df["DATE"].dt.year
    df["MONTH"] = df["DATE"].dt.month
    return df


def month_slice(df: pd.DataFrame, y: int, m: int) -> pd.DataFrame:
    return df[(df["YEAR"] == y) & (df["MONTH"] == m)]


def spending(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["TYPE"] == "spending"]


def income(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["TYPE"] == "income"]


# ---------------------------------------------------------------------------
# Alert rules
# ---------------------------------------------------------------------------

def check_spending_limit(df, cfg, y, m):
    a = cfg["alerts"].get("spending_limit")
    if not a:
        return False, ""
    cats = a["categories"]
    reset_day = a.get("reset_day", 1)
    threshold = a["threshold_pct"] * cfg["monthly_income"] \
        if "threshold_pct" in a else a["threshold_hkd"]
    window_start = date(y, m, min(reset_day, last_day(y, m)))
    end = date(y, m, last_day(y, m))
    mask = (df["TYPE"] == "spending") & (df["CNAME"].isin(cats)) \
        & (df["DATE"].dt.date >= window_start) & (df["DATE"].dt.date <= end)
    total = float(df.loc[mask, "AMOUNT"].sum())
    return total > threshold, f"HK${total:,.0f} > HK${threshold:,.0f}"


def check_big_payment(df, cfg, y, m):
    a = cfg["alerts"].get("big_payment")
    if not a:
        return False, ""
    cats = a["categories"]
    threshold = a["threshold_pct"] * cfg["monthly_income"] \
        if "threshold_pct" in a else a["threshold_hkd"]
    sub = month_slice(df, y, m)
    mask = (sub["TYPE"] == "spending") & (sub["CNAME"].isin(cats)) \
        & (sub["AMOUNT"] > threshold)
    hits = sub.loc[mask]
    if len(hits) == 0:
        return False, ""
    biggest = hits["AMOUNT"].max()
    return True, f"HK${biggest:,.0f} (threshold HK${threshold:,.0f})"


def check_recurring(df, cfg, y, m):
    a = cfg["alerts"].get("recurring")
    if not a:
        return False, ""
    n = a["n"]
    window = a["window_days"]
    end = date(y, m, last_day(y, m))
    start = end - timedelta(days=window - 1)
    mask = (df["TYPE"] == "spending") \
        & (df["DATE"].dt.date >= start) & (df["DATE"].dt.date <= end)
    sub = df.loc[mask]
    counts = sub.groupby("RNAME").size()
    hits = counts[counts >= n]
    if len(hits) == 0:
        return False, ""
    top = hits.sort_values(ascending=False).head(3)
    return True, ", ".join(f"{r}:{c}" for r, c in top.items())


def check_surplus(df, cfg, y, m):
    a = cfg["alerts"].get("extra_surplus")
    if not a:
        return False, ""
    sub = month_slice(df, y, m)
    inc = float(income(sub)["AMOUNT"].sum())
    spent = float(spending(sub)["AMOUNT"].sum())
    surplus = inc - spent
    threshold_hkd = a.get("threshold_hkd", float("inf"))
    threshold_pct = a.get("threshold_pct", 1.0)
    hkd_fire = surplus >= threshold_hkd
    pct_fire = inc > 0 and surplus >= threshold_pct * inc
    fire = hkd_fire or pct_fire
    return fire, f"surplus HK${surplus:,.0f}" if fire else ""


def check_savings_goal(df, cfg, y, m):
    a = cfg["alerts"].get("savings_goal")
    if not a:
        return False, ""
    sub = month_slice(df, y, m)
    inc = float(income(sub)["AMOUNT"].sum())
    spent_non_save = float(spending(sub[~sub["CNAME"].isin(cfg["savings_categories"])])["AMOUNT"].sum())
    explicit_save = float(spending(sub[sub["CNAME"].isin(cfg["savings_categories"])])["AMOUNT"].sum())
    residual = max(0.0, inc - spent_non_save - explicit_save)
    total_saved = explicit_save + residual
    rate = total_saved / inc if inc > 0 else 0.0
    fire = rate >= a["monthly_pct"]
    return fire, f"rate {rate:.0%}" if fire else ""


def check_proj_spend(df, cfg, y, m):
    a = cfg["alerts"].get("projected_spend")
    if not a:
        return False, ""
    D = a["trigger_day"]
    exclude = set(a.get("exclude_categories", []))
    sub = month_slice(df, y, m)
    sub = spending(sub)
    sub = sub[~sub["CNAME"].isin(exclude)]
    to_day = sub[sub["DATE"].dt.day <= D]
    cur = float(to_day["AMOUNT"].sum())
    days_in_month = last_day(y, m)
    projected = cur * (days_in_month / D) if D > 0 else 0
    threshold = a["threshold_pct"] * cfg["monthly_income"] \
        if "threshold_pct" in a else a["threshold_hkd"]
    fire = projected > threshold
    return fire, f"proj HK${projected:,.0f} > HK${threshold:,.0f}" if fire else ""


def check_sub_creep(df, cfg, y, m):
    a = cfg["alerts"].get("subscription_creep")
    if not a:
        return False, ""
    sub_cats = cfg["subscription_categories"]
    if not sub_cats:
        return False, ""
    prev = m - 1
    prev_y = y
    if prev == 0:
        prev = 12
        prev_y = y - 1
    cur_total = float(spending(month_slice(df, y, m))
                      .query("CNAME in @sub_cats")["AMOUNT"].sum())
    prev_total = float(spending(month_slice(df, prev_y, prev))
                       .query("CNAME in @sub_cats")["AMOUNT"].sum())
    if prev_total == 0:
        return False, ""
    delta = cur_total - prev_total
    fire = delta >= a["delta_hkd"]
    return fire, f"+HK${delta:,.0f} vs prev" if fire else ""


def check_proj_sub(df, cfg, y, m):
    a = cfg["alerts"].get("projected_subscription")
    if not a:
        return False, ""
    sub_cats = cfg["subscription_categories"]
    if not sub_cats:
        return False, ""
    cur = float(spending(month_slice(df, y, m))
                .query("CNAME in @sub_cats")["AMOUNT"].sum())
    annual = cur * 12
    fire = annual > a["annual_threshold_hkd"]
    return fire, f"proj annual HK${annual:,.0f}" if fire else ""


def check_future_savings(df, cfg, y, m):
    a = cfg["alerts"].get("future_savings")
    if not a:
        return False, ""
    target = a["target_hkd"]
    sav_cats = cfg["savings_categories"]
    if not sav_cats:
        return False, ""
    end = date(y, m, last_day(y, m))
    prev_end = date(y, m, 1) - timedelta(days=1)
    cum_now = float(spending(df[df["DATE"].dt.date <= end])
                    .query("CNAME in @sav_cats")["AMOUNT"].sum())
    cum_prev = float(spending(df[df["DATE"].dt.date <= prev_end])
                     .query("CNAME in @sav_cats")["AMOUNT"].sum())
    crossed = cum_prev < target <= cum_now
    return crossed, f"cum HK${cum_now:,.0f}" if crossed else ""


def check_runway(df, cfg, y, m):
    """Runway = will the cycle's residual leave a cushion? We approximate
    cycle residual as month-end income minus spending. Firing means the
    user is on track to hit their payday buffer."""
    a = cfg["alerts"].get("runway")
    if not a:
        return False, ""
    buffer = a["buffer_hkd"]
    sub = month_slice(df, y, m)
    inc = float(income(sub)["AMOUNT"].sum())
    spent = float(spending(sub)["AMOUNT"].sum())
    residual = inc - spent
    fire = residual < buffer
    return fire, f"residual HK${residual:,.0f}" if fire else ""


def check_late_night(df, cfg, y, m):
    a = cfg["alerts"].get("late_night")
    if not a:
        return False, ""
    kw = a["keyword"].lower()
    min_count = a["min_count"]
    window = a["window_days"]
    sub = month_slice(df, y, m)
    sub = spending(sub)
    night = sub[sub["DESCRIPTION"].str.lower().str.contains(kw, na=False)]
    if night.empty:
        return False, ""
    days = sorted(night["DATE"].dt.date.tolist())
    for i in range(len(days)):
        end = days[i] + timedelta(days=window - 1)
        cnt = sum(1 for d in days[i:] if d <= end)
        if cnt >= min_count:
            return True, f"{cnt} in {window}d"
    return False, ""


def check_micro_density(df, cfg, y, m):
    a = cfg["alerts"].get("micro_density")
    if not a:
        return False, ""
    sub = month_slice(df, y, m)
    sub = spending(sub)
    if len(sub) == 0:
        return False, ""
    under = (sub["AMOUNT"] < a["amount_under"]).sum()
    pct = under / len(sub)
    fire = pct >= a["pct_threshold"]
    return fire, f"{pct:.0%} micro" if fire else ""


def check_bill_anomaly(df, cfg, y, m):
    pairs = cfg.get("bill_pairs", [])
    if not pairs:
        return False, ""
    end = date(y, m, last_day(y, m))
    lookback = end - timedelta(days=185)  # ~6 months prior
    fired = []
    for cname, rname in pairs:
        mask_prev = (df["CNAME"] == cname) & (df["RNAME"] == rname) \
            & (df["DATE"].dt.date >= lookback) & (df["DATE"].dt.date < date(y, m, 1))
        mask_cur = (df["CNAME"] == cname) & (df["RNAME"] == rname) \
            & (df["YEAR"] == y) & (df["MONTH"] == m)
        prev = df.loc[mask_prev, "AMOUNT"]
        cur = df.loc[mask_cur, "AMOUNT"].sum()
        if len(prev) < 3 or cur == 0:
            continue
        avg = prev.mean()
        if cur > avg * 1.4:
            fired.append(f"{rname} +{((cur / avg) - 1):.0%}")
    if not fired:
        return False, ""
    return True, ", ".join(fired)


CHECKERS = {
    "SpendLimit": check_spending_limit,
    "BigPayment": check_big_payment,
    "Recurring": check_recurring,
    "Surplus": check_surplus,
    "SavingsGoal": check_savings_goal,
    "ProjSpend": check_proj_spend,
    "SubCreep": check_sub_creep,
    "ProjSub": check_proj_sub,
    "FutureSavings": check_future_savings,
    "Runway": check_runway,
    "LateNight": check_late_night,
    "MicroDensity": check_micro_density,
    "BillAnomaly": check_bill_anomaly,
}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def build_report(persona: str):
    cfg = PERSONAS[persona]
    df = load_csv(persona)
    rows = []
    for y, m in month_iter(START_DATE, END_DATE):
        row = {"Month": f"{y}-{m:02d}"}
        for code in ALERT_CODES:
            checker = CHECKERS[code]
            fire, _ = checker(df, cfg, y, m)
            row[code] = "X" if fire else "."
        rows.append(row)
    return pd.DataFrame(rows)


def build_detail(persona: str):
    cfg = PERSONAS[persona]
    df = load_csv(persona)
    lines = []
    for y, m in month_iter(START_DATE, END_DATE):
        for code in ALERT_CODES:
            checker = CHECKERS[code]
            fire, detail = checker(df, cfg, y, m)
            if fire:
                lines.append(f"  {y}-{m:02d} {code}: {detail}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--persona", choices=list(PERSONAS.keys()))
    parser.add_argument("--detail", action="store_true",
                        help="Print per-alert detail lines")
    args = parser.parse_args()

    targets = [args.persona] if args.persona else list(PERSONAS.keys())
    for p in targets:
        print(f"\n=== {p} ===")
        report = build_report(p)
        print(report.to_string(index=False))
        if args.detail:
            print("--- details ---")
            print(build_detail(p))


if __name__ == "__main__":
    main()
