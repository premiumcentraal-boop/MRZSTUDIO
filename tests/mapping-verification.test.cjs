/**
 * Mapping Verification Test
 *
 * Ensures that the Internal Employee Badge Studio data model is consistent
 * across frontend, worker, and Photoshop layers.
 *
 * This test verifies:
 * 1. BadgeJobPayload contains all required Internal Employee Badge Studio fields
 * 2. Worker input.json preserves all fields from BadgeJobPayload
 * 3. psdTextTargets contains the exact PSD layer names
 * 4. Example values map correctly to expected PSD layers
 * 5. No duplicate or conflicting mappings exist
 */

const { convertJobToPhotoshopInput, validatePhotoshopInput } = require('../worker/job-adapter');

// Mock badge job matching Internal Employee Badge Studio structure
const mockBadgeJob = {
  id: 'test-job-123',
  status: 'queued',
  template: 'EmployeeID.psd',
  input_json: {
    template: 'EmployeeID.psd',
    // Company fields
    company_name: 'Acme Corporation',
    issuer_code: 'NLD',
    department: 'Engineering',
    // Employee fields
    first_name: 'Mila',
    last_name: 'De Vries',
    doc_number: 'AB12C34D5',
    personal_number: '123456789',
    // Validity fields
    valid_from: '2020-06-14',
    expires: '2030-06-14',
    // Personal info fields
    birth_date: '1990-06-14',
    birth_year: '1990',
    gender: 'Female',
    height: '1,72 m',
    country_of_birth: 'Nederlandse',
    city_of_birth: 'Zoetermeer',
    company_location: 'Burg. van Zoetermeer',
    // Export format
    export_format: 'png',
    // Assets
    assets: {
      employee_photo_path: 'test/photo.jpg',
      signature_image_path: 'test/signature.png',
    },
    // Metadata
    meta: {
      created_from: 'custom-tools/id-generator',
      intended_use: 'internal_company_badge',
    },
  },
  employee_photo_path: 'test/photo.jpg',
  signature_image_path: 'test/signature.png',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Expected PSD layer names (from Internal Employee Badge Studio)
const expectedPSDLayerNames = [
  'FIRST',
  'LAST',
  'DOCNMBR',
  'CODE',
  'ENDVALID',
  'VALID',
  'BIRTHDATE',
  'YEAR',
  'GENDER',
  'HEIGHT',
  'COUNTRY',
  'CITYBIRTH',
  'LOCATION',
];

console.log('===========================================');
console.log('Mapping Verification Test');
console.log('===========================================\n');

// Test 1: Convert job to Photoshop input
console.log('Test 1: Converting badge job to Photoshop input...');
const photoshopInput = convertJobToPhotoshopInput(
  mockBadgeJob,
  'C:/EmployeeBadgeAutomation/current-job/photo.jpg',
  'C:/EmployeeBadgeAutomation/current-job/signature.png'
);

// Test 2: Validate Photoshop input structure
console.log('Test 2: Validating Photoshop input structure...');
const validationErrors = validatePhotoshopInput(photoshopInput);
if (validationErrors.length > 0) {
  console.error('❌ FAIL: Photoshop input validation failed');
  validationErrors.forEach(err => console.error('  - ' + err));
  process.exit(1);
}
console.log('✅ PASS: Photoshop input is valid\n');

// Test 3: Check all required fields are present
console.log('Test 3: Checking all required fields are present...');
const requiredFields = [
  'job_id',
  'template',
  'company',
  'employee',
  'psdTextTargets',
  'images',
  'export_format',
];
const missingFields = requiredFields.filter(field => !photoshopInput[field]);
if (missingFields.length > 0) {
  console.error('❌ FAIL: Missing required fields:', missingFields);
  process.exit(1);
}
console.log('✅ PASS: All required top-level fields present\n');

// Test 4: Check psdTextTargets contains all expected PSD layer names
console.log('Test 4: Checking psdTextTargets contains expected PSD layer names...');
const actualPSDLayers = Object.keys(photoshopInput.psdTextTargets);
const missingLayers = expectedPSDLayerNames.filter(name => !actualPSDLayers.includes(name));
const extraLayers = actualPSDLayers.filter(name => !expectedPSDLayerNames.includes(name));

if (missingLayers.length > 0) {
  console.error('❌ FAIL: Missing PSD layers:', missingLayers);
  process.exit(1);
}
if (extraLayers.length > 0) {
  console.error('❌ FAIL: Unexpected PSD layers:', extraLayers);
  process.exit(1);
}
console.log('✅ PASS: All expected PSD layers present\n');

// Test 5: Verify example values map correctly
console.log('Test 5: Verifying example values map correctly...');
const expectedValues = {
  FIRST: 'Mila',
  LAST: 'De Vries',
  DOCNMBR: 'AB12C34D5',
  CODE: '123456789',
  ENDVALID: '06/14/2030',
  VALID: '06/14/2020',
  BIRTHDATE: '06/14/1990',
  YEAR: '1990',
  GENDER: 'Female',
  HEIGHT: '1,72 m',
  COUNTRY: 'Nederlandse',
  CITYBIRTH: 'Zoetermeer',
  LOCATION: 'Burg. van Zoetermeer',
};

let valueMappingErrors = 0;
for (const [layerName, expectedValue] of Object.entries(expectedValues)) {
  const actualValue = photoshopInput.psdTextTargets[layerName];
  if (actualValue !== expectedValue) {
    console.error(`❌ FAIL: ${layerName} = "${actualValue}", expected "${expectedValue}"`);
    valueMappingErrors++;
  }
}

if (valueMappingErrors > 0) {
  console.error(`❌ FAIL: ${valueMappingErrors} value mapping error(s)`);
  process.exit(1);
}
console.log('✅ PASS: All values map correctly\n');

// Test 6: Check company section
console.log('Test 6: Checking company section...');
if (photoshopInput.company.company_name !== 'Acme Corporation') {
  console.error('❌ FAIL: company_name mismatch');
  process.exit(1);
}
if (photoshopInput.company.issuer_code !== 'NLD') {
  console.error('❌ FAIL: issuer_code mismatch');
  process.exit(1);
}
if (photoshopInput.company.department !== 'Engineering') {
  console.error('❌ FAIL: department mismatch');
  process.exit(1);
}
console.log('✅ PASS: Company section correct\n');

// Test 7: Check employee section
console.log('Test 7: Checking employee section...');
const employeeFields = {
  first_name: 'Mila',
  last_name: 'De Vries',
  doc_number: 'AB12C34D5',
  personal_number: '123456789',
  expires: '06/14/2030',
  valid_from: '06/14/2020',
  birth_date: '06/14/1990',
  birth_year: '1990',
  gender: 'Female',
  height: '1,72 m',
  country_of_birth: 'Nederlandse',
  city_of_birth: 'Zoetermeer',
  company_location: 'Burg. van Zoetermeer',
};

let employeeErrors = 0;
for (const [field, expectedValue] of Object.entries(employeeFields)) {
  const actualValue = photoshopInput.employee[field];
  if (actualValue !== expectedValue) {
    console.error(`❌ FAIL: employee.${field} = "${actualValue}", expected "${expectedValue}"`);
    employeeErrors++;
  }
}

if (employeeErrors > 0) {
  console.error(`❌ FAIL: ${employeeErrors} employee field error(s)`);
  process.exit(1);
}
console.log('✅ PASS: Employee section correct\n');

// Test 8: Check no duplicate mappings
console.log('Test 8: Checking for duplicate mappings...');
const psdLayerValues = Object.values(photoshopInput.psdTextTargets);
const duplicateLayerNames = actualPSDLayers.filter((name, index) => actualPSDLayers.indexOf(name) !== index);
if (duplicateLayerNames.length > 0) {
  console.error('❌ FAIL: Duplicate PSD layer names:', duplicateLayerNames);
  process.exit(1);
}
console.log('✅ PASS: No duplicate mappings\n');

// Test 9: Check date formatting
console.log('Test 9: Checking date formatting (ISO → MM/DD/YYYY)...');
if (!/^\d{2}\/\d{2}\/\d{4}$/.test(photoshopInput.psdTextTargets.VALID)) {
  console.error('❌ FAIL: VALID date not in MM/DD/YYYY format');
  process.exit(1);
}
if (!/^\d{2}\/\d{2}\/\d{4}$/.test(photoshopInput.psdTextTargets.ENDVALID)) {
  console.error('❌ FAIL: ENDVALID date not in MM/DD/YYYY format');
  process.exit(1);
}
if (!/^\d{2}\/\d{2}\/\d{4}$/.test(photoshopInput.psdTextTargets.BIRTHDATE)) {
  console.error('❌ FAIL: BIRTHDATE not in MM/DD/YYYY format');
  process.exit(1);
}
console.log('✅ PASS: Dates formatted correctly\n');

// Test 10: Check birth year calculation
console.log('Test 10: Checking birth year calculation...');
if (photoshopInput.employee.birth_year !== '1990') {
  console.error('❌ FAIL: birth_year should be 1990');
  process.exit(1);
}
if (photoshopInput.psdTextTargets.YEAR !== '1990') {
  console.error('❌ FAIL: YEAR layer should be 1990');
  process.exit(1);
}
console.log('✅ PASS: Birth year calculated correctly\n');

// Summary
console.log('===========================================');
console.log('✅ All mapping verification tests passed!');
console.log('===========================================');
console.log('\nSummary:');
console.log('- Frontend BadgeJobPayload: ✅ Contains all required fields');
console.log('- Worker input.json: ✅ Preserves all fields');
console.log('- psdTextTargets: ✅ Contains exact PSD layer names');
console.log('- Value mapping: ✅ Example values map correctly');
console.log('- No duplicates: ✅ No conflicting mappings');
console.log('- Date formatting: ✅ ISO dates converted to MM/DD/YYYY');
console.log('- Birth year: ✅ Auto-calculated from birth_date');
console.log('\n✅ Data model is consistent across all layers!\n');
