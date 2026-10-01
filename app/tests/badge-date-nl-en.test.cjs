/**
 * Badge date formatter tests — DD MMM/MMM YYYY (NL/EN).
 *
 * VALID / ENDVALID use DD MMM/MMM YYYY; BIRTHDATE is DD MMM/MMM only (year on YEAR).
 * PERFO stays digit MMYYYY (JSX converts legacy JUN/JUN1990 → 061990).
 */

const {
  formatDateBadgeNlEn,
  formatDateBadgeNlEnDayMonth,
  convertJobToPhotoshopInput,
  buildPerfoString,
  extractDateParts,
  buildInternalMrz,
} = require('../worker/job-adapter');

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures++;
    console.error(`❌ ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`✅ ${label}`);
  }
}

function checkTruthy(label, value) {
  if (!value) {
    failures++;
    console.error(`❌ ${label}: expected a truthy value, got ${JSON.stringify(value)}`);
  } else {
    console.log(`✅ ${label}`);
  }
}

const BADGE_DATE_RE = /^\d{2} [A-Z]{3}\/[A-Z]{3} \d{4}$/;

console.log('=== formatDateBadgeNlEn ===\n');

check('Aug 2 1966 ISO', formatDateBadgeNlEn('1966-08-02'), '02 AUG/AUG 1966');
check('DayMonth Aug', formatDateBadgeNlEnDayMonth('1966-08-02'), '02 AUG/AUG');
check('DayMonth Mar', formatDateBadgeNlEnDayMonth('2020-03-03'), '03 MAA/MAR');
check('Mar 3 2020 ISO', formatDateBadgeNlEn('2020-03-03'), '03 MAA/MAR 2020');
check('ISO 1990-06-14', formatDateBadgeNlEn('1990-06-14'), '14 JUN/JUN 1990');
check('US 06/14/1990', formatDateBadgeNlEn('06/14/1990'), '14 JUN/JUN 1990');
check('US 08/02/1966', formatDateBadgeNlEn('08/02/1966'), '02 AUG/AUG 1966');
check('May ISO → MEI/MAY', formatDateBadgeNlEn('2020-05-03'), '03 MEI/MAY 2020');
check('Oct ISO → OKT/OCT', formatDateBadgeNlEn('2020-10-10'), '10 OKT/OCT 2020');
check('unpadded US 8/2/1966', formatDateBadgeNlEn('8/2/1966'), '02 AUG/AUG 1966');
check('ISO datetime prefix', formatDateBadgeNlEn('1966-08-02T00:00:00.000Z'), '02 AUG/AUG 1966');
check('idempotent NL/EN', formatDateBadgeNlEn('02 AUG/AUG 1966'), '02 AUG/AUG 1966');
check('lowercase month codes', formatDateBadgeNlEn('3 maa/mar 2020'), '03 MAA/MAR 2020');
check('empty', formatDateBadgeNlEn(''), '');
check('nullish', formatDateBadgeNlEn(null), '');

console.log('\n=== convertJobToPhotoshopInput visible dates ===\n');

const photoshopInput = convertJobToPhotoshopInput(
  {
    id: 'date-test-1',
    input_json: {
      template: 'EmployeeID.psd',
      company_name: 'Acme',
      issuer_code: 'NLD',
      first_name: 'Ada',
      last_name: 'Koning',
      doc_number: 'AB12C34D5',
      personal_number: '123456789',
      valid_from: '2020-03-03',
      expires: '2030-03-03',
      birth_date: '1966-08-02',
      gender: 'F',
      country: 'NL',
      doc_type: 'id_card',
      export_format: 'png',
    },
  },
  'C:/photo.jpg',
  'C:/signature.png'
);

check('psdTextTargets.BIRTHDATE', photoshopInput.psdTextTargets.BIRTHDATE, '02 AUG/AUG');
check('psdTextTargets.VALID', photoshopInput.psdTextTargets.VALID, '03 MAA/MAR 2020');
check('psdTextTargets.ENDVALID', photoshopInput.psdTextTargets.ENDVALID, '03 MAA/MAR 2030');
check('employee.birth_date', photoshopInput.employee.birth_date, '02 AUG/AUG');
check('employee.valid_from', photoshopInput.employee.valid_from, '03 MAA/MAR 2020');
check('employee.expires', photoshopInput.employee.expires, '03 MAA/MAR 2030');
checkTruthy('BIRTHDATE pattern', /^\d{2} [A-Z]{3}\/[A-Z]{3}$/.test(photoshopInput.psdTextTargets.BIRTHDATE));
checkTruthy('VALID pattern', BADGE_DATE_RE.test(photoshopInput.psdTextTargets.VALID));
checkTruthy('ENDVALID pattern', BADGE_DATE_RE.test(photoshopInput.psdTextTargets.ENDVALID));

console.log('\n=== US slash dates from website ===\n');

const usInput = convertJobToPhotoshopInput(
  {
    id: 'date-test-us',
    input_json: {
      template: 'EmployeeID.psd',
      company_name: 'Acme',
      issuer_code: 'NLD',
      first_name: 'Ada',
      last_name: 'Koning',
      doc_number: 'AB12C34D5',
      personal_number: '123456789',
      valid_from: '03/03/2020',
      expires: '03/03/2030',
      birth_date: '08/02/1966',
      gender: 'F',
      export_format: 'png',
    },
  },
  'C:/photo.jpg',
  ''
);

check('US BIRTHDATE', usInput.psdTextTargets.BIRTHDATE, '02 AUG/AUG');
check('US VALID', usInput.psdTextTargets.VALID, '03 MAA/MAR 2020');
check('US ENDVALID', usInput.psdTextTargets.ENDVALID, '03 MAA/MAR 2030');

console.log('\n=== PERFO stays digit-compatible (do not use DD MMM/MMM YYYY) ===\n');

check('buildPerfoString Aug 1966 unchanged', buildPerfoString('1966-08-02'), 'AUG/AUG1966');
check('buildPerfoString Jun 1990 unchanged', buildPerfoString('1990-06-14'), 'JUN/JUN1990');
check('adapter PERFO_STRING still monthcode+year', photoshopInput.psdTextTargets.PERFO_STRING, 'AUG/AUG1966');
checkTruthy(
  'PERFO_STRING is not a visible badge date',
  !BADGE_DATE_RE.test(photoshopInput.psdTextTargets.PERFO_STRING)
);

// Mirror of run_employeeid_job.jsx getPerfoString: 6 digits, or legacy CODEYYYY, else month from birth + YEAR.
function jsxPerfoDigits(rawPerfo, birthText, year) {
  const MONTH_CODES = [
    'JAN/JAN', 'FEB/FEB', 'MAA/MAR', 'APR/APR', 'MEI/MAY', 'JUN/JUN',
    'JUL/JUL', 'AUG/AUG', 'SEP/SEP', 'OKT/OCT', 'NOV/NOV', 'DEC/DEC',
  ];
  const raw = String(rawPerfo || '').replace(/\s+/g, '');
  if (/^\d{6}$/.test(raw)) return raw;
  const legacy = /^([A-Z]{3}\/[A-Z]{3})(\d{4})$/.exec(raw);
  if (legacy && MONTH_CODES.indexOf(legacy[1]) >= 0) {
    const mm = String(MONTH_CODES.indexOf(legacy[1]) + 1).padStart(2, '0');
    return mm + legacy[2];
  }
  const text = String(birthText || '').trim();
  let month = '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) month = m[2];
  if (!month) {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (m) month = String(m[1]).padStart(2, '0');
  }
  if (!month) {
    m = /([A-Z]{3}\/[A-Z]{3})/i.exec(text);
    if (m) {
      const idx = MONTH_CODES.indexOf(m[1].toUpperCase());
      if (idx >= 0) month = String(idx + 1).padStart(2, '0');
    }
  }
  const y = String(year || '').replace(/[^0-9]/g, '').slice(0, 4);
  if (month && y.length === 4) return month + y;
  return '';
}

check(
  'JSX PERFO from adapter string → MMYYYY',
  jsxPerfoDigits(photoshopInput.psdTextTargets.PERFO_STRING, photoshopInput.employee.birth_date, '1966'),
  '081966'
);
check(
  'JSX PERFO from NL/EN birth_date fallback',
  jsxPerfoDigits('', '02 AUG/AUG 1966', '1966'),
  '081966'
);
check(
  'JSX PERFO from ISO fallback',
  jsxPerfoDigits('', '1966-08-02', '1966'),
  '081966'
);
check(
  'JSX PERFO from US slash fallback',
  jsxPerfoDigits('', '08/02/1966', '1966'),
  '081966'
);

console.log('\n=== MRZ machine dates unchanged (YYMMDD) ===\n');

check('extractDateParts ISO year', extractDateParts('1966-08-02').year, '1966');
check('extractDateParts ISO month', extractDateParts('1966-08-02').month, '08');
check('extractDateParts ISO day', extractDateParts('1966-08-02').day, '02');

const mrz = buildInternalMrz({
  issuer_code: 'NLD',
  doc_number: 'AB12C34D5',
  birth_date: '1966-08-02',
  expires: '2030-03-03',
  gender: 'F',
  country: 'NL',
  doc_type: 'id_card',
  last_name: 'Koning',
  first_name: 'Ada',
});
const mrzLine2 = mrz.split('\n')[1] || '';
checkTruthy('MRZ line2 starts with YYMMDD birth 660802', mrzLine2.indexOf('660802') === 0);
checkTruthy('MRZ line2 contains expiry 300303', mrzLine2.indexOf('300303') >= 0);
checkTruthy('MRZ does not contain AUG/AUG', mrz.indexOf('AUG/AUG') < 0);

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} failure(s)`);
  process.exit(1);
}
console.log('✅ All badge date NL/EN tests passed');
