# Mock Transaction Datasets

Each CSV begins with a single `Initial Balance` row dated `2024-09-30`,
then 18 months of transactions from Oct 2024 through Mar 2026.
Schema: `AMOUNT, CNAME, DATE, TYPE, CURRENCY, DESCRIPTION, RNAME`.

## Categories per dataset

| Dataset           | Initial Balance (HKD) | Income categories | Spending categories |
|-------------------|----------------------:|-------------------|---------------------|
| `kelvin.csv`      | 15,000  | Initial Balance, Salary | Rent, Dining, Entertainment, Shopping, Transport, Other |
| `auntie_mei.csv`  |  3,000  | Initial Balance, Salary, Other (utility refund Mar 2026) | Rent, Utilities, Insurance, Groceries, Kids, Transport, Dining, Entertainment |
| `ashley.csv`      |  5,000  | Initial Balance, Salary | Rent, Dining, Shopping, Entertainment, Transport, Other |
| `brandon.csv`     | 50,000  | Initial Balance, Salary | Rent, Subscriptions, Dining, Shopping, Groceries, Transport, Other |
| `priya.csv`       | 80,000  | Initial Balance, Salary | Rent, Savings, Investment, Utilities, Groceries, Dining, Transport, Entertainment, Other |
