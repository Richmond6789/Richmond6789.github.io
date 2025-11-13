/**
 * Chart visualization for Apple Health data
 * Uses Chart.js for rendering
 */

class HealthDataChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.currentType = 'line';
    }

    /**
     * Create or update chart with data
     * @param {Array} data - Aggregated data to display
     * @param {string} label - Chart label
     * @param {string} unit - Data unit
     * @param {string} chartType - Chart type (line, bar)
     */
    render(data, label = 'Dữ liệu sức khỏe', unit = '', chartType = 'line') {
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        if (!data || data.length === 0) {
            this.renderEmpty();
            return;
        }

        // Prepare data
        const labels = data.map(item => this.formatDateLabel(item.date));
        const values = data.map(item => item.avg);

        // Determine chart color based on data type
        const color = this.getColorForDataType(label);

        // Create chart
        this.chart = new Chart(this.canvas, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: `${label} ${unit ? `(${unit})` : ''}`,
                    data: values,
                    backgroundColor: this.hexToRgba(color, 0.2),
                    borderColor: color,
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        borderColor: color,
                        borderWidth: 1,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                const dataPoint = data[context.dataIndex];
                                return [
                                    `Trung bình: ${this.formatValue(value, unit)}`,
                                    `Tổng: ${this.formatValue(dataPoint.sum, unit)}`,
                                    `Số lượng: ${dataPoint.count}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: 12
                            },
                            callback: (value) => this.formatValue(value, unit)
                        }
                    }
                }
            }
        });

        this.currentType = chartType;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(this.canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Format date label for chart
     * @param {string} dateStr - Date string
     * @returns {string} Formatted date
     */
    formatDateLabel(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // If date is YYYY-MM-DD format
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return `${date.getDate()}/${date.getMonth() + 1}`;
        }

        // If date is YYYY-MM format (month)
        if (dateStr.match(/^\d{4}-\d{2}$/)) {
            return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
        }

        // If date is YYYY format (year)
        if (dateStr.match(/^\d{4}$/)) {
            return `Năm ${dateStr}`;
        }

        return dateStr;
    }

    /**
     * Format value with unit
     * @param {number} value - Value to format
     * @param {string} unit - Unit string
     * @returns {string} Formatted value
     */
    formatValue(value, unit) {
        if (value === null || value === undefined) return '-';

        let formatted;
        if (value >= 1000000) {
            formatted = (value / 1000000).toFixed(2) + 'M';
        } else if (value >= 1000) {
            formatted = (value / 1000).toFixed(2) + 'K';
        } else if (value < 1 && value > 0) {
            formatted = value.toFixed(3);
        } else {
            formatted = value.toFixed(2);
        }

        return unit ? `${formatted} ${unit}` : formatted;
    }

    /**
     * Get color for data type
     * @param {string} dataType - Data type label
     * @returns {string} Hex color
     */
    getColorForDataType(dataType) {
        const colors = {
            'Số bước chân': '#007AFF',
            'Nhịp tim': '#FF3B30',
            'Quãng đường': '#34C759',
            'Năng lượng': '#FF9500',
            'Cân nặng': '#5856D6',
            'Giấc ngủ': '#AF52DE',
            'VO2 Max': '#FF2D55',
            'Huyết áp': '#FF3B30',
            'Oxy': '#5AC8FA',
            'default': '#007AFF'
        };

        for (const [key, color] of Object.entries(colors)) {
            if (dataType.includes(key)) {
                return color;
            }
        }

        return colors.default;
    }

    /**
     * Convert hex to rgba
     * @param {string} hex - Hex color
     * @param {number} alpha - Alpha value
     * @returns {string} RGBA string
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Change chart type
     * @param {string} type - Chart type (line, bar)
     */
    changeType(type) {
        if (this.chart) {
            this.chart.config.type = type;
            this.chart.update();
            this.currentType = type;
        }
    }

    /**
     * Destroy chart
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}
