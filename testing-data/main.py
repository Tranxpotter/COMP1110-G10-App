#!/usr/bin/env python3
"""
Financial Record Test Data Generator

Production-grade CLI tool for generating mock database records that comply
with the Generate Records schema. All records use HKD currency with 2-decimal
rounding. RNAME values are drawn from category-specific merchant/employer
pools to simulate real-world recurring transactions.

Usage:
    python main.py --rows 100000 --chunk-size 5000 --output-dir ./testing_data_csvs/
"""

import argparse
import calendar
import csv
import logging
import os
import random
from datetime import date, timedelta
from typing import Generator

from faker import Faker

# ---------------------------------------------------------------------------
# Constants — simulate parent/lookup tables for FK integrity
# ---------------------------------------------------------------------------

CURRENCY: str = "HKD"
CURRENCY_DECIMALS: int = 2

VALID_CATEGORIES_SPENDING: list[str] = [
    "Food",
    "Rent",
    "Transport",
    "Utilities",
    "Entertainment",
    "Healthcare",
    "Education",
    "Shopping",
    "Insurance",
    "Subscriptions",
]

VALID_CATEGORIES_INCOME: list[str] = [
    "Salary",
    "Bonus",
    "Freelance",
    "Investment",
    "Refund",
]

VALID_CATEGORIES: list[str] = VALID_CATEGORIES_SPENDING + VALID_CATEGORIES_INCOME

# Weighted distribution for spending categories (relative weights)
SPENDING_CATEGORY_WEIGHTS: list[int] = [25, 20, 15, 10, 8, 7, 5, 5, 3, 2]

# ---------------------------------------------------------------------------
# RNAME pools — recurring merchants/employers per category
# ---------------------------------------------------------------------------

RNAME_POOLS: dict[str, list[str]] = {
    "Food": [
        "7-Eleven",
        "ParknShop",
        "Wellcome",
        "McDonald's",
        "Fairwood",
        "Café de Coral",
        "Maxim's",
        "Starbucks",
        "KFC",
        "Genki Sushi",
        "Tim Ho Wan",
        "Hung's Delicacies",
    ],
    "Rent": [
        "Centaline Property",
        "Midland Realty",
        "Sun Hung Kai Properties",
        "Henderson Land",
        "New World Development",
        "Cheung Kong Holdings",
    ],
    "Transport": [
        "MTR Corporation",
        "Uber HK",
        "Citybus",
        "KMB",
        "New World First Bus",
        "HK Taxi",
        "Star Ferry",
        "Shell",
        "Caltex",
    ],
    "Utilities": [
        "CLP Power",
        "HK Electric",
        "Water Supplies Department",
        "Towngas",
        "PCCW",
        "HKT",
        "SmarTone",
        "3 Hong Kong",
    ],
    "Entertainment": [
        "Broadway Circuit",
        "MCL Cinemas",
        "Netflix",
        "Spotify",
        "Disney+",
        "Steam",
        "PlayStation Store",
        "KKBOX",
    ],
    "Healthcare": [
        "Watsons",
        "Mannings",
        "Queen Mary Hospital",
        "Prince of Wales Hospital",
        "Dr. Chan Clinic",
        "Dr. Wong Medical",
        "Bumrungrad HK",
        "Matilda Hospital",
    ],
    "Education": [
        "HKU",
        "CUHK",
        "HKUST",
        "PolyU",
        "CityU",
        "Coursera",
        "Udemy",
        "Popular Bookstore",
        "Eslite Bookstore",
    ],
    "Shopping": [
        "HKTVmall",
        "Amazon",
        "Taobao",
        "ASOS",
        "ZARA",
        "UNIQLO",
        "Apple Store",
        "Fortress",
        "Broadway Electronics",
    ],
    "Insurance": [
        "AIA",
        "Prudential",
        "Manulife",
        "AXA",
        "Sun Life",
        "FWD",
        "Zurich Insurance",
    ],
    "Subscriptions": [
        "Netflix",
        "Spotify",
        "Apple One",
        "Adobe Creative Cloud",
        "Microsoft 365",
        "ChatGPT Plus",
        "YouTube Premium",
        "iCloud+",
    ],
    "Salary": [
        "Tech Corp HK",
        "HSBC",
        "Cathay Pacific",
        "MTR Corporation",
        "HK Government",
        "Deloitte HK",
        "Goldman Sachs HK",
        "Google HK",
    ],
    "Bonus": [
        "Tech Corp HK",
        "HSBC",
        "Cathay Pacific",
        "MTR Corporation",
        "HK Government",
        "Deloitte HK",
        "Goldman Sachs HK",
        "Google HK",
    ],
    "Freelance": [
        "Upwork Client",
        "Fiverr Client",
        "TopTal Client",
        "Direct Client — SME",
        "Direct Client — Startup",
        "Agency Contract",
    ],
    "Investment": [
        "HSBC Securities",
        "Charles Schwab",
        "Interactive Brokers",
        "Futu Securities",
        "Tiger Brokers",
        "Bank of China (HK)",
    ],
    "Refund": [
        "HKTVmall",
        "Amazon",
        "Apple Store",
        "Taobao",
        "ZARA",
        "Government Tax Office",
        "Octopus Refund",
    ],
}

# Realistic description templates per category (use {rname} for the merchant)
DESCRIPTION_TEMPLATES: dict[str, list[str]] = {
    "Food": [
        "Grocery shopping at {rname}",
        "Lunch at {rname}",
        "Dinner at {rname}",
        "Coffee at {rname}",
        "Takeaway from {rname}",
    ],
    "Rent": [
        "Monthly rent via {rname}",
        "Rent for {month}",
        "Apartment lease — {rname}",
    ],
    "Transport": [
        "Ride with {rname}",
        "Octopus top-up — {rname}",
        "Bus fare — {rname}",
        "Fuel at {rname}",
        "Commute — {rname}",
    ],
    "Utilities": [
        "{rname} bill for {month}",
        "{rname} monthly charge",
        "Utility payment — {rname}",
    ],
    "Entertainment": [
        "Movie at {rname}",
        "Subscription — {rname}",
        "Gaming purchase — {rname}",
        "Streaming — {rname}",
    ],
    "Healthcare": [
        "Consultation at {rname}",
        "Pharmacy — {rname}",
        "Medical checkup — {rname}",
        "Prescription — {rname}",
    ],
    "Education": [
        "Tuition — {rname}",
        "Course fee — {rname}",
        "Textbook — {rname}",
        "Stationery — {rname}",
    ],
    "Shopping": [
        "Online order — {rname}",
        "Purchase at {rname}",
        "Clothing — {rname}",
        "Electronics — {rname}",
    ],
    "Insurance": [
        "Premium — {rname}",
        "Insurance payment — {rname}",
        "Policy renewal — {rname}",
    ],
    "Subscriptions": [
        "Monthly subscription — {rname}",
        "Annual plan — {rname}",
        "Renewal — {rname}",
    ],
    "Salary": [
        "Monthly salary from {rname}",
        "Salary deposit — {rname}",
    ],
    "Bonus": [
        "Performance bonus — {rname}",
        "Year-end bonus — {rname}",
        "Quarterly bonus — {rname}",
    ],
    "Freelance": [
        "Freelance payment — {rname}",
        "Contract work — {rname}",
        "Consulting fee — {rname}",
    ],
    "Investment": [
        "Dividend via {rname}",
        "Stock proceeds — {rname}",
        "Interest income — {rname}",
    ],
    "Refund": [
        "Refund from {rname}",
        "Return credit — {rname}",
        "Overpayment refund — {rname}",
    ],
}

CSV_HEADER: list[str] = [
    "AMOUNT",
    "CNAME",
    "DATE",
    "TYPE",
    "CURRENCY",
    "DESCRIPTION",
    "RNAME",
]

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

fake = Faker()


def format_hkd(amount: float) -> str:
    """Round *amount* to 2 decimal places for HKD and return as a string.

    Trailing zeros are preserved (e.g. ``'12.50'`` not ``12.5``) so the
    CSV value is ready for direct database import.
    """
    return f"{amount:.{CURRENCY_DECIMALS}f}"


def _last_day_of_month(year: int, month: int) -> int:
    """Return the last calendar day for the given year/month."""
    return calendar.monthrange(year, month)[1]


def _generate_date(
    category: str,
    start_date: date,
    end_date: date,
) -> date:
    """Generate a date with temporal realism rules.

    - Salary: strictly the 1st or last day of a random month in range.
    - Spending categories: ~40 % chance of falling on a weekend (Sat/Sun),
      simulating higher weekend spending volume.
    - All others: uniform random within the range.
    """
    if category == "Salary":
        months: list[date] = []
        cursor = start_date.replace(day=1)
        while cursor <= end_date:
            months.append(cursor)
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)
        chosen_month = random.choice(months)
        if random.random() < 0.5:
            return chosen_month  # 1st of the month
        last_day = _last_day_of_month(chosen_month.year, chosen_month.month)
        return chosen_month.replace(day=last_day)

    total_days = (end_date - start_date).days
    if total_days <= 0:
        return start_date

    if category in VALID_CATEGORIES_SPENDING:
        # 40 % chance: force to a weekend
        if random.random() < 0.40:
            for _ in range(50):
                candidate = start_date + timedelta(days=random.randint(0, total_days))
                if candidate.weekday() >= 5:  # Sat=5, Sun=6
                    return candidate
        # Fall through to uniform
    return start_date + timedelta(days=random.randint(0, total_days))


def _pick_rname(category: str) -> str:
    """Select a recurring merchant/employer name for *category*.

    Draws from the predefined ``RNAME_POOLS`` to simulate real-world
    transaction patterns where the same entities appear repeatedly.
    """
    pool = RNAME_POOLS.get(category)
    if pool:
        return random.choice(pool)
    return fake.company()


def _generate_description(category: str, rname: str) -> str:
    """Pick a description template for *category* and fill placeholders."""
    templates = DESCRIPTION_TEMPLATES.get(category, ["{rname} transaction"])
    template = random.choice(templates)
    return template.format(
        rname=rname,
        month=fake.month_name(),
    )


# ---------------------------------------------------------------------------
# Record generators
# ---------------------------------------------------------------------------


def generate_standard_records(
    num_rows: int,
    start_date: date = date(2023, 1, 1),
    end_date: date = date(2025, 12, 31),
) -> Generator[list[str], None, None]:
    """Yield *num_rows* realistic financial records.

    Applies an 85/15 spending-to-income distribution and maps categories
    strictly to the correct TYPE value. RNAME is drawn from category-
    specific merchant pools. Currency is always HKD.
    """
    for _ in range(num_rows):
        is_spending = random.random() < 0.85
        tx_type = "spending" if is_spending else "income"

        if is_spending:
            category = random.choices(
                VALID_CATEGORIES_SPENDING, weights=SPENDING_CATEGORY_WEIGHTS, k=1
            )[0]
        else:
            category = random.choice(VALID_CATEGORIES_INCOME)

        tx_date = _generate_date(category, start_date, end_date)

        # Amount ranges vary by category for realism (HKD values)
        if category == "Salary":
            raw_amount = random.uniform(15000.0, 80000.0)
        elif category == "Bonus":
            raw_amount = random.uniform(2000.0, 50000.0)
        elif category == "Rent":
            raw_amount = random.uniform(5000.0, 30000.0)
        elif category in ("Investment", "Freelance"):
            raw_amount = random.uniform(500.0, 50000.0)
        else:
            raw_amount = random.uniform(5.0, 2000.0)

        amount = format_hkd(raw_amount)
        rname = _pick_rname(category)
        description = _generate_description(category, rname)

        yield [
            amount,
            category,
            tx_date.isoformat(),
            tx_type,
            CURRENCY,
            description,
            rname,
        ]


def generate_boundary_records() -> Generator[list[str], None, None]:
    """Yield edge-case records that stress-test amount boundaries.

    Covers: zero, sub-cent, very large, negative, and max-precision values.
    All rows use HKD with 2-decimal rounding.
    """
    boundary_amounts: list[float] = [
        0.0,
        0.01,
        0.001,
        -1.0,
        -9999.99,
        999999999.99,
        1e12,
        -0.0,
        0.005,
        100000000.0,
        -100000000.0,
        0.1 + 0.2,  # classic float imprecision
    ]

    for raw_amount in boundary_amounts:
        is_spending = random.random() < 0.85
        tx_type = "spending" if is_spending else "income"
        category = (
            random.choice(VALID_CATEGORIES_SPENDING)
            if is_spending
            else random.choice(VALID_CATEGORIES_INCOME)
        )
        tx_date = date(2024, 6, 15)
        amount = format_hkd(raw_amount)
        rname = _pick_rname(category)
        description = f"Boundary test: raw={raw_amount}"

        yield [
            amount,
            category,
            tx_date.isoformat(),
            tx_type,
            CURRENCY,
            description,
            rname,
        ]


def generate_anomaly_records() -> Generator[list[str], None, None]:
    """Yield records containing adversarial and edge-case data.

    Includes SQL injection payloads, encoding edge cases (Traditional
    Chinese), empty/NULL-like values, and oversized strings.
    All rows use HKD currency.
    """
    sql_injections: list[str] = [
        "'; DROP TABLE records;--",
        "1; DELETE FROM users WHERE 1=1;--",
        "' OR '1'='1",
        "'; EXEC xp_cmdshell('dir');--",
        "Robert'); DROP TABLE students;--",
        "1 UNION SELECT * FROM credentials--",
    ]

    unicode_strings: list[str] = [
        "薪資轉帳",
        "日常開銷",
        "投資收益",
        "租金繳費",
        "交通費用報銷",
        "年終獎金發放",
        "保險理賠款項",
        "退款處理完成",
    ]

    null_variants: list[str] = [
        "",
        "NULL",
        "None",
        "null",
        "N/A",
        "undefined",
        "NaN",
    ]

    # SQL injection in DESCRIPTION and RNAME
    for payload in sql_injections:
        amount = format_hkd(random.uniform(1.0, 100.0))
        yield [
            amount,
            random.choice(VALID_CATEGORIES_SPENDING),
            date(2024, 3, 15).isoformat(),
            "spending",
            CURRENCY,
            payload,
            payload,
        ]

    # Traditional Chinese in DESCRIPTION and RNAME
    for text in unicode_strings:
        amount = format_hkd(random.uniform(1.0, 5000.0))
        yield [
            amount,
            random.choice(VALID_CATEGORIES),
            date(2024, 7, 20).isoformat(),
            random.choice(["spending", "income"]),
            CURRENCY,
            text,
            text,
        ]

    # NULL/empty variants in DESCRIPTION and RNAME
    for null_val in null_variants:
        amount = format_hkd(random.uniform(0.0, 50.0))
        yield [
            amount,
            random.choice(VALID_CATEGORIES_SPENDING),
            date(2024, 1, 1).isoformat(),
            "spending",
            CURRENCY,
            null_val,
            null_val,
        ]

    # Oversized string (10 000 chars) to test varchar limits
    oversized = "A" * 10_000
    yield [
        "42.00",
        "Food",
        date(2024, 12, 25).isoformat(),
        "spending",
        CURRENCY,
        oversized,
        oversized,
    ]


# ---------------------------------------------------------------------------
# Chunked CSV writer
# ---------------------------------------------------------------------------


def write_csv_chunked(
    filepath: str,
    generator: Generator[list[str], None, None],
    chunk_size: int,
) -> int:
    """Stream rows from *generator* into a CSV at *filepath* in chunks.

    Returns the total number of rows written.
    """
    total_written = 0
    chunk: list[list[str]] = []

    with open(filepath, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(CSV_HEADER)

        for row in generator:
            chunk.append(row)
            if len(chunk) >= chunk_size:
                writer.writerows(chunk)
                total_written += len(chunk)
                logger.info(
                    "  %s — wrote chunk (%s rows, %s total)",
                    os.path.basename(filepath),
                    f"{len(chunk):,}",
                    f"{total_written:,}",
                )
                chunk = []

        # Flush remaining rows
        if chunk:
            writer.writerows(chunk)
            total_written += len(chunk)
            logger.info(
                "  %s — wrote final chunk (%s rows, %s total)",
                os.path.basename(filepath),
                f"{len(chunk):,}",
                f"{total_written:,}",
            )

    return total_written


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate mock financial records for database testing.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=10_000,
        help="Number of standard records to generate.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=2_000,
        help="Rows per write batch (controls memory usage).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./testing_data_csvs/",
        help="Directory for output CSV files.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Entry point — seeds RNGs, parses CLI args, and generates all CSVs."""
    args = parse_args(argv)

    # Deterministic seeds for reproducibility
    Faker.seed(42)
    random.seed(42)

    os.makedirs(args.output_dir, exist_ok=True)
    logger.info("Output directory: %s", os.path.abspath(args.output_dir))
    logger.info(
        "Generating %s standard rows (chunk size: %s)",
        f"{args.rows:,}",
        f"{args.chunk_size:,}",
    )

    # --- 01: Standard records ---
    path_standard = os.path.join(args.output_dir, "01_standard_records.csv")
    n = write_csv_chunked(
        path_standard,
        generate_standard_records(args.rows),
        args.chunk_size,
    )
    logger.info("Finished %s — %s rows", path_standard, f"{n:,}")

    # --- 02: Boundary amounts ---
    path_boundary = os.path.join(args.output_dir, "02_boundary_amounts.csv")
    n = write_csv_chunked(
        path_boundary,
        generate_boundary_records(),
        args.chunk_size,
    )
    logger.info("Finished %s — %s rows", path_boundary, f"{n:,}")

    # --- 03: Data anomalies ---
    path_anomalies = os.path.join(args.output_dir, "03_data_anomalies.csv")
    n = write_csv_chunked(
        path_anomalies,
        generate_anomaly_records(),
        args.chunk_size,
    )
    logger.info("Finished %s — %s rows", path_anomalies, f"{n:,}")

    logger.info("All files generated successfully.")


if __name__ == "__main__":
    main()
