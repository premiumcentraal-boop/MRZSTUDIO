```md
Update the Figma-hosted Internal Badge Studio website to support optional mockup generation.

Do not redesign the page. Do not change the worker. Do not add backend code or Edge Functions. This is only the browser → Supabase → worker bridge.

Feature goal:
Users can turn mockup generation on/off before submitting a badge job. If enabled, the website sends `generate_mockups: true` inside `input_json`. The local Windows worker reads that flag and, after generating the badge, creates three mockup JPEGs.

Supabase is already prepared with these columns on `badge_jobs`:
- `output_mockup_1_path`
- `output_mockup_2_path`
- `output_mockup_3_path`

Storage:
Mockups are uploaded by the worker to the private `badge-outputs` bucket:
- `{job_id}/mockup-1.jpg`
- `{job_id}/mockup-2.jpg`
- `{job_id}/mockup-3.jpg`

The website should download them using the existing Supabase signed URL download flow.

Required frontend changes:

1. Extend the job payload type

Find the type/interface for the job payload sent to Supabase, likely called `BadgeJobPayload`.

Add:

```ts
generate_mockups?: boolean;
```

Example:

```ts
export interface BadgeJobPayload {
  template: string;

  company_name: string;
  issuer_code: string;
  department?: string;

  first_name: string;
  last_name: string;
  doc_number: string;
  personal_number: string;
  valid_from: string;
  expires: string;
  birth_date: string;
  birth_year: string;
  gender: string;
  height?: string;
  country_of_birth?: string;
  city_of_birth?: string;
  company_location?: string;

  export_format: "png" | "pdf" | "psd";

  generate_mockups?: boolean;

  assets: {
    employee_photo_path: string;
    signature_image_path?: string;
  };

  meta: {
    created_from: string;
    intended_use: string;
  };
}
```

2. Extend the job row type

Find the type/interface for rows from `badge_jobs`, likely called `BadgeJob`.

Add:

```ts
output_mockup_1_path: string | null;
output_mockup_2_path: string | null;
output_mockup_3_path: string | null;
```

Example:

```ts
export interface BadgeJob {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  template: string;
  input_json: BadgeJobPayload;
  employee_photo_path: string;
  signature_image_path: string | null;

  output_png_path: string | null;
  output_pdf_path: string | null;
  output_psd_path: string | null;

  output_mockup_1_path: string | null;
  output_mockup_2_path: string | null;
  output_mockup_3_path: string | null;

  error_message: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}
```

3. Add form state

Find the form state object.

Add:

```ts
generate_mockups: false,
```

Example:

```ts
const [formData, setFormData] = useState({
  company_name: "",
  issuer_code: "",
  department: "",

  first_name: "",
  last_name: "",
  doc_number: "",
  personal_number: "",

  valid_from: "",
  expires: "",
  birth_date: "",
  gender: "",
  height: "",
  country_of_birth: "",
  city_of_birth: "",
  company_location: "",

  export_format: "png",

  generate_mockups: false,
});
```

4. Reset the field

Find the reset handler.

Add:

```ts
generate_mockups: false,
```

So reset returns the mockup option to off.

5. Add a simple toggle near Export Settings

Use the website’s existing checkbox, switch, slider, or toggle style. Do not invent new styling. Put it near the export format selector.

Logic:

```tsx
<label>
  <input
    type="checkbox"
    checked={formData.generate_mockups}
    onChange={(e) =>
      setFormData({
        ...formData,
        generate_mockups: e.target.checked,
      })
    }
  />
  Generate mockup images
</label>
```

If the site already has a switch component, use that instead of a raw checkbox.

6. Include the flag in the Supabase job payload

Find where `jobPayload` is created before inserting into `badge_jobs`.

Add:

```ts
generate_mockups: formData.generate_mockups,
```

Important:
This must be inside `input_json`, because the worker reads:

```ts
job.input_json.generate_mockups === true
```

Example:

```ts
const jobPayload: BadgeJobPayload = {
  template: "EmployeeID.psd",

  company_name: formData.company_name,
  issuer_code: formData.issuer_code,
  department: formData.department,

  first_name: formData.first_name,
  last_name: formData.last_name,
  doc_number: formData.doc_number,
  personal_number: formData.personal_number,

  valid_from: formData.valid_from,
  expires: formData.expires,
  birth_date: formData.birth_date,
  birth_year: birthYear,
  gender: formData.gender,
  height: formData.height,
  country_of_birth: formData.country_of_birth,
  city_of_birth: formData.city_of_birth,
  company_location: formData.company_location,

  export_format: formData.export_format,

  generate_mockups: formData.generate_mockups,

  assets: {
    employee_photo_path: photoPath,
    signature_image_path: signaturePath || undefined,
  },

  meta: {
    created_from: "custom-tools/id-generator",
    intended_use: "internal_company_badge",
  },
};
```

Then keep the insert pattern the same:

```ts
await supabase.from("badge_jobs").insert({
  status: "queued",
  template: "EmployeeID.psd",
  input_json: jobPayload,
  employee_photo_path: photoPath,
  signature_image_path: signaturePath || null,
});
```

Do not add a separate `generate_mockups` database column. It belongs in `input_json`.

7. Preserve retry behavior

Find the retry function that creates a new job from an old job.

Make sure it reuses the old `job.input_json`, including `generate_mockups`.

Example:

```ts
await supabase.from("badge_jobs").insert({
  status: "queued",
  template: job.template,
  input_json: job.input_json,
  employee_photo_path: job.employee_photo_path,
  signature_image_path: job.signature_image_path,
});
```

If the retry already does this, no change is needed.

8. Show mockup download buttons

Find the completed job download area.

Keep existing PNG/PDF/PSD buttons.

Add:

```tsx
{currentJob.output_mockup_1_path && (
  <SecondaryButton onClick={() => downloadResult(currentJob.output_mockup_1_path!)}>
    Download Mockup 1
  </SecondaryButton>
)}

{currentJob.output_mockup_2_path && (
  <SecondaryButton onClick={() => downloadResult(currentJob.output_mockup_2_path!)}>
    Download Mockup 2
  </SecondaryButton>
)}

{currentJob.output_mockup_3_path && (
  <SecondaryButton onClick={() => downloadResult(currentJob.output_mockup_3_path!)}>
    Download Mockup 3
  </SecondaryButton>
)}
```

Use the same button style and icon pattern as the existing download buttons.

9. Recent jobs table/list

If the recent jobs section only shows PNG download buttons, add mockup downloads there too when the paths exist.

At minimum:
- Completed jobs with `output_mockup_1_path` should have a way to download Mockup 1.
- Prefer showing all three if space allows.

10. Download logic

Use the existing `downloadResult(path)` function.

Mockups are normal JPEG files in `badge-outputs`, so they should work with the same signed URL logic:

```ts
const { data, error } = await supabase.storage
  .from("badge-outputs")
  .createSignedUrl(path, 60);

if (error) throw error;
if (data?.signedUrl) {
  window.open(data.signedUrl, "_blank");
}
```

Do not add special mockup download logic unless the existing function cannot handle arbitrary paths.

11. Mock mode, if present

If the site has mock/dev mode, add mockup paths when `generate_mockups` is true:

```ts
if (job.input_json.generate_mockups) {
  found.output_mockup_1_path = `mock/${job.id}/mockup-1.jpg`;
  found.output_mockup_2_path = `mock/${job.id}/mockup-2.jpg`;
  found.output_mockup_3_path = `mock/${job.id}/mockup-3.jpg`;
}
```

Acceptance tests:

Test A: mockups disabled
1. Turn off “Generate mockup images.”
2. Submit a job.
3. In Supabase, confirm:
   `badge_jobs.input_json.generate_mockups` is `false`
4. Worker should generate only normal badge output.
5. Website should not show mockup download buttons.

Test B: mockups enabled
1. Turn on “Generate mockup images.”
2. Submit a job.
3. In Supabase, confirm:
   `badge_jobs.input_json.generate_mockups` is `true`
4. When complete, Supabase row should contain:
   - `output_mockup_1_path`
   - `output_mockup_2_path`
   - `output_mockup_3_path`
5. Website should show:
   - Download Mockup 1
   - Download Mockup 2
   - Download Mockup 3
6. Clicking each should download/open the corresponding JPEG from `badge-outputs`.

Worker contract:
The worker already understands this flag:

```ts
job.input_json.generate_mockups === true
```

If true, it creates:
- `mockup-1.jpg`
- `mockup-2.jpg`
- `mockup-3.jpg`

and writes:
- `output_mockup_1_path`
- `output_mockup_2_path`
- `output_mockup_3_path`

Keep the implementation browser-only. No backend. No Edge Functions. No schema changes other than relying on the already-created mockup output columns.
```