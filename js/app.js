/**
 * Apple Health Data Analyzer - Main Application
 */

class HealthDataApp {
    constructor() {
        // Initialize parser and chart
        this.parser = new HealthDataParser();
        this.chart = new HealthDataChart('dataChart');

        // Current state
        this.currentDataType = null;
        this.currentPeriod = 'week';
        this.currentDateRange = null;
        this.filteredData = [];
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.searchTerm = '';
        this.sortBy = 'date-desc';

        // Date picker instance
        this.datePicker = null;

        // Initialize UI
        this.initializeUI();
        this.attachEventListeners();
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Initialize flatpickr date picker
        this.datePicker = flatpickr('#datePicker', {
            dateFormat: 'd/m/Y',
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) {
                    this.handleDateSelect(selectedDates[0]);
                }
            }
        });

        // Set initial date range to last 7 days
        this.setDateRange('week');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // Click to upload
        selectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        uploadArea.addEventListener('click', (e) => {
            if (e.target === uploadArea || e.target.closest('.upload-icon, h2, p:not(.upload-hint)')) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Data type selection
        document.getElementById('dataTypeSelect').addEventListener('change', (e) => {
            this.currentDataType = e.target.value;
            this.updateView();
        });

        // Period buttons
        document.querySelectorAll('[data-range]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.dataset.range;
                this.currentPeriod = range;

                // Update active state
                document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.setDateRange(range);
                this.updateView();
            });
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetFilters();
        });

        // New file button
        document.getElementById('newFileBtn').addEventListener('click', () => {
            this.resetApp();
        });

        // Table search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.renderTable();
        });

        // Table sort
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderTable();
        });
    }

    /**
     * Handle file upload
     * @param {File} file - Uploaded file
     */
    async handleFileUpload(file) {
        const isZip = file.name.toLowerCase().endsWith('.zip');
        const isXml = file.name.toLowerCase().endsWith('.xml');

        if (!isZip && !isXml) {
            alert('Vui lòng chọn file ZIP hoặc XML được xuất từ Apple Health!');
            return;
        }

        try {
            console.log(`Đang xử lý file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            // Show progress
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('progressContainer').style.display = 'block';

            let exportXML = null;

            if (isXml) {
                // Handle XML file directly
                this.updateProgress(5, 'Đang đọc file XML...');
                exportXML = await this.readFileAsText(file);
                console.log(`Đã đọc XML: ${(exportXML.length / 1024 / 1024).toFixed(2)} MB`);
            } else {
                // Handle ZIP file
                this.updateProgress(5, 'Đang đọc file ZIP...');
                const zipData = await this.readFileAsArrayBuffer(file);

                this.updateProgress(10, 'Đang giải nén file...');
                const zip = await JSZip.loadAsync(zipData);

                console.log('Files trong ZIP:', Object.keys(zip.files));

                // Find export.xml - try multiple possible paths
                const possiblePaths = [
                    'apple_health_export/export.xml',
                    'export.xml',
                    'Export.xml',
                    'apple_health_export/Export.xml'
                ];

                let exportFile = null;
                for (const path of possiblePaths) {
                    exportFile = zip.file(path);
                    if (exportFile) {
                        console.log(`Tìm thấy export.xml tại: ${path}`);
                        break;
                    }
                }

                if (exportFile) {
                    this.updateProgress(20, 'Đang đọc dữ liệu XML...');
                    exportXML = await exportFile.async('string');
                    console.log(`Đã giải nén XML: ${(exportXML.length / 1024 / 1024).toFixed(2)} MB`);
                } else {
                    // List all files in ZIP for debugging
                    const fileList = Object.keys(zip.files).join(', ');
                    throw new Error(`Không tìm thấy file export.xml trong ZIP. Files có sẵn: ${fileList}`);
                }
            }

            // Validate XML content
            if (!exportXML || exportXML.trim().length === 0) {
                throw new Error('File XML trống hoặc không hợp lệ');
            }

            if (!exportXML.includes('<HealthData') && !exportXML.includes('<healthdata')) {
                throw new Error('File không phải là dữ liệu Apple Health hợp lệ');
            }

            console.log('Bắt đầu phân tích XML...');

            // Parse XML
            await this.parser.parseXML(exportXML, (progress, message) => {
                this.updateProgress(progress, message);
            });

            console.log(`Phân tích hoàn tất: ${this.parser.rawData.length} bản ghi`);

            // Check if we have data
            if (this.parser.rawData.length === 0) {
                throw new Error('Không tìm thấy dữ liệu trong file. Vui lòng kiểm tra lại file export.');
            }

            // Initialize data view
            this.initializeDataView();

            // Hide progress, show main content
            document.getElementById('progressContainer').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';

            console.log('Tải dữ liệu thành công!');
        } catch (error) {
            console.error('Lỗi xử lý file:', error);
            console.error('Stack trace:', error.stack);

            let errorMessage = error.message;
            if (error.message.includes('Cannot read properties')) {
                errorMessage = 'Lỗi đọc file. Vui lòng đảm bảo file là export.xml hợp lệ từ Apple Health.';
            }

            alert(`Lỗi: ${errorMessage}\n\nVui lòng kiểm tra console (F12) để xem chi tiết.`);
            document.getElementById('progressContainer').style.display = 'none';
            document.getElementById('uploadSection').style.display = 'block';
        }
    }

    /**
     * Read file as ArrayBuffer
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>}
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Không thể đọc file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Read file as Text
     * @param {File} file - File to read
     * @returns {Promise<string>}
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Không thể đọc file'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * Update progress bar
     * @param {number} percent - Progress percentage
     * @param {string} message - Progress message
     */
    updateProgress(percent, message) {
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = message;
    }

    /**
     * Initialize data view after parsing
     */
    initializeDataView() {
        console.log('Initializing data view...');

        // Populate data type selector
        const dataTypes = this.parser.getDataTypes();
        console.log(`Found ${dataTypes.length} data types`);

        if (dataTypes.length === 0) {
            console.error('No data types found!');
            alert('Không tìm thấy loại dữ liệu nào. Vui lòng kiểm tra file XML.');
            return;
        }

        const select = document.getElementById('dataTypeSelect');

        select.innerHTML = '<option value="">-- Chọn loại dữ liệu --</option>';

        dataTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = this.parser.getFriendlyName(type);
            select.appendChild(option);
        });

        console.log(`Added ${dataTypes.length} options to select`);

        // Select first data type
        if (dataTypes.length > 0) {
            this.currentDataType = dataTypes[0];
            select.value = dataTypes[0];
            console.log(`Selected default data type: ${this.currentDataType}`);
        }

        // Update view
        console.log('Updating view...');
        this.updateView();
    }

    /**
     * Set date range based on period
     * @param {string} period - Period type (day, week, month, year)
     */
    setDateRange(period) {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        let start;

        switch (period) {
            case 'day':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                break;
            case 'week':
                start = new Date(now);
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                start = new Date(now);
                start.setMonth(now.getMonth() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'year':
                start = new Date(now);
                start.setFullYear(now.getFullYear() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                start = new Date(now);
                start.setDate(now.getDate() - 7);
        }

        this.currentDateRange = { start, end };
    }

    /**
     * Handle date selection from date picker
     * @param {Date} date - Selected date
     */
    handleDateSelect(date) {
        const period = this.currentPeriod;
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        let start = new Date(date);

        switch (period) {
            case 'day':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                start.setDate(date.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                start.setMonth(date.getMonth() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'year':
                start.setFullYear(date.getFullYear() - 1);
                start.setHours(0, 0, 0, 0);
                break;
        }

        this.currentDateRange = { start, end };
        this.updateView();
    }

    /**
     * Update view with current filters
     */
    updateView() {
        console.log('updateView called, currentDataType:', this.currentDataType, 'currentDateRange:', this.currentDateRange);

        if (!this.currentDataType || !this.currentDateRange) {
            console.warn('Missing currentDataType or currentDateRange, skipping view update');
            return;
        }

        // Filter data
        this.filteredData = this.parser.filterData(
            this.currentDataType,
            this.currentDateRange.start,
            this.currentDateRange.end
        );

        console.log(`Filtered data: ${this.filteredData.length} records for date range ${this.currentDateRange.start.toLocaleDateString()} - ${this.currentDateRange.end.toLocaleDateString()}`);

        // Update statistics
        this.updateStatistics();

        // Update chart
        this.updateChart();

        // Update table
        this.currentPage = 1;
        this.renderTable();

        console.log('View update completed');
    }

    /**
     * Update statistics cards
     */
    updateStatistics() {
        const stats = this.parser.getStatistics(this.filteredData);

        document.getElementById('totalRecords').textContent = stats.count.toLocaleString();
        document.getElementById('avgValue').textContent = stats.avg > 0 ?
            `${stats.avg.toFixed(2)} ${stats.unit}` : '-';
        document.getElementById('maxValue').textContent = stats.max > 0 ?
            `${stats.max.toFixed(2)} ${stats.unit}` : '-';
        document.getElementById('minValue').textContent = stats.min > 0 ?
            `${stats.min.toFixed(2)} ${stats.unit}` : '-';
    }

    /**
     * Update chart with aggregated data
     */
    updateChart() {
        const aggregated = this.parser.aggregateByPeriod(this.filteredData, this.currentPeriod);
        const label = this.parser.getFriendlyName(this.currentDataType);
        const unit = this.filteredData[0]?.unit || '';

        this.chart.render(aggregated, label, unit, 'line');
    }

    /**
     * Render data table
     */
    renderTable() {
        let data = [...this.filteredData];

        // Apply search filter
        if (this.searchTerm) {
            data = data.filter(record => {
                const searchStr = `${record.value} ${record.unit} ${record.sourceName}`.toLowerCase();
                return searchStr.includes(this.searchTerm);
            });
        }

        // Apply sorting
        data.sort((a, b) => {
            switch (this.sortBy) {
                case 'date-desc':
                    return b.startDate - a.startDate;
                case 'date-asc':
                    return a.startDate - b.startDate;
                case 'value-desc':
                    return (b.value || 0) - (a.value || 0);
                case 'value-asc':
                    return (a.value || 0) - (b.value || 0);
                default:
                    return 0;
            }
        });

        // Pagination
        const totalPages = Math.ceil(data.length / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = data.slice(start, end);

        // Render table rows
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Không có dữ liệu</td></tr>';
        } else {
            pageData.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${this.formatDateTime(record.startDate)}</td>
                    <td>${record.value !== null ? record.value.toFixed(2) : '-'}</td>
                    <td>${record.unit}</td>
                    <td>${record.sourceName}</td>
                `;
                tbody.appendChild(row);
            });
        }

        // Render pagination
        this.renderPagination(totalPages);
    }

    /**
     * Render pagination controls
     * @param {number} totalPages - Total number of pages
     */
    renderPagination(totalPages) {
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        if (totalPages <= 1) return;

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Trước';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTable();
            }
        });
        pagination.appendChild(prevBtn);

        // Page numbers
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.toggle('active', i === this.currentPage);
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.renderTable();
            });
            pagination.appendChild(pageBtn);
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Tiếp →';
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderTable();
            }
        });
        pagination.appendChild(nextBtn);
    }

    /**
     * Format date and time
     * @param {Date} date - Date object
     * @returns {string} Formatted date time
     */
    formatDateTime(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    /**
     * Reset filters
     */
    resetFilters() {
        this.currentPeriod = 'week';
        this.setDateRange('week');
        this.datePicker.clear();

        document.querySelectorAll('[data-range]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === 'week');
        });

        this.updateView();
    }

    /**
     * Reset entire app
     */
    resetApp() {
        // Clear data
        this.parser = new HealthDataParser();
        this.currentDataType = null;
        this.filteredData = [];

        // Reset UI
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('fileInput').value = '';

        // Reset filters
        this.resetFilters();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.healthApp = new HealthDataApp();
    console.log('Apple Health Data Analyzer initialized!');
});
