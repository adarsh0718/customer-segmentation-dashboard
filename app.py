from flask import Flask, render_template, jsonify, request, send_file
import pandas as pd
import numpy as np
import io
import os
from clustering_engine import ClusteringEngine

app = Flask(__name__)
engine = ClusteringEngine()

# Keep track of the active dataset in memory
active_df = None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/run-clustering", methods=["POST"])
def run_clustering():
    global active_df
    try:
        data = request.json or {}
        n_clusters = int(data.get("n_clusters", 4))
        selected_features = data.get("features", ["Recency", "Frequency", "Monetary", "Age", "Annual_Income_INR"])
        
        # Load data if not already done
        if engine.raw_data is None:
            engine.load_default_data()
            
        df, sil_score, summaries = engine.run_clustering(
            n_clusters=n_clusters, 
            selected_features=selected_features
        )
        active_df = df.copy()
        
        # Return summary stats + customer data for plotting
        customers_json = df.to_dict(orient="records")
        
        # Handle nan values for JSON conversion
        for cust in customers_json:
            for k, v in cust.items():
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    cust[k] = None
                    
        return jsonify({
            "status": "success",
            "silhouette_score": sil_score,
            "cluster_summaries": summaries,
            "customers": customers_json,
            "features_used": selected_features
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/upload", methods=["POST"])
def upload_file():
    try:
        if "file" not in request.files:
            return jsonify({"status": "error", "message": "No file uploaded"}), 400
            
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"status": "error", "message": "Empty filename"}), 400
            
        filename = file.filename.lower()
        is_csv = filename.endswith(".csv")
        is_excel = filename.endswith(".xlsx") or filename.endswith(".xls")
        
        if not (is_csv or is_excel):
            return jsonify({"status": "error", "message": "Unsupported file format. Please upload CSV or Excel."}), 400
            
        # Parse custom upload
        file_bytes = io.BytesIO(file.read())
        engine.process_custom_upload(file_bytes, is_csv=is_csv)
        
        # Run default clustering on the new dataset
        df, sil_score, summaries = engine.run_clustering(n_clusters=4)
        
        customers_json = df.to_dict(orient="records")
        for cust in customers_json:
            for k, v in cust.items():
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    cust[k] = None
                    
        return jsonify({
            "status": "success",
            "silhouette_score": sil_score,
            "cluster_summaries": summaries,
            "customers": customers_json,
            "features_used": ["Recency", "Frequency", "Monetary", "Age", "Annual_Income_INR"]
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/reset", methods=["POST"])
def reset_data():
    try:
        engine.raw_data = None
        engine.load_default_data()
        df, sil_score, summaries = engine.run_clustering(n_clusters=4)
        
        customers_json = df.to_dict(orient="records")
        for cust in customers_json:
            for k, v in cust.items():
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    cust[k] = None
                    
        return jsonify({
            "status": "success",
            "silhouette_score": sil_score,
            "cluster_summaries": summaries,
            "customers": customers_json,
            "features_used": ["Recency", "Frequency", "Monetary", "Age", "Annual_Income_INR"]
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/export", methods=["GET"])
def export_data():
    global active_df
    try:
        if active_df is None:
            # Generate default if not run yet
            if engine.raw_data is None:
                engine.load_default_data()
            active_df, _, _ = engine.run_clustering()
            
        # Generate CSV in memory
        output = io.StringIO()
        active_df.to_csv(output, index=False)
        output.seek(0)
        
        # Create bytes stream
        mem = io.BytesIO()
        mem.write(output.getvalue().encode("utf-8"))
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype="text/csv",
            as_attachment=True,
            download_name="segmented_customers.csv"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True, port=5000)
