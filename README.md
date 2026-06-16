# 📊 Customer Segmentation & Analytics Dashboard

<div align="center">

![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=for-the-badge&logo=flask&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.5%2B-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![ApexCharts](https://img.shields.io/badge/ApexCharts-00B4D8?style=for-the-badge&logo=chart.js&logoColor=white)

**An interactive machine learning application that segments customers based on purchase behavior and demographics using K-Means clustering.**  
Includes a gorgeous glassmorphic dark-theme analytics frontend.

[📂 View Code](https://github.com/adarsh0718/customer-segmentation-dashboard)

</div>

---

## 🎬 Overview

This project implements an end-to-end **Customer Segmentation and Analytics** tool. It takes transactional and demographic data, conducts **RFM (Recency, Frequency, Monetary)** scoring, scales features, and applies **K-Means Clustering** using `scikit-learn` to group customers. 

To visualize high-dimensional behavior (5+ features), the application reduces features using **PCA (Principal Component Analysis)** to map customers on an interactive 2D scatter plot.

---

## ✨ Features

### 🧠 Machine Learning Engine
- **RFM Processing**: Automatically computes Recency (days since last purchase), Frequency (number of orders), and Monetary value (total spend).
- **Dynamic K-Means**: Adjust clusters ($K = 2 \text{ to } 8$) dynamically on the UI, and re-run clustering instantly.
- **PCA Dimensionality Reduction**: Projects customer data coordinates onto a 2D plane for geographic layout.
- **Automatic Archetype Profiling**: Categorizes clusters into business profiles (e.g., *"VIP Champions"*, *"Loyal Spenders"*, *"At-Risk"*, *"Young Explorers"*).
- **Silhouette Validation**: Computes and displays the silhouette score to check clustering density and separation.

### 🎨 Premium UI/UX (Glassmorphism)
- **Interactive Scatter Map**: Highlight customer groups, view custom rich tooltips showing details (Age, Income, Total Spend, assigned cluster) on hover.
- **Radar Profile Comparison**: Visualizes segment behavior scores relative to maximum values.
- **Region & Gender Distribution**: Interactive stacked bar charts showing regional segment demographics.
- **Paginated customer directory**: Search, sort, and browse segmented customer logs.
- **Drag-and-Drop Ingestion**: Upload custom CSV/Excel transaction or demographic files to cluster them instantly.
- **CSV Data Export**: Download the fully tagged customer database as a CSV file.

---

## 📂 Project Structure

```
customer-segmentation-dashboard/
│
├── app.py                      # Flask Server (Endpoints: /run-clustering, /upload, /export)
├── clustering_engine.py        # ML Pipeline (Preprocessing, RFM, KMeans, PCA, Profiling)
├── requirements.txt            # Python dependencies
│
├── data/
│   ├── customer_demographics.csv  # Sample customer demographic details
│   ├── customer_transactions.csv  # Sample transaction logs
│   └── generate_data.py           # Programmatic dataset generator
│
├── templates/
│   └── index.html              # Main dashboard frontend structure
│
└── static/
    ├── css/
    │   └── styles.css          # Glassmorphic custom styling
    └── js/
        ├── app.js              # Orchestrator & UI event binding
        ├── charts.js           # ApexCharts setups (Scatter, Radar, Bars)
        └── tables.js           # Directory table sorting & paging
```

---

## 📋 Custom Data Ingestion Format

To upload your own data, ensure your file contains the following columns (names are auto-detected using fuzzy matching):

| Demographic Fields | Behavioral Fields |
|--------------------|-------------------|
| `Customer_ID`      | `Date` (DD-MM-YYYY) |
| `Age`              | `Amount_INR` (Purchase amount) |
| `Annual_Income_INR`| `Product_Category` (Optional) |
| `Gender`           |                   |
| `Region`           |                   |

---

## 🚀 Local Installation

### 1. Clone the repository
```bash
git clone https://github.com/adarsh0718/customer-segmentation-dashboard.git
cd customer-segmentation-dashboard
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the application
```bash
python app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser!

---

## 👨‍💻 Author

**Adarsh Peddada**  
Electronics and Computer Engineering Student  
Passionate about Machine Learning, Data Analytics & Web Development.

[![GitHub](https://img.shields.io/badge/GitHub-adarsh0718-181717?style=flat-square&logo=github)](https://github.com/adarsh0718)
