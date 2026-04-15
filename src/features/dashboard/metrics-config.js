// Metric configuration shared by the patient-monitor dashboard.
// Defines chart bounds, normal ranges, units, and colors for each metric.

export const metricConfigs = {
  hr:      { field: 'heartRate',        min: 40,   max: 200, normalMin: 60,   normalMax: 100, unit: 'BPM',   color: '#E53E5F', decimal: 0 },
  spo2:    { field: 'oxygenSaturation', min: 85,   max: 100, normalMin: 95,   normalMax: 100, unit: '%',     color: '#0097E6', decimal: 0 },
  temp:    { field: 'bodyTemperature',  min: 35.0, max: 42,  normalMin: 36.1, normalMax: 37.2, unit: '°C',   color: '#D4A017', decimal: 1 },
  bp:      { field: 'systolicBP', diaField: 'diastolicBP', min: 70, max: 200, normalMin: 90, normalMax: 140, unit: 'mmHg', color: '#7C4DFF', decimal: 0 },
  hrv:     { field: 'hrvSdnn',          min: 10,   max: 200, normalMin: 50,   normalMax: 100, unit: 'ms',    color: '#00BFA5', decimal: 0 },
  glucose: { field: 'bloodGlucose',     min: 40,   max: 400, normalMin: 70,   normalMax: 140, unit: 'mg/dL', color: '#E8622E', decimal: 0 },
};

export const metricLabels = {
  hr:      { name: 'Nabız',      unit: 'BPM',   normalRange: '60-100 BPM' },
  spo2:    { name: 'SpO2',       unit: '%',     normalRange: '95-100%' },
  temp:    { name: 'Sıcaklık',   unit: '°C',    normalRange: '36.1-37.2°C' },
  bp:      { name: 'Tansiyon',   unit: 'mmHg',  normalRange: '90-140 mmHg' },
  hrv:     { name: 'HRV',        unit: 'ms',    normalRange: '50-100 ms' },
  glucose: { name: 'Kan Şekeri', unit: 'mg/dL', normalRange: '70-140 mg/dL' },
};
