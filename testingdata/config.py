"""Persona and alert configuration for the mock transaction generator.

Thresholds, category tags and merchant pools live here so that both the
generator and the validator read from the same source of truth.
"""

from datetime import date

START_DATE = date(2024, 10, 1)
END_DATE = date(2026, 3, 31)

DATA_DIR = "data"

# Opening balance row recorded one day before START_DATE so it sits at the
# top of the CSV but is naturally excluded from any month-slice validation.
INITIAL_BALANCE_DATE = date(2024, 9, 30)

INITIAL_BALANCES = {
    "kelvin":     15000,
    "auntie_mei":  3000,
    "ashley":      5000,
    "brandon":    50000,
    "priya":      80000,
}


PERSONAS = {
    # ------------------------------------------------------------------
    # 1. Kelvin — Lifestyle Overspender
    # ------------------------------------------------------------------
    "kelvin": {
        "monthly_income": 35000,
        "income_day": 25,
        "income_rname": "ABC Marketing Ltd",
        "seed": 101,
        "baseline_spend_range": (38000, 42000),
        "n_transactions_range": (80, 100),
        "category_mix": {
            "Rent": 0.30,
            "Dining": 0.25,
            "Entertainment": 0.18,
            "Shopping": 0.15,
            "Transport": 0.08,
            "Other": 0.04,
        },
        "merchants": {
            "Rent": ["Landlord"],
            "Dining": ["Honi Honi", "Ozone", "Black Sheep Restaurants", "Nobu HK", "Mott 32", "Ho Lee Fook"],
            "Entertainment": ["LKF Concepts", "Cinema City", "HK Philharmonic", "Volar", "Club Cubic"],
            "Shopping": ["Lane Crawford", "Harvey Nichols", "ZARA", "Apple Store", "IFC Mall"],
            "Transport": ["Uber", "MTR", "HKTaxi", "Citybus"],
            "Other": ["HSBC Credit Card", "Octopus Reload", "7-Eleven", "Circle K"],
        },
        "savings_categories": [],
        "investment_categories": [],
        "subscription_categories": [],
        "bill_pairs": [("Rent", "Landlord")],
        "alerts": {
            "spending_limit": {
                "categories": ["Dining", "Entertainment", "Shopping"],
                "threshold_pct": 0.55,
                "reset_day": 1,
            },
            "big_payment": {
                "categories": ["Shopping", "Entertainment"],
                "threshold_pct": 0.20,
            },
            "projected_spend": {
                "threshold_pct": 1.00,
                "trigger_day": 15,
                "exclude_categories": ["Rent"],
            },
            "recurring": {"n": 3, "window_days": 60},
            "extra_surplus": {"threshold_hkd": 4000},
        },
        "savings_goal_hkd": 0,
    },

    # ------------------------------------------------------------------
    # 2. Auntie Mei — Paycheck-to-Paycheck
    # ------------------------------------------------------------------
    "auntie_mei": {
        "monthly_income": 28000,
        "income_day": 15,
        "income_rname": "Hospital Authority",
        "seed": 102,
        "baseline_spend_range": (27000, 27800),
        "n_transactions_range": (60, 70),
        "category_mix": {
            "Rent": 0.38,
            "Groceries": 0.18,
            "Kids": 0.16,
            "Utilities": 0.08,
            "Transport": 0.07,
            "Insurance": 0.06,
            "Dining": 0.05,
            "Entertainment": 0.02,
        },
        "merchants": {
            "Rent": ["Landlord"],
            "Groceries": ["Wellcome", "ParknShop", "DCH Food Mart"],
            "Kids": ["Kumon", "Modern Education", "School Fees", "Eugene Baby"],
            "Utilities": ["CLP Power", "Towngas", "HKBN", "Water Supplies Department"],
            "Transport": ["MTR", "Citybus", "Octopus Reload"],
            "Insurance": ["AIA Insurance"],
            "Dining": ["Café de Coral", "Fairwood", "Maxim's"],
            "Entertainment": ["Broadway Cinema", "YouTube TV"],
        },
        "savings_categories": [],
        "investment_categories": [],
        "subscription_categories": [],
        "bill_pairs": [
            ("Utilities", "CLP Power"),
            ("Utilities", "Towngas"),
            ("Utilities", "HKBN"),
            ("Insurance", "AIA Insurance"),
            ("Rent", "Landlord"),
        ],
        "alerts": {
            "spending_limit": {
                "categories": ["Groceries", "Dining", "Entertainment", "Kids"],
                "threshold_pct": 0.55,
                "reset_day": 15,
            },
            "big_payment": {
                "categories": ["Kids", "Entertainment"],
                "threshold_pct": 0.20,
            },
            "projected_spend": {
                "threshold_pct": 1.00,
                "trigger_day": 12,
                "exclude_categories": ["Rent", "Utilities", "Insurance"],
            },
            "recurring": {"n": 3, "window_days": 60},
            "extra_surplus": {"threshold_hkd": 1200},
            "runway": {"buffer_hkd": 400, "days_before_payday": 3},
        },
        "savings_goal_hkd": 0,
    },

    # ------------------------------------------------------------------
    # 3. Ashley — Impulse Micro-spender
    # ------------------------------------------------------------------
    "ashley": {
        "monthly_income": 20000,
        "income_day": "last_weekday",
        "income_rname": "Design Studio HK",
        "seed": 103,
        "baseline_spend_range": (19200, 19800),
        "n_transactions_range": (100, 140),
        "category_mix": {
            "Dining": 0.30,
            "Shopping": 0.25,
            "Rent": 0.15,
            "Entertainment": 0.15,
            "Transport": 0.10,
            "Other": 0.05,
        },
        "merchants": {
            "Rent": ["Landlord"],
            "Dining": ["Starbucks", "Pacific Coffee", "Foodpanda", "Keeta", "% Arabica", "Fuel Espresso"],
            "Shopping": ["HKTVmall", "Taobao", "ZARA", "Uniqlo", "Apple Store"],
            "Entertainment": ["Netflix", "Spotify", "Disney+", "YouTube Premium", "Apple"],
            "Transport": ["MTR", "Uber", "HKTaxi"],
            "Other": ["7-Eleven", "Circle K", "ATM"],
        },
        "savings_categories": [],
        "investment_categories": [],
        "subscription_categories": ["Entertainment"],
        "bill_pairs": [("Rent", "Landlord")],
        "alerts": {
            "spending_limit": {
                "categories": ["Dining", "Shopping", "Entertainment"],
                "threshold_pct": 0.80,
                "reset_day": 1,
            },
            "big_payment": {
                "categories": ["Shopping"],
                "threshold_pct": 0.20,
            },
            "projected_spend": {
                "threshold_pct": 1.20,
                "trigger_day": 15,
                "exclude_categories": ["Rent"],
            },
            "recurring": {"n": 15, "window_days": 90},
            "extra_surplus": {"threshold_hkd": 10000},
            "late_night": {"keyword": "late-night", "min_count": 5, "window_days": 7},
            "micro_density": {"amount_under": 100, "pct_threshold": 0.75},
        },
        "savings_goal_hkd": 0,
    },

    # ------------------------------------------------------------------
    # 4. Brandon — Subscription Hoarder
    # ------------------------------------------------------------------
    "brandon": {
        "monthly_income": 45000,
        "income_day": 1,
        "income_rname": "TechCorp HK",
        "seed": 104,
        "baseline_spend_range": (31500, 32500),
        "n_transactions_range": (45, 55),
        "category_mix": {
            "Rent": 0.35,
            "Dining": 0.15,
            "Shopping": 0.12,
            "Subscriptions": 0.10,
            "Groceries": 0.10,
            "Transport": 0.08,
            "Other": 0.10,
        },
        "merchants": {
            "Rent": ["Landlord"],
            "Dining": ["Tim Ho Wan", "Cafe de Coral", "Foodpanda", "Deliveroo"],
            "Shopping": ["Apple Store", "Lane Crawford", "Uniqlo", "HKTVmall"],
            "Groceries": ["Wellcome", "ParknShop", "CitySuper"],
            "Transport": ["MTR", "Uber"],
            "Other": ["7-Eleven", "HSBC Credit Card", "Octopus Reload"],
        },
        "savings_categories": [],
        "investment_categories": [],
        "subscription_categories": ["Subscriptions"],
        "bill_pairs": [("Rent", "Landlord")],
        "alerts": {
            "spending_limit": {
                "categories": ["Shopping", "Dining", "Subscriptions"],
                "threshold_pct": 0.50,
                "reset_day": 1,
            },
            "big_payment": {
                "categories": ["Shopping"],
                "threshold_pct": 0.20,
            },
            "projected_spend": {
                "threshold_pct": 1.00,
                "trigger_day": 15,
                "exclude_categories": ["Rent"],
            },
            "recurring": {"n": 3, "window_days": 90},
            "extra_surplus": {"threshold_hkd": 20000},
            "subscription_creep": {"delta_hkd": 300},
            "projected_subscription": {"annual_threshold_hkd": 40000},
        },
        "savings_goal_hkd": 0,
    },

    # ------------------------------------------------------------------
    # 5. Priya — Responsible Spender
    # ------------------------------------------------------------------
    "priya": {
        "monthly_income": 40000,
        "income_day": 28,
        "income_rname": "Pacific Asset Management",
        "seed": 105,
        "baseline_spend_range": (29500, 30500),
        "n_transactions_range": (35, 50),
        "category_mix": {
            "Rent": 0.25,
            "Savings": 0.20,
            "Groceries": 0.12,
            "Investment": 0.10,
            "Dining": 0.10,
            "Transport": 0.08,
            "Other": 0.07,
            "Utilities": 0.05,
            "Entertainment": 0.03,
        },
        "merchants": {
            "Rent": ["Landlord"],
            "Savings": ["Mox Bank"],
            "Investment": ["IBKR"],
            "Groceries": ["Wellcome", "ParknShop"],
            "Dining": ["Kam's Roast Goose", "Tim Ho Wan", "Maxim's"],
            "Transport": ["MTR", "Citybus"],
            "Utilities": ["CLP Power", "Towngas"],
            "Entertainment": ["Broadway Cinema", "Netflix"],
            "Other": ["Lane Crawford", "7-Eleven"],
        },
        "savings_categories": ["Savings", "Investment"],
        "investment_categories": ["Investment"],
        "subscription_categories": [],
        "bill_pairs": [
            ("Rent", "Landlord"),
            ("Utilities", "CLP Power"),
            ("Utilities", "Towngas"),
        ],
        "alerts": {
            "spending_limit": {
                "categories": ["Dining", "Entertainment", "Other"],
                "threshold_pct": 0.40,
                "reset_day": 1,
            },
            "big_payment": {
                "categories": ["Other"],
                "threshold_pct": 0.20,
            },
            "projected_spend": {
                "threshold_pct": 1.00,
                "trigger_day": 15,
                "exclude_categories": ["Rent", "Utilities", "Savings", "Investment"],
            },
            "recurring": {"n": 3, "window_days": 60},
            "extra_surplus": {"threshold_hkd": 20000, "threshold_pct": 0.35},
            "savings_goal": {"monthly_pct": 0.20},
            "future_savings": {"target_hkd": 100000, "by": "2026-01-31"},
        },
        "savings_goal_hkd": 8000,
    },
}


BRANDON_SUBSCRIPTIONS = [
    # (rname, amount, day_of_month, added_month, removed_month)
    ("Adobe CC", 178, 1, None, None),
    ("24 Hour Fitness", 680, 1, None, None),
    ("Spotify", 58, 3, None, None),
    ("Netflix", 93, 5, None, None),
    ("ChatGPT Plus", 156, 6, None, None),
    ("YouTube Premium", 78, 7, None, None),
    ("Disney+", 73, 8, None, None),
    ("HBO GO", 39, 10, None, None),
    ("Calm", 55, 11, None, None),
    ("Viu", 48, 12, None, None),
    ("Notion", 78, 14, None, None),
    ("Apple TV+", 68, 15, None, None),
    ("Duolingo Plus", 55, 16, None, None),
    ("Dropbox", 78, 18, None, None),
    ("Apple Music", 58, 20, None, None),
    ("iCloud 2TB", 78, 22, None, None),
    ("1Password", 28, 25, None, None),
    # creep begins May 2025
    ("Perplexity Pro", 156, 9, (2025, 5), None),
    ("Midjourney", 240, 17, (2025, 5), None),
    # gradual adds to push projection past 40K annual by Feb 2026
    ("LinkedIn Premium", 280, 13, (2025, 9), None),
    ("Audible", 99, 19, (2025, 12), None),
    ("Headspace", 99, 21, (2025, 12), None),
    ("Claude Pro", 200, 23, (2026, 2), None),
    ("GitHub Copilot", 120, 24, (2026, 2), None),
    ("Grammarly Premium", 108, 26, (2026, 2), None),
    ("Microsoft 365", 108, 27, (2026, 2), None),
    ("Canva Pro", 99, 2, (2026, 2), None),
    ("NYT Digital", 68, 4, (2026, 2), None),
]


ASHLEY_FIXED_SUBS = [
    ("Netflix", 93, 5),
    ("Spotify", 58, 8),
    ("Disney+", 73, 12),
    ("YouTube Premium", 78, 18),
    ("Apple", 58, 22),
]
