/**
 * Apple Health XML Parser
 * Handles parsing of large XML files exported from Apple Health
 */

class HealthDataParser {
    constructor() {
        this.rawData = [];
        this.dataTypes = new Set();
        this.progressCallback = null;
    }

    /**
     * Parse XML content from export.xml
     * @param {string} xmlContent - XML content as string
     * @param {function} progressCallback - Callback for progress updates
     * @returns {Promise<Array>} Parsed health records
     */
    async parseXML(xmlContent, progressCallback = null) {
        this.progressCallback = progressCallback;
        this.rawData = [];
        this.dataTypes = new Set();

        try {
            console.log('Bắt đầu parseXML, kích thước:', (xmlContent.length / 1024 / 1024).toFixed(2), 'MB');

            if (progressCallback) progressCallback(10, 'Đang phân tích cú pháp XML...');

            // For large files, we'll use DOMParser with chunking approach
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.error('Parser error:', parserError.textContent);
                throw new Error('Lỗi phân tích XML: ' + parserError.textContent);
            }

            console.log('XML parsed thành công');

            // Check root element
            const rootElement = xmlDoc.documentElement;
            console.log('Root element:', rootElement.tagName);

            if (progressCallback) progressCallback(30, 'Đang trích xuất dữ liệu...');

            // Extract all Record elements
            const records = xmlDoc.querySelectorAll('Record');
            const totalRecords = records.length;

            console.log(`Tìm thấy ${totalRecords} bản ghi Record`);

            // Process records in batches to avoid blocking UI
            const batchSize = 1000;
            let processed = 0;

            for (let i = 0; i < totalRecords; i += batchSize) {
                const batch = Array.from(records).slice(i, Math.min(i + batchSize, totalRecords));

                batch.forEach(record => {
                    const dataType = record.getAttribute('type');
                    const value = record.getAttribute('value');
                    const unit = record.getAttribute('unit');
                    const startDate = record.getAttribute('startDate');
                    const endDate = record.getAttribute('endDate');
                    const sourceName = record.getAttribute('sourceName');
                    const sourceVersion = record.getAttribute('sourceVersion');
                    const device = record.getAttribute('device');

                    // Only add records with valid data
                    if (dataType && startDate) {
                        this.rawData.push({
                            type: dataType,
                            value: value ? parseFloat(value) : null,
                            unit: unit || '',
                            startDate: new Date(startDate),
                            endDate: endDate ? new Date(endDate) : new Date(startDate),
                            sourceName: sourceName || 'Unknown',
                            sourceVersion: sourceVersion || '',
                            device: device || ''
                        });

                        this.dataTypes.add(dataType);
                    }
                });

                processed += batch.length;

                // Update progress
                if (progressCallback) {
                    const progress = 30 + (processed / totalRecords * 60);
                    progressCallback(progress, `Đã xử lý ${processed.toLocaleString()} / ${totalRecords.toLocaleString()} bản ghi...`);
                }

                // Allow UI to update
                await this.sleep(0);
            }

            // Also parse Workout data if present
            const workouts = xmlDoc.querySelectorAll('Workout');
            if (workouts.length > 0) {
                console.log(`Tìm thấy ${workouts.length} workouts`);
                this.parseWorkouts(workouts);
            }

            if (progressCallback) progressCallback(95, 'Đang hoàn thiện...');

            // Sort data by date
            this.rawData.sort((a, b) => b.startDate - a.startDate);

            console.log(`Phân tích hoàn tất: ${this.rawData.length} bản ghi, ${this.dataTypes.size} loại dữ liệu`);
            console.log('Các loại dữ liệu:', Array.from(this.dataTypes).slice(0, 10).join(', '), '...');

            if (progressCallback) progressCallback(100, 'Hoàn tất!');

            return this.rawData;
        } catch (error) {
            console.error('Lỗi phân tích XML:', error);
            throw new Error(`Không thể phân tích file XML: ${error.message}`);
        }
    }

    /**
     * Parse workout data
     * @param {NodeList} workouts - Workout elements
     */
    parseWorkouts(workouts) {
        workouts.forEach(workout => {
            const workoutType = workout.getAttribute('workoutActivityType');
            const duration = workout.getAttribute('duration');
            const durationUnit = workout.getAttribute('durationUnit');
            const totalDistance = workout.getAttribute('totalDistance');
            const totalDistanceUnit = workout.getAttribute('totalDistanceUnit');
            const totalEnergyBurned = workout.getAttribute('totalEnergyBurned');
            const totalEnergyBurnedUnit = workout.getAttribute('totalEnergyBurnedUnit');
            const startDate = workout.getAttribute('startDate');
            const endDate = workout.getAttribute('endDate');
            const sourceName = workout.getAttribute('sourceName');

            if (workoutType && startDate) {
                // Add workout as a special data type
                this.rawData.push({
                    type: `Workout_${workoutType}`,
                    value: parseFloat(duration) || 0,
                    unit: durationUnit || 'min',
                    startDate: new Date(startDate),
                    endDate: endDate ? new Date(endDate) : new Date(startDate),
                    sourceName: sourceName || 'Workout',
                    sourceVersion: '',
                    device: '',
                    metadata: {
                        totalDistance: totalDistance,
                        totalDistanceUnit: totalDistanceUnit,
                        totalEnergyBurned: totalEnergyBurned,
                        totalEnergyBurnedUnit: totalEnergyBurnedUnit
                    }
                });

                this.dataTypes.add(`Workout_${workoutType}`);
            }
        });
    }

    /**
     * Get all unique data types
     * @returns {Array} Array of data type strings
     */
    getDataTypes() {
        return Array.from(this.dataTypes).sort();
    }

    /**
     * Get friendly name for data type
     * @param {string} type - Data type identifier
     * @returns {string} Friendly name
     */
    getFriendlyName(type) {
        // Remove HKQuantityTypeIdentifier, HKCategoryTypeIdentifier prefixes
        const friendlyNames = {
            'HKQuantityTypeIdentifierStepCount': 'Số bước chân',
            'HKQuantityTypeIdentifierDistanceWalkingRunning': 'Quãng đường đi bộ/chạy',
            'HKQuantityTypeIdentifierHeartRate': 'Nhịp tim',
            'HKQuantityTypeIdentifierActiveEnergyBurned': 'Năng lượng tiêu hao',
            'HKQuantityTypeIdentifierBasalEnergyBurned': 'Năng lượng cơ bản',
            'HKQuantityTypeIdentifierFlightsClimbed': 'Số tầng leo',
            'HKQuantityTypeIdentifierBodyMass': 'Cân nặng',
            'HKQuantityTypeIdentifierHeight': 'Chiều cao',
            'HKQuantityTypeIdentifierBodyMassIndex': 'BMI',
            'HKQuantityTypeIdentifierBodyFatPercentage': 'Tỷ lệ mỡ',
            'HKQuantityTypeIdentifierOxygenSaturation': 'Nồng độ oxy',
            'HKQuantityTypeIdentifierBloodPressureSystolic': 'Huyết áp tâm thu',
            'HKQuantityTypeIdentifierBloodPressureDiastolic': 'Huyết áp tâm trương',
            'HKQuantityTypeIdentifierRespiratoryRate': 'Nhịp thở',
            'HKQuantityTypeIdentifierVO2Max': 'VO2 Max',
            'HKQuantityTypeIdentifierRestingHeartRate': 'Nhịp tim lúc nghỉ',
            'HKQuantityTypeIdentifierWalkingHeartRateAverage': 'Nhịp tim khi đi bộ',
            'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'Biến thiên nhịp tim (SDNN)',
            'HKCategoryTypeIdentifierSleepAnalysis': 'Phân tích giấc ngủ',
            'HKCategoryTypeIdentifierMindfulSession': 'Thiền định',
            'HKQuantityTypeIdentifierDietaryEnergyConsumed': 'Năng lượng nạp vào',
            'HKQuantityTypeIdentifierDietaryWater': 'Lượng nước',
            'HKQuantityTypeIdentifierDietaryCaffeine': 'Caffeine',
            'HKQuantityTypeIdentifierAppleExerciseTime': 'Thời gian tập luyện',
            'HKQuantityTypeIdentifierAppleStandTime': 'Thời gian đứng',
            'HKQuantityTypeIdentifierEnvironmentalAudioExposure': 'Tiếp xúc âm thanh môi trường',
            'HKQuantityTypeIdentifierHeadphoneAudioExposure': 'Tiếp xúc âm thanh tai nghe'
        };

        if (type.startsWith('Workout_')) {
            const workoutType = type.replace('Workout_', '');
            return `Tập luyện: ${this.getWorkoutTypeName(workoutType)}`;
        }

        return friendlyNames[type] || type.replace(/HK(Quantity|Category)TypeIdentifier/g, '');
    }

    /**
     * Get friendly name for workout type
     * @param {string} type - Workout type identifier
     * @returns {string} Friendly name
     */
    getWorkoutTypeName(type) {
        const workoutNames = {
            'HKWorkoutActivityTypeRunning': 'Chạy bộ',
            'HKWorkoutActivityTypeWalking': 'Đi bộ',
            'HKWorkoutActivityTypeCycling': 'Đạp xe',
            'HKWorkoutActivityTypeSwimming': 'Bơi lội',
            'HKWorkoutActivityTypeYoga': 'Yoga',
            'HKWorkoutActivityTypeFunctionalStrengthTraining': 'Tập sức mạnh',
            'HKWorkoutActivityTypeTraditionalStrengthTraining': 'Tập tạ',
            'HKWorkoutActivityTypeElliptical': 'Máy tập elip',
            'HKWorkoutActivityTypeStairClimbing': 'Leo cầu thang',
            'HKWorkoutActivityTypeHiking': 'Đi bộ đường dài',
            'HKWorkoutActivityTypeDancing': 'Nhảy múa',
            'HKWorkoutActivityTypeSoccer': 'Bóng đá',
            'HKWorkoutActivityTypeBasketball': 'Bóng rổ',
            'HKWorkoutActivityTypeTennis': 'Tennis'
        };

        return workoutNames[type] || type.replace('HKWorkoutActivityType', '');
    }

    /**
     * Filter data by type and date range
     * @param {string} dataType - Data type to filter
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Filtered records
     */
    filterData(dataType, startDate = null, endDate = null) {
        let filtered = this.rawData;

        // Filter by type
        if (dataType) {
            filtered = filtered.filter(record => record.type === dataType);
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(record => record.startDate >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(record => record.startDate <= endDate);
        }

        return filtered;
    }

    /**
     * Get statistics for a dataset
     * @param {Array} data - Array of records
     * @returns {Object} Statistics object
     */
    getStatistics(data) {
        if (!data || data.length === 0) {
            return {
                count: 0,
                sum: 0,
                avg: 0,
                min: 0,
                max: 0,
                unit: ''
            };
        }

        const values = data.filter(d => d.value !== null).map(d => d.value);

        if (values.length === 0) {
            return {
                count: data.length,
                sum: 0,
                avg: 0,
                min: 0,
                max: 0,
                unit: data[0]?.unit || ''
            };
        }

        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: data.length,
            sum: sum,
            avg: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            unit: data[0]?.unit || ''
        };
    }

    /**
     * Helper function to sleep for async operations
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Aggregate data by time period
     * @param {Array} data - Array of records
     * @param {string} period - Period type: 'day', 'week', 'month', 'year'
     * @returns {Array} Aggregated data
     */
    aggregateByPeriod(data, period = 'day') {
        const aggregated = {};

        data.forEach(record => {
            let key;
            const date = new Date(record.startDate);

            switch (period) {
                case 'day':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'year':
                    key = String(date.getFullYear());
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            if (!aggregated[key]) {
                aggregated[key] = {
                    date: key,
                    values: [],
                    count: 0,
                    sum: 0,
                    avg: 0
                };
            }

            if (record.value !== null) {
                aggregated[key].values.push(record.value);
                aggregated[key].count++;
                aggregated[key].sum += record.value;
            }
        });

        // Calculate averages and sort
        const result = Object.values(aggregated).map(item => {
            item.avg = item.count > 0 ? item.sum / item.count : 0;
            return item;
        }).sort((a, b) => a.date.localeCompare(b.date));

        return result;
    }
}
