import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import os

class ClusteringEngine:
    def __init__(self, demographics_path=None, transactions_path=None):
        self.demographics_path = demographics_path or os.path.join("data", "customer_demographics.csv")
        self.transactions_path = transactions_path or os.path.join("data", "customer_transactions.csv")
        self.raw_data = None
        self.processed_data = None
        
    def load_default_data(self):
        """Loads and merges demographics and transactions data."""
        if not os.path.exists(self.demographics_path) or not os.path.exists(self.transactions_path):
            raise FileNotFoundError("Default demographics or transactions CSV files are missing.")
            
        df_demo = pd.read_csv(self.demographics_path)
        df_tx = pd.read_csv(self.transactions_path)
        
        return self._preprocess_and_merge(df_demo, df_tx)
        
    def _preprocess_and_merge(self, df_demo, df_tx):
        """Calculates RFM metrics and merges with demographics."""
        # Convert Date to datetime. Format is DD-MM-YYYY
        df_tx["Date"] = pd.to_datetime(df_tx["Date"], format="%d-%m-%Y", errors='coerce')
        # If any parsing failed, try fallback
        if df_tx["Date"].isna().any():
            df_tx["Date"] = pd.to_datetime(df_tx["Date"], errors='coerce')
            
        # Reference date is the day after the last transaction in the dataset
        ref_date = df_tx["Date"].max() + pd.Timedelta(days=1)
        
        # Calculate RFM per customer
        rfm = df_tx.groupby("Customer_ID").agg(
            Recency=("Date", lambda x: (ref_date - x.max()).days),
            Frequency=("Transaction_ID", "count"),
            Monetary=("Amount_INR", "sum")
        ).reset_index()
        
        # Merge with Demographics
        merged = pd.merge(df_demo, rfm, on="Customer_ID", how="inner")
        self.raw_data = merged.copy()
        return merged

    def run_clustering(self, n_clusters=4, selected_features=None):
        """Runs scaling, K-Means clustering, PCA, and generates metrics."""
        if self.raw_data is None:
            self.load_default_data()
            
        df = self.raw_data.copy()
        
        # Default clustering features
        if selected_features is None:
            selected_features = ["Recency", "Frequency", "Monetary", "Age", "Annual_Income_INR"]
            
        # Ensure selected features exist
        available_features = [f for f in selected_features if f in df.columns]
        if not available_features:
            raise ValueError("None of the selected features exist in the dataset.")
            
        # Handle NaN values by filling with median
        for col in available_features:
            df[col] = df[col].fillna(df[col].median())
            
        # Scale Features
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(df[available_features])
        
        # K-Means Clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(scaled_features)
        df["Cluster"] = cluster_labels
        
        # Calculate Silhouette Score
        sil_score = float(silhouette_score(scaled_features, cluster_labels)) if n_clusters > 1 else 0.0
        
        # PCA Dimensionality Reduction to 2D for visualization
        pca = PCA(n_components=2, random_state=42)
        pca_coords = pca.fit_transform(scaled_features)
        df["PCA_1"] = pca_coords[:, 0]
        df["PCA_2"] = pca_coords[:, 1]
        
        # Generate Cluster Profiles / Summaries
        cluster_summaries = self._generate_cluster_summaries(df, available_features)
        
        self.processed_data = df
        return df, sil_score, cluster_summaries

    def _generate_cluster_summaries(self, df, features):
        """Computes average metrics and assigns archetypes to each cluster."""
        summaries = []
        overall_means = df[features].mean()
        
        for cluster_id in sorted(df["Cluster"].unique()):
            cluster_df = df[df["Cluster"] == cluster_id]
            cluster_means = cluster_df[features].mean()
            cluster_size = len(cluster_df)
            cluster_pct = (cluster_size / len(df)) * 100
            
            # Determine profile name dynamically based on feature deviations from mean
            profile_name = self._assign_profile_name(cluster_means, overall_means)
            
            # Demographic distributions
            gender_dist = cluster_df["Gender"].value_counts(normalize=True).to_dict() if "Gender" in cluster_df.columns else {}
            region_dist = cluster_df["Region"].value_counts(normalize=True).to_dict() if "Region" in cluster_df.columns else {}
            
            # Format distributions for JSON output
            gender_dist = {k: round(v * 100, 1) for k, v in gender_dist.items()}
            region_dist = {k: round(v * 100, 1) for k, v in region_dist.items()}
            
            summary = {
                "cluster_id": int(cluster_id),
                "profile_name": profile_name,
                "size": int(cluster_size),
                "percentage": round(cluster_pct, 1),
                "averages": {col: round(float(cluster_means[col]), 2) for col in features},
                "gender_dist": gender_dist,
                "region_dist": region_dist
            }
            summaries.append(summary)
            
        return summaries

    def _assign_profile_name(self, cluster_means, overall_means):
        """Assigns archetypes based on how cluster averages compare to global averages."""
        # Get relative deviations (ratio of cluster mean to overall mean)
        dev = {}
        for col in overall_means.index:
            dev[col] = cluster_means[col] / overall_means[col] if overall_means[col] != 0 else 1
            
        r_dev = dev.get("Recency", 1.0)
        f_dev = dev.get("Frequency", 1.0)
        m_dev = dev.get("Monetary", 1.0)
        inc_dev = dev.get("Annual_Income_INR", 1.0)
        age_dev = dev.get("Age", 1.0)
        
        # Rules logic
        if m_dev > 1.3 and f_dev > 1.2 and r_dev < 0.6:
            return "VIP Champions"
        elif f_dev > 1.1 and r_dev < 0.8 and m_dev >= 0.8:
            return "Loyal Spenders"
        elif r_dev < 0.8 and f_dev < 0.8 and m_dev > 1.1:
            return "New Big Spenders"
        elif r_dev > 1.4 and f_dev < 0.8:
            return "Hibernating / At Risk"
        elif m_dev < 0.7 and f_dev > 0.8:
            return "Frugal / Budget Shoppers"
        elif inc_dev > 1.2 and m_dev < 0.9:
            return "High Income, Low Spend"
        elif age_dev < 0.85:
            return "Young Explorers"
        elif age_dev > 1.15:
            return "Senior Patrons"
        
        # Fallback ranking-based names if rules don't match cleanly
        if m_dev > 1.0:
            if r_dev < 1.0:
                return "Active Spenders"
            else:
                return "Slipped Big Spenders"
        else:
            if r_dev < 1.0:
                return "New Occasional"
            else:
                return "Inactive Budget"

    def process_custom_upload(self, file_content_or_path, is_csv=True):
        """Processes a custom uploaded CSV/Excel file, auto-detects and normalizes features."""
        try:
            if is_csv:
                df = pd.read_csv(file_content_or_path)
            else:
                df = pd.read_excel(file_content_or_path)
                
            # Column fuzzy matching / normalization logic
            # We want to identify: Customer ID, Age, Income, Gender, Region, Date, Amount (or RFM directly)
            col_mapping = {}
            for col in df.columns:
                col_lower = str(col).lower().replace(" ", "").replace("_", "")
                
                if "customer" in col_lower or "custid" in col_lower or "id" == col_lower:
                    col_mapping[col] = "Customer_ID"
                elif "age" in col_lower:
                    col_mapping[col] = "Age"
                elif "income" in col_lower or "salary" in col_lower or "earnings" in col_lower:
                    col_mapping[col] = "Annual_Income_INR"
                elif "gender" in col_lower or "sex" in col_lower:
                    col_mapping[col] = "Gender"
                elif "region" in col_lower or "city" in col_lower or "state" in col_lower or "country" in col_lower:
                    col_mapping[col] = "Region"
                elif "date" in col_lower or "time" in col_lower:
                    col_mapping[col] = "Date"
                elif "amount" in col_lower or "spend" in col_lower or "price" in col_lower or "revenue" in col_lower or "total" in col_lower:
                    col_mapping[col] = "Amount_INR"
                elif "recency" in col_lower:
                    col_mapping[col] = "Recency"
                elif "frequency" in col_lower:
                    col_mapping[col] = "Frequency"
                elif "monetary" in col_lower:
                    col_mapping[col] = "Monetary"
                    
            df_norm = df.rename(columns=col_mapping)
            
            # If we already have Recency, Frequency, Monetary in columns, we can skip transaction merging
            has_rfm = all(col in df_norm.columns for col in ["Recency", "Frequency", "Monetary"])
            
            # Ensure Customer_ID exists, if not generate it
            if "Customer_ID" not in df_norm.columns:
                df_norm["Customer_ID"] = [f"CUST_{i:04d}" for i in range(len(df_norm))]
                
            # Fill default values for demographics if missing
            if "Age" not in df_norm.columns:
                df_norm["Age"] = 35 # default
            if "Annual_Income_INR" not in df_norm.columns:
                df_norm["Annual_Income_INR"] = 600000 # default
            if "Gender" not in df_norm.columns:
                df_norm["Gender"] = "Unknown"
            if "Region" not in df_norm.columns:
                df_norm["Region"] = "Unknown"
                
            if has_rfm:
                self.raw_data = df_norm[["Customer_ID", "Age", "Annual_Income_INR", "Gender", "Region", "Recency", "Frequency", "Monetary"]]
            else:
                # If transaction date and amount are present, compute RFM
                if "Date" in df_norm.columns and "Amount_INR" in df_norm.columns:
                    # Clean date column
                    df_norm["Date"] = pd.to_datetime(df_norm["Date"], errors='coerce')
                    ref_date = df_norm["Date"].max() + pd.Timedelta(days=1)
                    
                    rfm = df_norm.groupby("Customer_ID").agg(
                        Recency=("Date", lambda x: (ref_date - x.max()).days if pd.notnull(x.max()) else 30),
                        Frequency=("Customer_ID", "count"),
                        Monetary=("Amount_INR", "sum")
                    ).reset_index()
                    
                    # Merge demographic info (deduplicate since raw upload had one row per transaction)
                    demo = df_norm[["Customer_ID", "Age", "Annual_Income_INR", "Gender", "Region"]].drop_duplicates(subset=["Customer_ID"])
                    self.raw_data = pd.merge(demo, rfm, on="Customer_ID", how="inner")
                else:
                    # If neither RFM nor transaction data exists, let's treat the columns directly
                    # e.g., demographic clustering alone
                    # We will mock RFM fields
                    df_norm["Recency"] = 30
                    df_norm["Frequency"] = 5
                    df_norm["Monetary"] = df_norm.get("Annual_Income_INR", 600000) * 0.05 # assume 5% spend
                    self.raw_data = df_norm[["Customer_ID", "Age", "Annual_Income_INR", "Gender", "Region", "Recency", "Frequency", "Monetary"]]
                    
            return self.raw_data
        except Exception as e:
            raise ValueError(f"Error parsing file schema: {str(e)}")
