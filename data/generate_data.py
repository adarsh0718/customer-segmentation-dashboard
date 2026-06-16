import os
import csv
import random
from datetime import datetime, timedelta

# Ensure the data directory exists
os.makedirs("data", exist_ok=True)

# Set random seed for reproducibility
random.seed(42)

# Parameters
NUM_CUSTOMERS = 300
START_DATE = datetime(2025, 1, 1)
END_DATE = datetime(2026, 6, 1)

# Regions and Categories
REGIONS = ["North", "South", "East", "West"]
CATEGORIES = ["Electronics", "Apparel", "Home & Kitchen", "Beauty & Health", "Sports & Outdoors"]
GENDERS = ["Male", "Female"]

# Define 4 distinct customer archetypes to ensure clustering works beautifully
# Demographic stats: (Avg Age, Std Age, Avg Income (k INR), Std Income)
# Behavioral stats: (Avg Transactions, Avg Order Value (INR), Avg Days Since Last Order)
ARCHETYPES = {
    "VIP": {
        "demographics": {"age": (35, 5), "income": (1200000, 150000), "gender_ratio": 0.5},
        "behavior": {"tx_count": (15, 3), "aov": (12000, 2000), "recency_days": (5, 4)}
    },
    "Loyal_Budget": {
        "demographics": {"age": (28, 6), "income": (500000, 80000), "gender_ratio": 0.6},
        "behavior": {"tx_count": (10, 2), "aov": (3500, 800), "recency_days": (20, 10)}
    },
    "Spur_of_Moment": {
        "demographics": {"age": (22, 4), "income": (800000, 120000), "gender_ratio": 0.4},
        "behavior": {"tx_count": (3, 1), "aov": (8000, 1500), "recency_days": (15, 8)}
    },
    "Hibernating": {
        "demographics": {"age": (48, 8), "income": (600000, 100000), "gender_ratio": 0.5},
        "behavior": {"tx_count": (2, 1), "aov": (2000, 500), "recency_days": (180, 40)}
    }
}

demographics_rows = []
transactions_rows = []

tx_id_counter = 100001

for c_idx in range(1, NUM_CUSTOMERS + 1):
    c_id = f"CUST_{c_idx:04d}"
    
    # Assign an archetype to this customer
    archetype_name = random.choices(
        list(ARCHETYPES.keys()), 
        weights=[0.20, 0.35, 0.25, 0.20], 
        k=1
    )[0]
    
    arch = ARCHETYPES[archetype_name]
    
    # Generate Demographics
    age_mean, age_std = arch["demographics"]["age"]
    age = int(random.normalvariate(age_mean, age_std))
    age = max(18, min(75, age)) # Clamp between 18 and 75
    
    inc_mean, inc_std = arch["demographics"]["income"]
    annual_income = int(random.normalvariate(inc_mean, inc_std))
    annual_income = max(150000, annual_income) # Minimum income
    
    gender = "Female" if random.random() < arch["demographics"]["gender_ratio"] else "Male"
    region = random.choice(REGIONS)
    
    demographics_rows.append({
        "Customer_ID": c_id,
        "Age": age,
        "Annual_Income_INR": annual_income,
        "Gender": gender,
        "Region": region
    })
    
    # Generate Transactions
    tx_mean, tx_std = arch["behavior"]["tx_count"]
    tx_count = max(1, int(random.normalvariate(tx_mean, tx_std)))
    
    aov_mean, aov_std = arch["behavior"]["aov"]
    recency_mean, recency_std = arch["behavior"]["recency_days"]
    recency_days = max(1, int(random.normalvariate(recency_mean, recency_std)))
    
    # Generate transaction dates leading back from current date
    # Let's assume current date is June 1, 2026
    current_date = END_DATE
    last_tx_date = current_date - timedelta(days=recency_days)
    
    # Generate dates for all transactions
    tx_dates = [last_tx_date]
    for _ in range(tx_count - 1):
        # Generate previous transaction date (further back in time)
        days_gap = random.randint(10, 90)
        prev_date = tx_dates[-1] - timedelta(days=days_gap)
        if prev_date < START_DATE:
            break
        tx_dates.append(prev_date)
        
    for date in tx_dates:
        amount = int(random.normalvariate(aov_mean, aov_std))
        amount = max(500, amount) # Minimum amount 500 Rupees
        
        category = random.choice(CATEGORIES)
        
        transactions_rows.append({
            "Transaction_ID": f"TX_{tx_id_counter}",
            "Customer_ID": c_id,
            "Date": date.strftime("%d-%m-%Y"),
            "Amount_INR": amount,
            "Product_Category": category
        })
        tx_id_counter += 1

# Write to CSV
with open("data/customer_demographics.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Customer_ID", "Age", "Annual_Income_INR", "Gender", "Region"])
    writer.writeheader()
    writer.writerows(demographics_rows)

with open("data/customer_transactions.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Transaction_ID", "Customer_ID", "Date", "Amount_INR", "Product_Category"])
    writer.writeheader()
    writer.writerows(transactions_rows)

print(f"Successfully generated {len(demographics_rows)} customers and {len(transactions_rows)} transactions!")
