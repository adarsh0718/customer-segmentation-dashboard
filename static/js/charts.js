// Charts Module to handle ApexCharts rendering and updates

const clusterColors = [
    '#6366f1', // 0: Indigo
    '#ec4899', // 1: Pink
    '#10b981', // 2: Emerald
    '#f59e0b', // 3: Orange
    '#06b6d4', // 4: Cyan
    '#a855f7', // 5: Purple
    '#3b82f6', // 6: Blue
    '#ef4444'  // 7: Red
];

let scatterChart = null;
let comparisonChart = null;
let demographicChart = null;

/**
 * Initializes empty chart containers on page load
 */
export function initCharts() {
    // 1. Initialize Scatter Plot
    const scatterOptions = {
        series: [],
        chart: {
            height: 380,
            type: 'scatter',
            zoom: {
                enabled: true,
                type: 'xy'
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            },
            toolbar: {
                show: false
            },
            foreColor: '#9ca3af',
            background: 'transparent'
        },
        colors: clusterColors,
        xaxis: {
            tickAmount: 10,
            labels: {
                formatter: function(val) {
                    return parseFloat(val).toFixed(1);
                }
            },
            title: {
                text: 'Principal Component 1 (PCA_1)'
            }
        },
        yaxis: {
            tickAmount: 7,
            title: {
                text: 'Principal Component 2 (PCA_2)'
            }
        },
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.05)',
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            }
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'center',
            labels: {
                colors: '#f3f4f6'
            }
        },
        tooltip: {
            theme: 'dark',
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
                const cust = dataPoint.customerInfo;
                
                return `
                    <div style="padding: 12px; background: #0c0a18; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;">
                        <div style="font-weight: 700; color: ${clusterColors[cust.Cluster % 8]}; margin-bottom: 6px;">
                            ${cust.Customer_ID} (${cust.profile_name || 'Segment ' + cust.Cluster})
                        </div>
                        <div style="font-size: 12px; color: #d1d5db; display: flex; flex-direction: column; gap: 3px;">
                            <span>Age: <b>${cust.Age}</b></span>
                            <span>Annual Income: <b>₹${cust.Annual_Income_INR.toLocaleString('en-IN')}</b></span>
                            <span>Monetary (Spend): <b>₹${cust.Monetary.toLocaleString('en-IN')}</b></span>
                            <span>Frequency: <b>${cust.Frequency} orders</b></span>
                            <span>Recency: <b>${cust.Recency} days</b></span>
                            <span>Region: <b>${cust.Region}</b> | Gender: <b>${cust.Gender}</b></span>
                        </div>
                    </div>
                `;
            }
        }
    };
    scatterChart = new ApexCharts(document.querySelector("#scatter-chart"), scatterOptions);
    scatterChart.render();

    // 2. Initialize Comparison Radar Chart
    const comparisonOptions = {
        series: [],
        chart: {
            height: 300,
            type: 'radar',
            dropShadow: {
                enabled: true,
                blur: 1,
                left: 1,
                top: 1
            },
            foreColor: '#9ca3af',
            background: 'transparent',
            toolbar: {
                show: false
            }
        },
        colors: clusterColors,
        stroke: {
            width: 2
        },
        fill: {
            opacity: 0.2
        },
        markers: {
            size: 4
        },
        xaxis: {
            categories: ['Spend (M)', 'Frequency (F)', 'Recency (R)', 'Age', 'Income']
        },
        yaxis: {
            show: false
        },
        legend: {
            show: false // will be represented in profile cards and scatter legend
        },
        tooltip: {
            theme: 'dark'
        }
    };
    comparisonChart = new ApexCharts(document.querySelector("#comparison-chart"), comparisonOptions);
    comparisonChart.render();

    // 3. Initialize Demographic Stacked Column Chart
    const demographicOptions = {
        series: [],
        chart: {
            type: 'bar',
            height: 300,
            stacked: true,
            foreColor: '#9ca3af',
            background: 'transparent',
            toolbar: {
                show: false
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '60%'
            }
        },
        colors: ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'], // regional hues
        stroke: {
            width: 1,
            colors: ['#06050c']
        },
        xaxis: {
            categories: [], // clusters
            title: {
                text: 'Regional Distribution (%)'
            },
            max: 100
        },
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.05)'
        },
        fill: {
            opacity: 0.85
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            labels: {
                colors: '#f3f4f6'
            }
        },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: function(val) {
                    return val + "%";
                }
            }
        }
    };
    demographicChart = new ApexCharts(document.querySelector("#demographic-chart"), demographicOptions);
    demographicChart.render();
}

/**
 * Updates all charts with new clustering output
 * @param {Array} customers List of customer records
 * @param {Array} summaries Cluster definitions & profiles
 */
export function updateCharts(customers, summaries) {
    // 1. Update Scatter Plot series
    const scatterSeries = summaries.map(sum => {
        const clusterId = sum.cluster_id;
        const profileName = sum.profile_name;
        
        const clusterPoints = customers
            .filter(c => c.Cluster === clusterId)
            .map(c => ({
                x: c.PCA_1,
                y: c.PCA_2,
                customerInfo: { ...c, profile_name: profileName }
            }));
            
        return {
            name: profileName,
            data: clusterPoints
        };
    });
    scatterChart.updateSeries(scatterSeries);

    // 2. Update Comparison Chart
    // To make a radar chart readable across different units (Spend in thousands, Frequency in units),
    // we will normalize values relative to the maximum across all clusters for that attribute (0% to 100% score)
    const maxVals = {
        Monetary: Math.max(...summaries.map(s => s.averages.Monetary || 1)),
        Frequency: Math.max(...summaries.map(s => s.averages.Frequency || 1)),
        Recency: Math.max(...summaries.map(s => s.averages.Recency || 1)),
        Age: Math.max(...summaries.map(s => s.averages.Age || 1)),
        Annual_Income_INR: Math.max(...summaries.map(s => s.averages.Annual_Income_INR || 1))
    };

    const radarSeries = summaries.map(sum => {
        const normSpend = ((sum.averages.Monetary || 0) / maxVals.Monetary) * 100;
        const normFreq = ((sum.averages.Frequency || 0) / maxVals.Frequency) * 100;
        
        // Recency is negative logic (smaller is better/more active), so we invert it for radar display
        const minRecency = Math.min(...summaries.map(s => s.averages.Recency || 0));
        const normRec = maxVals.Recency === minRecency ? 100 : (1 - ((sum.averages.Recency - minRecency) / (maxVals.Recency - minRecency))) * 100;
        
        const normAge = ((sum.averages.Age || 0) / maxVals.Age) * 100;
        const normInc = ((sum.averages.Annual_Income_INR || 0) / maxVals.Annual_Income_INR) * 100;
        
        return {
            name: sum.profile_name,
            data: [
                Math.round(normSpend),
                Math.round(normFreq),
                Math.round(normRec),
                Math.round(normAge),
                Math.round(normInc)
            ]
        };
    });
    comparisonChart.updateSeries(radarSeries);

    // 3. Update Demographic Horizontal Stacked Bar (Regions per Cluster)
    const regions = ['North', 'South', 'East', 'West'];
    const barSeries = regions.map(region => {
        const data = summaries.map(sum => {
            return sum.region_dist[region] || 0;
        });
        return {
            name: region,
            data: data
        };
    });
    
    const categories = summaries.map(sum => sum.profile_name);
    
    demographicChart.updateOptions({
        xaxis: {
            categories: categories
        }
    });
    demographicChart.updateSeries(barSeries);
}
