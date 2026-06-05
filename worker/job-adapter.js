/**
 * Job Adapter - Converts Supabase badge_jobs rows to Photoshop input.json
 *
 * This adapter uses the canonical badgeMapping to ensure frontend and worker
 * use the exact same data model and PSD layer mapping.
 *
 * Data flow:
 * Supabase badge_jobs row → job-adapter.js → input.json → run_employeeid_job.jsx
 */

/**
 * Format date from ISO to MM/DD/YYYY
 */
function formatDateMMDDYYYY(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function extractDateParts(dateValue) {
  if (!dateValue) return null;
  const text = String(dateValue).trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return { year: match[1], month: match[2], day: match[3] };
  }
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) {
    return {
      year: match[3],
      month: String(match[1]).padStart(2, '0'),
      day: String(match[2]).padStart(2, '0'),
    };
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
  };
}

/**
 * Calculate birth year from birth date
 */
function calculateBirthYear(birthDate) {
  const parts = extractDateParts(birthDate);
  return parts ? parts.year : '';
}

const MONTH_CODES = [
  'JAN/JAN', 'FEB/FEB', 'MAA/MAR', 'APR/APR', 'MEI/MAY', 'JUN/JUN',
  'JUL/JUL', 'AUG/AUG', 'SEP/SEP', 'OKT/OCT', 'NOV/NOV', 'DEC/DEC',
];

function monthCodeFromNumeric(month) {
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return '';
  return MONTH_CODES[idx];
}

function buildPerfoString(birthDate) {
  const parts = extractDateParts(birthDate);
  if (!parts) return '';
  const code = monthCodeFromNumeric(parts.month);
  if (!code) return '';
  return `${code}${parts.year}`;
}

function mrzCharValue(char) {
  if (char === '<') return 0;
  if (/[0-9]/.test(char)) return char.charCodeAt(0) - 48;
  if (/[A-Z]/.test(char)) return char.charCodeAt(0) - 55;
  return 0;
}

function mrzCheckDigit(value) {
  const weights = [7, 3, 1];
  const text = String(value || '').toUpperCase();
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += mrzCharValue(text[i]) * weights[i % 3];
  }
  return String(sum % 10);
}

function mrzClean(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '<');
}

function mrzPad(value, length) {
  const cleaned = mrzClean(value).replace(/</g, '');
  return (cleaned + '<'.repeat(length)).slice(0, length);
}

function mrzPadName(value, length) {
  return (mrzClean(value) + '<'.repeat(length)).slice(0, length);
}

function genderMrz(value) {
  const text = String(value || '').toUpperCase();
  if (text.startsWith('M')) return 'M';
  if (text.startsWith('F')) return 'F';
  return 'X';
}

function canonicalGender(input) {
  const t = String(input == null ? '' : input).trim().toUpperCase();
  if (t === 'M' || t === 'MALE') return 'M';
  if (t === 'F' || t === 'V' || t === 'FEMALE') return 'F';
  return 'X';
}

/**
 * Country/document-specific gender formatter (synthetic test data).
 * Mirrors src/lib/genderFormat.ts.
 */
function formatGenderForDocument(opts) {
  const country = opts && opts.country;
  const documentType = opts && opts.documentType;
  const target = opts && opts.target;
  const g = canonicalGender(opts && opts.gender);

  if (country === 'DE' && documentType === 'id_card') return '';

  if (target === 'mrz') {
    if (g === 'M') return 'M';
    if (g === 'F') return 'F';
    return '<';
  }
  if (country === 'NL') {
    if (g === 'M') return 'M/M';
    if (g === 'F') return 'V/F';
    return 'X/X';
  }
  if (g === 'M') return 'M';
  if (g === 'F') return 'F';
  return 'X';
}

function dateYYMMDD(dateValue) {
  const parts = extractDateParts(dateValue);
  if (!parts) return '<<<<<<';
  return `${parts.year.slice(2, 4)}${parts.month}${parts.day}`;
}

function buildInternalMrz(payload) {
  const incoming = payload.mrz || payload.MRZ || payload.mrz_text || payload.mrzText;
  if (incoming) return String(incoming).replace(/\r\n/g, '\n').trimEnd();

  const issuer = mrzPad(payload.issuer_code || 'INT', 3);
  const doc = mrzPad(payload.doc_number || '', 9);
  const docCd = mrzCheckDigit(doc);
  const birth = dateYYMMDD(payload.birth_date);
  const birthCd = birth.indexOf('<') >= 0 ? '<' : mrzCheckDigit(birth);
  const expiry = dateYYMMDD(payload.expires);
  const expiryCd = expiry.indexOf('<') >= 0 ? '<' : mrzCheckDigit(expiry);
  const sex = formatGenderForDocument({
    country: payload.country,
    documentType: payload.doc_type,
    gender: payload.gender,
    target: 'mrz',
  });
  const optional = mrzPad(payload.personal_number || '', 11);
  const composite = mrzCheckDigit(doc + docCd + birth + birthCd + expiry + expiryCd + optional);
  const last = mrzClean(payload.last_name || '');
  const first = mrzClean(payload.first_name || '');

  const line1 = (`BC${issuer}${doc}${docCd}` + '<'.repeat(30)).slice(0, 30);
  const line2 = `${birth}${birthCd}${sex}${expiry}${expiryCd}${issuer}${optional}${composite}`.slice(0, 30);
  const line3 = mrzPadName(`${last}<<${first}`, 30);
  return `${line1}\n${line2}\n${line3}`;
}

/**
 * Convert Supabase badge_jobs row to Photoshop input.json
 *
 * @param {Object} badgeJob - The badge_jobs database row
 * @param {string} photoPath - Local path to downloaded employee photo
 * @param {string} signaturePath - Local path to downloaded signature image
 * @returns {Object} Photoshop input.json structure
 */
function convertJobToPhotoshopInput(badgeJob, photoPath, signaturePath) {
  const payload = badgeJob.input_json || {};

  // Calculate derived values
  const birthYear = calculateBirthYear(payload.birth_date);

  // Format dates
  const formattedValidFrom = formatDateMMDDYYYY(payload.valid_from);
  const formattedExpires = formatDateMMDDYYYY(payload.expires);
  const formattedBirthDate = formatDateMMDDYYYY(payload.birth_date);
  const perfoString = payload.perfo_string || payload.PERFO_STRING || buildPerfoString(payload.birth_date);
  const mrz = buildInternalMrz(payload);
  const visibleGender = formatGenderForDocument({
    country: payload.country,
    documentType: payload.doc_type,
    gender: payload.gender,
    target: 'visible',
  });

  // Build Photoshop input structure
  return {
    job_id: badgeJob.id,
    template: payload.template || 'EmployeeID.psd',
    country: payload.country || '',
    doc_type: payload.doc_type || '',

    // Company section
    company: {
      company_name: payload.company_name || '',
      issuer_code: payload.issuer_code || '',
      department: payload.department || '',
    },

    // Employee section
    employee: {
      first_name: payload.first_name || '',
      last_name: payload.last_name || '',
      doc_number: payload.doc_number || '',
      personal_number: payload.personal_number || '',
      expires: formattedExpires,
      valid_from: formattedValidFrom,
      birth_date: formattedBirthDate,
      birth_year: birthYear,
      gender: visibleGender,
      height: payload.height || '',
      country_of_birth: payload.country_of_birth || '',
      city_of_birth: payload.city_of_birth || '',
      company_location: payload.company_location || '',
    },

    // PSD text layer targets
    // These map exactly to the layer names in EmployeeID.psd
    psdTextTargets: {
      FIRST: payload.first_name || '',
      LAST: payload.last_name || '',
      DOCNMBR: payload.doc_number || '',
      CODE: payload.personal_number || '',
      ENDVALID: formattedExpires,
      VALID: formattedValidFrom,
      BIRTHDATE: formattedBirthDate,
      YEAR: birthYear,
      GENDER: formatGenderForDocument({
        country: payload.country,
        documentType: payload.doc_type,
        gender: payload.gender,
        target: 'visible',
      }),
      HEIGHT: payload.height || '',
      COUNTRY: payload.country_of_birth || '',
      CITYBIRTH: payload.city_of_birth || '',
      LOCATION: payload.company_location || '',
      MRZ: mrz,
      PERFO_STRING: perfoString,
    },

    perfo: {
      string: perfoString,
      digits: perfoString ? perfoString.split('') : [],
    },

    // Image paths
    images: {
      photo_path: photoPath || '',
      signature_path: signaturePath || '',
    },

    // Export format
    export_format: payload.export_format || 'png',
  };
}

/**
 * Validate Photoshop input structure
 *
 * @param {Object} input - The Photoshop input.json object
 * @returns {Array} Array of validation error messages (empty if valid)
 */
function validatePhotoshopInput(input) {
  const errors = [];

  // Required top-level fields
  if (!input.job_id) errors.push('Missing job_id');
  if (!input.template) errors.push('Missing template');

  // Required company fields
  if (!input.company?.company_name) errors.push('Missing company.company_name');
  if (!input.company?.issuer_code) errors.push('Missing company.issuer_code');

  // Required employee fields
  if (!input.employee?.first_name) errors.push('Missing employee.first_name');
  if (!input.employee?.last_name) errors.push('Missing employee.last_name');
  if (!input.employee?.doc_number) errors.push('Missing employee.doc_number');
  if (!input.employee?.personal_number) errors.push('Missing employee.personal_number');
  if (!input.employee?.valid_from) errors.push('Missing employee.valid_from');
  if (!input.employee?.expires) errors.push('Missing employee.expires');
  if (!input.employee?.birth_date) errors.push('Missing employee.birth_date');
  if (!input.employee?.birth_year) errors.push('Missing employee.birth_year');
  if (!input.employee?.gender && !(input.country === 'DE' && input.doc_type === 'id_card')) {
    errors.push('Missing employee.gender');
  }

  // Required PSD targets (must match required employee fields)
  const requiredTargets = ['FIRST', 'LAST', 'DOCNMBR', 'CODE', 'VALID', 'ENDVALID', 'BIRTHDATE', 'YEAR'];
  for (const target of requiredTargets) {
    if (!input.psdTextTargets?.[target]) {
      errors.push(`Missing psdTextTargets.${target}`);
    }
  }

  // Required photo
  if (!input.images?.photo_path) errors.push('Missing images.photo_path');

  // Export format
  if (!['png', 'pdf', 'psd'].includes(input.export_format)) {
    errors.push('Invalid export_format (must be png, pdf, or psd)');
  }

  return errors;
}

module.exports = {
  convertJobToPhotoshopInput,
  validatePhotoshopInput,
  formatDateMMDDYYYY,
  calculateBirthYear,
  buildPerfoString,
  buildInternalMrz,
  formatGenderForDocument,
  canonicalGender,
};
