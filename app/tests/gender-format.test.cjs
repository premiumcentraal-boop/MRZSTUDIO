/**
 * Gender formatter tests — synthetic test data only.
 *
 * Verifies country/document-specific visible + MRZ gender values.
 */

const { formatGenderForDocument } = require('../worker/job-adapter');

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

console.log('=== formatGenderForDocument ===\n');

// NL passport visible
check('NL passport visible Male',   formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'M', target: 'visible' }), 'M/M');
check('NL passport visible Female', formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'F', target: 'visible' }), 'V/F');
check('NL passport visible V',      formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'V', target: 'visible' }), 'V/F');
check('NL passport visible X',      formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'X', target: 'visible' }), 'X/X');

// NL ID visible
check('NL ID visible Male',   formatGenderForDocument({ country: 'NL', documentType: 'id_card', gender: 'Male',   target: 'visible' }), 'M/M');
check('NL ID visible Female', formatGenderForDocument({ country: 'NL', documentType: 'id_card', gender: 'Female', target: 'visible' }), 'V/F');

// DE passport visible
check('DE passport visible Male',   formatGenderForDocument({ country: 'DE', documentType: 'passport', gender: 'M', target: 'visible' }), 'M');
check('DE passport visible Female', formatGenderForDocument({ country: 'DE', documentType: 'passport', gender: 'F', target: 'visible' }), 'F');
check('DE passport visible Other',  formatGenderForDocument({ country: 'DE', documentType: 'passport', gender: 'X', target: 'visible' }), 'X');

// DE ID visible — must be empty (no field rendered)
check('DE ID visible Male empty',   formatGenderForDocument({ country: 'DE', documentType: 'id_card', gender: 'M', target: 'visible' }), '');
check('DE ID visible Female empty', formatGenderForDocument({ country: 'DE', documentType: 'id_card', gender: 'F', target: 'visible' }), '');
check('DE ID visible Other empty',  formatGenderForDocument({ country: 'DE', documentType: 'id_card', gender: 'X', target: 'visible' }), '');

// MRZ values
check('NL passport MRZ Male',   formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'M', target: 'mrz' }), 'M');
check('NL passport MRZ Female', formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'F', target: 'mrz' }), 'F');
check('NL passport MRZ Other',  formatGenderForDocument({ country: 'NL', documentType: 'passport', gender: 'X', target: 'mrz' }), '<');
check('NL ID MRZ Female',       formatGenderForDocument({ country: 'NL', documentType: 'id_card',  gender: 'F', target: 'mrz' }), 'F');
check('DE passport MRZ Other',  formatGenderForDocument({ country: 'DE', documentType: 'passport', gender: 'X', target: 'mrz' }), '<');
check('DE passport MRZ Female', formatGenderForDocument({ country: 'DE', documentType: 'passport', gender: 'F', target: 'mrz' }), 'F');

// DE ID MRZ — no sex slot is written by this generator
check('DE ID MRZ Female empty', formatGenderForDocument({ country: 'DE', documentType: 'id_card', gender: 'F', target: 'mrz' }), '');
check('DE ID MRZ Male empty',   formatGenderForDocument({ country: 'DE', documentType: 'id_card', gender: 'M', target: 'mrz' }), '');

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} failure(s)`);
  process.exit(1);
}
console.log('✅ All gender formatter tests passed');
