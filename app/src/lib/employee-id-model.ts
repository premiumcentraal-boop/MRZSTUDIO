import { buildTD1, buildTD3 } from './mrz';
import { formatGenderForDocument } from './genderFormat';
import { formatBurgVanLocation } from './dutchAddresses';
import { calculateBirthYear, validateEmployeeFields } from './badgeMapping';
import { getCountryPreset, validityYearsForHolder, defaultExpiry, clampExpiry } from './countryPresets';
import { generateDutchTravelDocumentNumber, validateDutchTravelDocumentNumber, pickPrimaryModelSeries, eraForModel } from './dutch-id-validation';
import { generateGermanTravelDocumentNumber, validateGermanTravelDocumentNumber } from './german-id-validation';

export const EMPLOYEE_DEFAULTS = {
  country: 'NL', doc_type: 'id_card', nationality_code: 'NLD', company_name: 'Acme Corporation',
  issuer_code: 'NLD', department: 'Engineering', first_name: '', last_name: '', doc_number: '', personal_number: '',
  valid_from: '', expires: '', birth_date: '', gender: 'F', height: '1,72 m', country_of_birth: 'Nederlandse',
  city_of_birth: 'Zoetermeer', company_location: 'Burg. van Zoetermeer', export_format: 'png', generate_mockups: false,
  mrz_format: 'auto', mrz_method: 'icao9303',
};
export const CITY_PRESETS = ['Rotterdam', 'Amsterdam', 'Zoetermeer'];
export function buildEmployeeMrz(form: typeof EMPLOYEE_DEFAULTS) {
  const preset = getCountryPreset(form.country);
  const nlPre2021 = form.country === 'NL' && Number(form.valid_from.slice(0, 4)) < 2021;
  const input = {
    documentCode: form.doc_type === 'passport' ? 'P<' : 'I<', issuer: form.issuer_code || preset.issuerCode,
    number: form.doc_number, surname: form.last_name, given: form.first_name,
    nationality: form.nationality_code || preset.nationalityCode, birth: form.birth_date,
    sex: ['NL', 'DE'].includes(form.country) ? formatGenderForDocument({country: form.country, documentType: form.doc_type, gender: form.gender, target: 'mrz'}) : form.gender,
    expiry: form.expires, personal: form.country === 'NL' ? '' : form.personal_number,
    optional1: form.country === 'NL' ? (nlPre2021 ? form.personal_number : '') : form.personal_number, optional2: '',
  };
  const format = form.country === 'OTHER' && form.mrz_format !== 'auto' ? form.mrz_format : form.doc_type === 'passport' ? 'td3' : 'td1';
  if (form.country === 'OTHER') input.documentCode = format === 'td3' ? 'P<' : 'I<';
  return format === 'td3' ? buildTD3(input as any) : buildTD1(input as any);
}
export function employeePayload(form: typeof EMPLOYEE_DEFAULTS, signature = true) {
  return {
    ...form, template: 'EmployeeID.psd', mrz: buildEmployeeMrz(form).lines.join('\n'),
    // Preserve the existing form → template mapping; MRZ uses the unswapped names above.
    first_name: form.last_name, last_name: form.first_name, birth_year: calculateBirthYear(form.birth_date),
    company_location: formatBurgVanLocation(form.company_location || form.city_of_birth),
    assets: { employee_photo_path: '', signature_image_path: signature ? '' : undefined },
    meta: { created_from: 'custom-tools/id-generator', intended_use: 'internal_company_badge' },
  };
}
export function normalizeEmployee(input: Record<string, unknown>, defaults: Partial<typeof EMPLOYEE_DEFAULTS> = {}) {
  const form = { ...EMPLOYEE_DEFAULTS, ...defaults };
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('employee must be an object.');
  for (const key of Object.keys(form) as (keyof typeof form)[]) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== typeof form[key] || (typeof value === 'string' && (value.length > 100 || /[\x00-\x1f]/.test(value)))) throw Error(`Invalid ${key}.`);
    (form as any)[key] = typeof value === 'string' ? value.trim() : value;
  }
  if (!['NL','DE','OTHER'].includes(form.country) || !['id_card','passport'].includes(form.doc_type)) throw Error('Choose NL, DE or OTHER and id_card or passport.');
  for(const key of ['first_name','last_name','company_name','department','city_of_birth','company_location'] as const) if(form[key].length>50) throw Error(`${key} must be at most 50 characters.`);
  if(input.city_of_birth && input.company_location === undefined)form.company_location=form.city_of_birth;
  const preset = getCountryPreset(form.country);
  for (const [key, val] of Object.entries({issuer_code: preset.issuerCode, nationality_code: preset.nationalityCode, country_of_birth: preset.nationalityDemonym})) {
    if ((input.country || defaults.country) && input[key] === undefined) (form as any)[key] = val;
  }
  const iso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0,10) === s;
  if (!form.valid_from) form.valid_from = new Date().toISOString().slice(0,10);
  for (const key of ['birth_date','valid_from'] as const) if (!iso(form[key])) throw Error(`${key} must be a real ISO date.`);
  const maxYears = validityYearsForHolder(form.birth_date, form.valid_from, preset.maxValidityYears);
  if (!form.expires) form.expires = defaultExpiry(form.valid_from, maxYears);
  if (!iso(form.expires) || form.birth_date >= form.valid_from || form.expires <= form.valid_from) throw Error('Check birth and validity dates.');
  const expiry = clampExpiry(form.valid_from, form.expires, maxYears); if (!expiry.ok) throw Error(expiry.message);
  const era = eraForModel(pickPrimaryModelSeries({family: form.doc_type === 'passport' ? 'passport' : 'identity_card', issueDate: form.valid_from}));
  if (!form.doc_number) form.doc_number = form.country === 'DE' ? generateGermanTravelDocumentNumber() : generateDutchTravelDocumentNumber(era);
  const docValid = form.country === 'NL' ? validateDutchTravelDocumentNumber(form.doc_number, era).status === 'valid' : form.country === 'DE' ? validateGermanTravelDocumentNumber(form.doc_number).status === 'valid' : /^[A-Z0-9<]{1,9}$/i.test(form.doc_number);
  if (!docValid) throw Error('Document number does not match the selected format. Leave it empty to generate one.');
  if (!form.personal_number) form.personal_number = preset.personalNumber.generate();
  const personalError = preset.personalNumber.validate(form.personal_number); if (personalError) throw Error(personalError);
  if (input.height_cm !== undefined) {
    const cm = input.height_cm; if (!Number.isInteger(cm) || Number(cm) < 140 || Number(cm) > 210) throw Error('height_cm must be 140–210.');
    form.height = `${Math.floor(Number(cm)/100)},${String(Number(cm)%100).padStart(2,'0')} m`;
  }
  if (!/^[12],[0-9]{2} m$/.test(form.height) || Number(form.height.replace(',','.').replace(' m','')) < 1.4 || Number(form.height.replace(',','.').replace(' m','')) > 2.1) throw Error('Height must be between 1,40 m and 2,10 m.');
  if (!['M','F','X'].includes(form.gender) || !['png','pdf','psd'].includes(form.export_format) || !['auto','td1','td3'].includes(form.mrz_format) || form.mrz_method !== 'icao9303') throw Error('Invalid gender, export format or MRZ mode.');
  if (!/^[A-Z<]{3}$/.test(form.issuer_code) || !/^[A-Z<]{3}$/.test(form.nationality_code)) throw Error('Issuer/nationality must be three MRZ letters/fillers.');
  const errors = validateEmployeeFields({...form,birth_year: calculateBirthYear(form.birth_date)}); if (errors.length) throw Error(errors[0].message);
  return form;
}
