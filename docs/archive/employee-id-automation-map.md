Project: EmployeeID.psd

I need a clear automation backbone for a layered PSD template that will be controlled through Photopea/API automation and connected to my Figma project AI.

The main PSD file is called:

EmployeeID.psd

The main project contains groups. Inside these groups are layers, and several of these layers are Smart Objects. When opened, these Smart Objects contain their own PSD files and internal layers.

The automation needs to support editing:
1. Text and image layers directly inside the main EmployeeID.psd file
2. Nested layers inside Smart Object PSD files
3. Uploaded images that must be placed, replaced, scaled, and positioned correctly

The goal is to create a clean field-mapping structure so all editable values can be connected to an automatic content setup.

Important:
- Keep all existing group names, layer names, and PSD file names exactly as listed
- Do not flatten or rasterize editable layers
- Preserve Smart Object structure
- Use the listed layer names as the source of truth for automation
- Uploaded images must stay inside the correct Smart Object/layer area
- The final structure should work with Photopea/API automation

MAIN FILE
EmployeeID.psd


GROUP: Signature

Layer:
Signature

Smart Object opened by this layer:
SIGNATURE.psd

Purpose:
This layer should contain the uploaded signature image.

Automation requirements:
- Allow the signature image to be uploaded
- Place the uploaded signature inside the Signature layer / SIGNATURE.psd structure
- Allow the signature to be scaled and positioned correctly
- Preserve the original Smart Object structure


GROUP: DublePhoto

Layer:
SMALLDATE

Smart Object opened by this layer:
SMALLDATE.PSD

Internal layers inside SMALLDATE.PSD:
LAST_2_DIGITS
FIRST_2_DIGITS

Purpose:
This Smart Object is used to split a birth year into two parts.

Example:
Birth year: 1969

Automation logic:
- Split 1969 into:
  - FIRST_2_DIGITS = 19
  - LAST_2_DIGITS = 69
- Insert each value into the correct internal text layer inside SMALLDATE.PSD


Layer:
SMALL_PHOTO

Smart Object opened by this layer:
SMALL_PHOTO.psd

Internal image layer:
SMALL_IMAGE_1

Purpose:
This Smart Object should contain the uploaded photo in the smaller photo area.

Automation requirements:
- Use the provided uploaded image
- Place the image into the SMALL_PHOTO layer in the main project
- If needed, open SMALL_PHOTO.psd and replace or overlay the image on SMALL_IMAGE_1
- Keep the image positioned correctly inside the existing layout


GROUP: Photo

Layers:
BIG_DATE_1
BIG_DATE_2

Purpose:
These are main-project text layers that should be filled with the year of birth as a number.

Automation requirements:
- Fill BIG_DATE_1 with the year of birth
- Fill BIG_DATE_2 with the year of birth
- Keep the text styling and position unchanged


Nested group inside Photo:
MAIN_PHOTO

Layer inside MAIN_PHOTO:
BIG_PHOTO

Smart Object opened by this layer:
BIG_PHOTO.psd

Internal image layer:
BIG_IMAGE_1

Purpose:
This Smart Object should contain the uploaded main photo.

Automation requirements:
- Use the provided uploaded image
- Open BIG_PHOTO.psd through the BIG_PHOTO Smart Object
- Add the uploaded image or replace BIG_IMAGE_1
- Keep the image positioned correctly inside the existing frame/mask/layout
- Preserve the Smart Object structure


GROUP: PERFO

Layers:
PERFO1
PERFO2
PERFO3

Smart Object opened by each layer:
PERFO.psd

Internal structure:
PERFO.psd contains 6 separate text lines.
Each line contains 1 number.

Purpose:
Each PERFO layer should display a vertical 6-digit value in the format MMYYYY.

Example:
August 1966 = 081966

Automation logic:
- Convert the month and year into a 6-digit MMYYYY value
- Example: August 1966 becomes 081966
- Place each digit into the correct vertical text line inside PERFO.psd
- Keep one number per line
- Preserve the exact vertical placement and existing formatting

Important for PERFO layers:
- PERFO1, PERFO2, and PERFO3 all open PERFO.psd
- The automation should treat PERFO1, PERFO2, and PERFO3 as separate editable targets if their values need to be different
- If they must be independent, they should be separate Smart Object copies, not shared linked duplicates


GROUP: Text

Layer:
Text

Smart Object opened by this layer:
MRZ.psd

Purpose:
This is the original mapped text file that already works correctly in the Figma file.

Automation requirements:
- Keep the existing MRZ.psd mapping intact
- Preserve the current layer structure
- Do not redesign or remap this section unless required
- Use the existing Figma mapping as the source of truth


REQUIRED OUTPUT FROM THE AI

Please create a clear automation backbone for this PSD project that includes:

1. A full layer map
2. A list of all main-project editable layers
3. A list of all Smart Object layers
4. A list of all nested PSD files
5. A list of all nested editable layers inside each Smart Object
6. A JSON field structure for connecting form inputs/uploads to PSD layers
7. A Photopea/API automation plan for opening Smart Objects and updating nested layers
8. A clear explanation of how uploaded images should be inserted and positioned
9. A clear explanation of how split fields should be handled
10. A clean naming and mapping system that keeps all existing file and layer names unchanged


EXPECTED FIELD INPUTS

The automation should support these input values:

- signature_image
- uploaded_photo
- birth_year
- birth_month
- birth_month_year
- first_2_digits
- last_2_digits
- big_date_1
- big_date_2
- perfo1_value
- perfo2_value
- perfo3_value
- text_mapping_values


EXPECTED IMAGE TARGETS

signature_image:
- Main layer: Signature
- Smart Object: SIGNATURE.psd

uploaded_photo:
- Main small photo layer: SMALL_PHOTO
- Smart Object: SMALL_PHOTO.psd
- Internal target layer: SMALL_IMAGE_1

uploaded_photo:
- Main big photo layer: BIG_PHOTO
- Smart Object: BIG_PHOTO.psd
- Internal target layer: BIG_IMAGE_1


EXPECTED TEXT TARGETS

birth_year:
- Main layer: BIG_DATE_1
- Main layer: BIG_DATE_2

birth_year split:
- Smart Object: SMALLDATE.PSD
- FIRST_2_DIGITS
- LAST_2_DIGITS

birth_month_year / MMYYYY:
- Smart Object: PERFO.psd
- Used by PERFO1, PERFO2, PERFO3
- Format: MMYYYY
- Example: 081966
- One digit per text line

text_mapping_values:
- Smart Object: MRZ.psd
- Existing Figma mapping should stay unchanged


FINAL GOAL

The final system should allow one structured input form or JSON object to automatically update EmployeeID.psd through Photopea/API automation.

The automation should:
- Load EmployeeID.psd
- Update main-project text layers
- Open Smart Objects where needed
- Update nested text layers
- Replace or overlay uploaded images in the correct Smart Objects
- Preserve all layer positioning, styling, masks, and Smart Object structure
- Export the completed result as a final image or PSD