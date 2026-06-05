/**
 * Badge Data Mapping - Single Source of Truth
 *
 * This file defines the canonical data model for Internal Employee Badge Studio
 * and maps it to EmployeeID.psd Photoshop layer targets.
 *
 * Data flow:
 * Frontend form → BadgeJobPayload → badgeMapping → Worker input.json → EmployeeID.psd layers
 */

import { formatGenderForDocument } from './genderFormat';

/* ============================================================================
 * Field Definitions
 * ========================================================================== */

export interface BadgeFieldDefinition {
  label: string;
  required: boolean;
  type: 'text' | 'date' | 'number' | 'select';
  placeholder?: string;
  maxLength?: number;
  pattern?: RegExp;
  example: string;
  description: string;
  options?: { value: string; label: string }[];
}

export interface PSDLayerTarget {
  layerName: string;
  layerPath: string;
  formatFunction?: (value: string) => string;
  description: string;
}

/* ============================================================================
 * Company Fields
 * ========================================================================== */

export const COMPANY_FIELDS: Record<string, BadgeFieldDefinition> = {
  company_name: {
    label: 'Company Name',
    required: true,
    type: 'text',
    placeholder: 'Acme Corporation',
    maxLength: 50,
    example: 'Acme Corporation',
    description: 'Official company name',
  },
  issuer_code: {
    label: 'Issuer Code',
    required: true,
    type: 'text',
    placeholder: 'NLD',
    maxLength: 10,
    example: 'NLD',
    description: 'Company issuer code (e.g., country code)',
  },
  department: {
    label: 'Department',
    required: false,
    type: 'text',
    placeholder: 'Engineering',
    maxLength: 50,
    example: 'Engineering',
    description: 'Department or team name',
  },
};

/* ============================================================================
 * Employee Fields
 * ========================================================================== */

export const EMPLOYEE_FIELDS: Record<string, BadgeFieldDefinition> = {
  first_name: {
    label: 'First Name',
    required: true,
    type: 'text',
    placeholder: 'Mila',
    maxLength: 50,
    example: 'Mila',
    description: 'Employee first name',
  },
  last_name: {
    label: 'Last Name',
    required: true,
    type: 'text',
    placeholder: 'De Vries',
    maxLength: 50,
    example: 'De Vries',
    description: 'Employee last name',
  },
  doc_number: {
    label: 'Document Number',
    required: true,
    type: 'text',
    placeholder: 'AB12C34D5',
    maxLength: 20,
    example: 'AB12C34D5',
    description: 'Internal document number',
  },
  personal_number: {
    label: 'Personal Number',
    required: true,
    type: 'text',
    placeholder: '123456789',
    maxLength: 20,
    example: '123456789',
    description: 'Internal personal identifier',
  },
  valid_from: {
    label: 'Valid From',
    required: true,
    type: 'date',
    example: '06/14/2020',
    description: 'Badge validity start date',
  },
  expires: {
    label: 'Expires',
    required: true,
    type: 'date',
    example: '06/14/2030',
    description: 'Badge expiration date',
  },
  birth_date: {
    label: 'Birth Date',
    required: true,
    type: 'date',
    example: '06/14/1990',
    description: 'Employee birth date',
  },
  birth_year: {
    label: 'Birth Year',
    required: true,
    type: 'text',
    placeholder: '1990',
    maxLength: 4,
    pattern: /^\d{4}$/,
    example: '1990',
    description: 'Birth year (auto-calculated from birth_date)',
  },
  gender: {
    label: 'Gender',
    required: true,
    type: 'select',
    example: 'Female',
    description: 'Employee gender',
    options: [
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
      { value: 'Other', label: 'Other' },
    ],
  },
  height: {
    label: 'Height',
    required: false,
    type: 'text',
    placeholder: '1,72 m',
    maxLength: 20,
    example: '1,72 m',
    description: 'Employee height (e.g., 1,72 m)',
  },
  country_of_birth: {
    label: 'Country of Birth',
    required: false,
    type: 'text',
    placeholder: 'Nederlandse',
    maxLength: 50,
    example: 'Nederlandse',
    description: 'Country of birth',
  },
  city_of_birth: {
    label: 'City of Birth',
    required: false,
    type: 'text',
    placeholder: 'Zoetermeer',
    maxLength: 50,
    example: 'Zoetermeer',
    description: 'City of birth',
  },
  company_location: {
    label: 'Company Location',
    required: false,
    type: 'text',
    placeholder: 'Burg. van Zoetermeer',
    maxLength: 50,
    example: 'Burg. van Zoetermeer',
    description: 'Company office location',
  },
  // Optional override fields — if omitted, the worker auto-generates from
  // doc_number, birth_date, expires, gender, name, etc.
  mrz: {
    label: 'MRZ (override)',
    required: false,
    type: 'text',
    maxLength: 120,
    example: '',
    description: 'Optional 3-line MRZ override. Auto-generated by the worker if blank.',
  },
  perfo_string: {
    label: 'PERFO String (override)',
    required: false,
    type: 'text',
    maxLength: 6,
    pattern: /^\d{6}$/,
    example: '061990',
    description: 'Optional MMYYYY override. Auto-derived from birth_date if blank.',
  },
};

/* ============================================================================
 * PSD Layer Mapping
 * ========================================================================== */

/**
 * PSD layer paths reflect the ACTUAL EmployeeID.psd structure (text layers live
 * inside the `Text/Text Edit` smart object, photo at `DublePhoto/SMALL_PHOTO`).
 * The worker's run_employeeid_job.jsx auto-detects backbone vs embedded mode,
 * so these paths are informational — the worker is the authority.
 */
export const PSD_LAYER_MAPPING: Record<string, PSDLayerTarget> = {
  first_name: {
    layerName: 'FIRST',
    layerPath: 'Text/Text Edit/FIRST',
    description: 'Employee first name text layer',
  },
  last_name: {
    layerName: 'LAST',
    layerPath: 'Text/Text Edit/LAST',
    description: 'Employee last name text layer',
  },
  doc_number: {
    layerName: 'DOCNMBR',
    layerPath: 'Text/Text Edit/DOCNMBR',
    description: 'Document number text layer',
  },
  personal_number: {
    layerName: 'CODE',
    layerPath: 'Text/Text Edit/CODE',
    description: 'Personal number text layer',
  },
  expires: {
    layerName: 'ENDVALID',
    layerPath: 'Text/Text Edit/ENDVALID',
    description: 'Expiration date text layer',
  },
  valid_from: {
    layerName: 'VALID',
    layerPath: 'Text/Text Edit/VALID',
    description: 'Valid from date text layer',
  },
  birth_date: {
    layerName: 'BIRTHDATE',
    layerPath: 'Text/Text Edit/BIRTHDATE',
    description: 'Birth date text layer',
  },
  birth_year: {
    layerName: 'YEAR',
    layerPath: 'Text/Text Edit/YEAR',
    description: 'Birth year text layer (also split across BIG_DATE_1/2 + SMALLDATE)',
  },
  gender: {
    layerName: 'GENDER',
    layerPath: 'Text/Text Edit/GENDER',
    description: 'Gender text layer',
  },
  height: {
    layerName: 'HEIGHT',
    layerPath: 'Text/Text Edit/HEIGHT',
    description: 'Height text layer',
  },
  country_of_birth: {
    layerName: 'COUNTRY',
    layerPath: 'Text/Text Edit/COUNTRY',
    description: 'Country of birth text layer',
  },
  city_of_birth: {
    layerName: 'CITYBIRTH',
    layerPath: 'Text/Text Edit/CITYBIRTH',
    description: 'City of birth text layer',
  },
  company_location: {
    layerName: 'LOCATION',
    layerPath: 'Text/Text Edit/LOCATION',
    description: 'Company location text layer',
  },
  mrz: {
    layerName: 'MRZ',
    layerPath: 'Text/Text Edit/MRZ',
    description: '3-line internal MRZ text (auto-generated by worker if omitted)',
  },
  perfo_string: {
    layerName: 'PERFO_STRING',
    layerPath: 'PERFO/PERFO1..3',
    description: 'MMYYYY birth month+year, split vertically across 3 PERFO smart objects (auto-generated)',
  },
};

/**
 * Smart-object (image) targets in the real PSD.
 * Single standardized photo slot at SMALL_PHOTO (2421 × 3292 px).
 */
export const PSD_SMART_OBJECT_MAPPING = {
  employee_photo: {
    layerName: 'SMALL_PHOTO',
    layerPath: 'DublePhoto/SMALL_PHOTO',
    width: 2421,
    height: 3292,
    description: 'Standardized employee photo (replaces legacy MAIN_PHOTO)',
  },
  signature_image: {
    layerName: 'Signature',
    layerPath: 'Signature/Signature',
    description: 'Employee signature smart object',
  },
} as const;

/* ============================================================================
 * Value Calculation Functions
 * ========================================================================== */

/**
 * Calculate birth year from birth date
 */
export function calculateBirthYear(birthDate: string): string {
  if (!birthDate) return '';
  const date = new Date(birthDate);
  return date.getFullYear().toString();
}

/**
 * Format date from YYYY-MM-DD to MM/DD/YYYY
 */
export function formatDateMMDDYYYY(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/* ============================================================================
 * Payload to Photoshop Input Converter
 * ========================================================================== */

export interface PhotoshopInput {
  job_id: string;
  template: string;
  company: {
    company_name: string;
    issuer_code: string;
    department: string;
  };
  employee: {
    first_name: string;
    last_name: string;
    doc_number: string;
    personal_number: string;
    expires: string;
    valid_from: string;
    birth_date: string;
    birth_year: string;
    gender: string;
    height: string;
    country_of_birth: string;
    city_of_birth: string;
    company_location: string;
  };
  psdTextTargets: Record<string, string>;
  images: {
    photo_path: string;
    signature_path: string;
  };
  export_format: string;
}

/**
 * Convert BadgeJobPayload to Photoshop input.json structure
 */
export function convertToPhotoshopInput(
  jobId: string,
  payload: any
): PhotoshopInput {
  // Calculate birth year from birth date
  const birthYear = calculateBirthYear(payload.birth_date);

  // Format dates
  const formattedValidFrom = formatDateMMDDYYYY(payload.valid_from);
  const formattedExpires = formatDateMMDDYYYY(payload.expires);
  const formattedBirthDate = formatDateMMDDYYYY(payload.birth_date);

  // Country/document-specific visible gender (NL: M/M, V/F, X/X — DE passport:
  // M/F/X — DE ID card: "" so no GENDER layer is rendered).
  const visibleGender =
    payload.country === 'NL' || payload.country === 'DE'
      ? formatGenderForDocument({
          country: payload.country,
          documentType: payload.doc_type === 'passport' ? 'passport' : 'id_card',
          gender: payload.gender,
          target: 'visible',
        })
      : payload.gender || '';

  return {
    job_id: jobId,
    template: payload.template || 'EmployeeID.psd',
    company: {
      company_name: payload.company_name || '',
      issuer_code: payload.issuer_code || '',
      department: payload.department || '',
    },
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
    psdTextTargets: {
      FIRST: payload.first_name || '',
      LAST: payload.last_name || '',
      DOCNMBR: payload.doc_number || '',
      CODE: payload.personal_number || '',
      ENDVALID: formattedExpires,
      VALID: formattedValidFrom,
      BIRTHDATE: formattedBirthDate,
      YEAR: birthYear,
      GENDER: visibleGender,
      HEIGHT: payload.height || '',
      COUNTRY: payload.country_of_birth || '',
      CITYBIRTH: payload.city_of_birth || '',
      LOCATION: payload.company_location || '',
    },
    images: {
      photo_path: payload.assets?.employee_photo_path || '',
      signature_path: payload.assets?.signature_image_path || '',
    },
    export_format: payload.export_format || 'png',
  };
}

/* ============================================================================
 * Validation
 * ========================================================================== */

export interface FieldValidationError {
  field: string;
  message: string;
}

/**
 * Validate all required employee fields
 */
export function validateEmployeeFields(
  data: Record<string, any>
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  // Validate company fields
  for (const [key, def] of Object.entries(COMPANY_FIELDS)) {
    if (def.required && !data[key]?.trim()) {
      errors.push({ field: key, message: `${def.label} is required` });
    }
  }

  // Validate employee fields
  for (const [key, def] of Object.entries(EMPLOYEE_FIELDS)) {
    if (def.required && !data[key]?.trim()) {
      errors.push({ field: key, message: `${def.label} is required` });
    }

    // Pattern validation
    if (def.pattern && data[key] && !def.pattern.test(data[key])) {
      errors.push({
        field: key,
        message: `${def.label} format is invalid`,
      });
    }
  }

  // Date range validation
  if (data.valid_from && data.expires) {
    const from = new Date(data.valid_from);
    const expires = new Date(data.expires);
    if (expires <= from) {
      errors.push({
        field: 'expires',
        message: 'Expiration date must be after valid from date',
      });
    }
  }

  return errors;
}

/**
 * Get all field definitions (company + employee)
 */
export function getAllFieldDefinitions(): Record<
  string,
  BadgeFieldDefinition
> {
  return {
    ...COMPANY_FIELDS,
    ...EMPLOYEE_FIELDS,
  };
}

/**
 * Get example badge data for testing
 */
export function getExampleBadgeData(): Record<string, string> {
  const allFields = getAllFieldDefinitions();
  const example: Record<string, string> = {};

  for (const [key, def] of Object.entries(allFields)) {
    example[key] = def.example;
  }

  return example;
}
