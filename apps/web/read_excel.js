const XLSX = require('xlsx');
const path = require('path');

const file = path.join(__dirname, 'public', 'TABLA_LABORES_UTA.xlsx');
const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert sheet to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Sheet:', sheetName);
console.log('Total rows:', data.length);
console.log('\nColumn headers:', Object.keys(data[0] || {}));
console.log('\nAll rows:');
console.log(JSON.stringify(data, null, 2));
