# EmployeeID.psd — Automation Backbone

Reference spec for a Figma / Photopea automation that fills `EmployeeID.psd`
end-to-end. Hand this whole document to another AI; everything it needs to wire
inputs → layers (including nested smart objects) is in here.

---

## 1. File tree (smart-object nesting)

```
EmployeeID.psd                                  ← main / outer document
├── Group: Signature
│   └── Layer: Signature                        [SMART OBJECT → SIGNATURE.psd]
│       └── (image layer)                       ← user-uploaded signature
│
├── Group: DublePhoto
│   ├── Layer: SMALLDATE                        [SMART OBJECT → SMALLDATE.psd]
│   │   ├── Text layer: FIRST_2_DIGITS          ← first 2 digits of birth year
│   │   └── Text layer: LAST_2_DIGITS           ← last 2 digits of birth year
│   └── Layer: SMALL_PHOTO                      [SMART OBJECT → SMALL_PHOTO.psd]
│       └── Image layer: SMALL_IMAGE_1          ← user-uploaded small photo
│
├── Group: Photo
│   ├── Text layer: BIG_DATE_1                  ← full birth year (e.g. 1966)
│   ├── Text layer: BIG_DATE_2                  ← full birth year (e.g. 1966)
│   └── Group: MAIN_PHOTO
│       └── Layer: BIG_PHOTO                    [SMART OBJECT → BIG_PHOTO.psd]
│           └── Image layer: BIG_IMAGE_1        ← user-uploaded main photo
│
├── Group: PERFO
│   ├── Layer: PERFO1                           [SMART OBJECT → PERFO.psd]
│   ├── Layer: PERFO2                           [SMART OBJECT → PERFO.psd]
│   └── Layer: PERFO3                           [SMART OBJECT → PERFO.psd]
│       └── 6 text layers, one digit each       ← MMYYYY split into 6 chars
│
└── Group: Text
    └── Layer: Text                             [SMART OBJECT → MRZ.psd]
        └── (already mapped in Figma — pass MRZ string through unchanged)
```

All three `PERFO*` layers reference the **same** `PERFO.psd` smart object —
when you write into it once, all three instances on the main canvas update.

---

## 2. Input data model

The AI receives one flat object. Everything else is derived.

```jsonc
{
  "birthDate":    "1966-08-14",   // ISO YYYY-MM-DD
  "signature":    "<file>",       // PNG/JPG, transparent bg preferred
  "smallPhoto":   "<file>",       // square-ish portrait
  "bigPhoto":     "<file>",       // main portrait
  "mrz":          "I<NLD...\\n...\\n...",   // 3 lines, pre-built
  "signaturePosition": { "x": 0, "y": 0, "scale": 1.0, "rotation": 0 }  // optional
}
```

The AI does NOT receive pre-split digits — it derives them from `birthDate`.

---

## 3. Derived values (compute before sending to Photopea)

| Output token       | Source                       | Example (birthDate = 1966-08-14) |
| ------------------ | ---------------------------- | -------------------------------- |
| `YEAR_FULL`        | `birthDate.slice(0,4)`       | `1966`                           |
| `YEAR_FIRST2`      | `birthDate.slice(0,2)`       | `19`                             |
| `YEAR_LAST2`       | `birthDate.slice(2,4)`       | `66`                             |
| `MONTH_MM`         | `birthDate.slice(5,7)`       | `08`                             |
| `PERFO_STRING`     | `MONTH_MM + YEAR_FULL`       | `081966`                         |
| `PERFO_DIGITS[6]`  | `PERFO_STRING.split("")`     | `["0","8","1","9","6","6"]`      |

`PERFO_STRING` is **always 6 characters** (2-digit month, 4-digit year).
Validate at input boundary; pad month with leading zero if needed.

---

## 4. Layer ↔ value mapping (the table the automation reads)

Each row = one Photopea job. The `path` is the smart-object chain to descend
into; the executor opens nested smart objects in order before applying `op`.

| #  | Path                                                       | Layer name        | Type    | Op            | Value                          |
| -- | ---------------------------------------------------------- | ----------------- | ------- | ------------- | ------------------------------ |
| 1  | `Signature › Signature.psd`                                | (image)           | image   | replace+pos   | `signature` (+ position xform) |
| 2  | `DublePhoto › SMALLDATE.psd`                               | `FIRST_2_DIGITS`  | text    | setContents   | `YEAR_FIRST2`                  |
| 3  | `DublePhoto › SMALLDATE.psd`                               | `LAST_2_DIGITS`   | text    | setContents   | `YEAR_LAST2`                   |
| 4  | `DublePhoto › SMALL_PHOTO.psd`                             | `SMALL_IMAGE_1`   | image   | replace       | `smallPhoto`                   |
| 5  | `Photo`                                                    | `BIG_DATE_1`      | text    | setContents   | `YEAR_FULL`                    |
| 6  | `Photo`                                                    | `BIG_DATE_2`      | text    | setContents   | `YEAR_FULL`                    |
| 7  | `Photo › MAIN_PHOTO › BIG_PHOTO.psd`                       | `BIG_IMAGE_1`     | image   | replace       | `bigPhoto`                     |
| 8  | `PERFO › PERFO.psd` (write once, propagates to 1/2/3)      | line 1            | text    | setContents   | `PERFO_DIGITS[0]`              |
| 9  | `PERFO › PERFO.psd`                                        | line 2            | text    | setContents   | `PERFO_DIGITS[1]`              |
| 10 | `PERFO › PERFO.psd`                                        | line 3            | text    | setContents   | `PERFO_DIGITS[2]`              |
| 11 | `PERFO › PERFO.psd`                                        | line 4            | text    | setContents   | `PERFO_DIGITS[3]`              |
| 12 | `PERFO › PERFO.psd`                                        | line 5            | text    | setContents   | `PERFO_DIGITS[4]`              |
| 13 | `PERFO › PERFO.psd`                                        | line 6            | text    | setContents   | `PERFO_DIGITS[5]`              |
| 14 | `Text › MRZ.psd`                                           | (existing layer)  | text    | passthrough   | `mrz`                          |

### PERFO line identification

Inside `PERFO.psd` the 6 text layers are stacked vertically, one digit each, in
the existing template. The automation must identify them in **top-to-bottom
visual order** (sort by layer bounds `top` ascending). The literal layer names
in the template may be `1` / `2` / `3` / `4` / `5` / `6` or non-semantic — do
not depend on the name, depend on vertical order.

### Smart-object overrides propagate

Because `PERFO1`, `PERFO2`, `PERFO3` are **three placed instances of the same
linked smart object**, editing `PERFO.psd` once updates all three on the main
canvas. Do not try to edit each instance separately — that desyncs them.

---

## 5. Photopea automation flow

For every export the automation does the following, in order:

```
1. Compute derived values (§3) from the input object.
2. Open EmployeeID.psd in Photopea (postMessage ArrayBuffer).
3. For each smart-object subdoc that needs edits:
     a. Locate the placed smart-object layer in the parent doc.
     b. Right-click → Edit Contents (Photopea: openSmartObject / executeAction).
        Photopea opens the inner PSD as a separate document tab.
     c. Apply the jobs from §4 that target this subdoc.
     d. Save (Ctrl+S) — Photopea writes the changes back into the parent's
        smart-object container.
     e. Close the subdoc tab.
4. Apply the jobs in §4 targeting the main doc itself (BIG_DATE_1/2).
5. saveToOE("psd:true,true,true")  → return ArrayBuffer to the host.
6. Host downloads as `EmployeeID-<id>.psd`.
```

### Photopea API specifics

- Posting an ArrayBuffer to the Photopea iframe **opens** that file.
- Posting a string runs it as an ExtendScript-flavoured script.
- `app.echoToOE("...")` sends progress strings back; emit `CARD_STATUS:` /
  `CARD_ERROR:` prefixes so the host can route them.
- `app.activeDocument.saveToOE("psd:true,true,true")` returns the bytes for the
  download.
- After each command Photopea posts the literal string `"done"`. The host
  awaits one `"done"` per command in order.

### Opening a smart object via script

```js
// Select the placed smart-object layer first.
function openSmartObject(name){
  var doc = app.activeDocument;
  doc.activeLayer = doc.artLayers.getByName(name)
    || findLayerRecursive(doc, name);
  app.runMenuItem(stringIDToTypeID("placedLayerEditContents"));
  // After this call, app.activeDocument is the inner PSD.
}
function saveAndCloseSubdoc(){
  app.activeDocument.save();          // writes back to parent's smart object
  app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
}
```

### Image replacement inside a smart object

For `SMALL_IMAGE_1`, `BIG_IMAGE_1`, signature image:

1. Open the smart object subdoc (as above).
2. Find the target image layer by name.
3. Replace by either:
   - **Place** the new file on top with `app.open(new File(...))` then drag the
     pixels onto the existing layer; OR
   - Delete the existing layer and `app.open` the new image, then move it into
     the doc preserving the original layer's transform.
4. Apply the saved transform from `signaturePosition` (signature only).
5. Save the subdoc.

The image-layer **bounds** of the original (`left/top/right/bottom`) are the
canonical "where the photo goes" — match them exactly so the parent doc
doesn't shift.

---

## 6. Naming contract (must match the PSD exactly)

The automation should resolve layers by **exact name**, case-sensitive, with
this fallback chain for resilience:

1. Exact name match in the current doc.
2. Recursive descent into groups (LayerSet) with exact name match.
3. (For PERFO digit lines only) sort by `bounds.top` ascending and bind by
   index.

Group names: `Signature`, `DublePhoto`, `Photo`, `MAIN_PHOTO`, `PERFO`, `Text`.
Smart-object layer names: `Signature`, `SMALLDATE`, `SMALL_PHOTO`, `BIG_PHOTO`,
`PERFO1`, `PERFO2`, `PERFO3`, `Text`.
Inner text layers: `FIRST_2_DIGITS`, `LAST_2_DIGITS`, `BIG_DATE_1`,
`BIG_DATE_2`.
Inner image layers: `SMALL_IMAGE_1`, `BIG_IMAGE_1`.

If the template is later renamed, the only place to update is this section and
§4.

---

## 7. Text-rendering caveat (Photoshop ↔ Photopea)

Photopea caches the rasterized glyphs it produces. When the resulting PSD is
opened in Photoshop, text layers initially show Photopea's rasterization until
the user clicks them — at which point Photoshop re-renders with its own engine.

Mitigation inside the script: after `textItem.contents = value`, re-apply the
font, size, and leading so Photopea re-tessellates with the declared font:

```js
var ti = layer.textItem;
var f = ti.font, sz = ti.size, ld = ti.leading;
ti.contents = job.value;
try { ti.font = f; ti.size = sz; ti.leading = ld; } catch(e){}
```

Ensure all fonts used by `EmployeeID.psd` and its sub-PSDs are available in
Photopea's font catalog (upload custom `.ttf` / `.otf` first if not).

---

## 8. Failure modes the automation must handle

| Symptom                                  | Cause                                      | Fix                                                   |
| ---------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| Inner smart-object edits don't appear    | Subdoc closed without `save()`             | Always `save()` before close                          |
| PERFO instances out of sync              | Edited each instance separately            | Edit `PERFO.psd` once; let smart-link propagate       |
| Photopea returns "Missing layer X"       | Name mismatch                              | Verify against §6; case-sensitive                     |
| Year split shows `"19"` and `"66"` but BIG_DATE_1 is empty | Forgot main-doc pass after subdocs | Run §5 step 4 after closing all subdocs               |
| Fonts re-render on click in Photoshop    | Photopea caching (see §7)                  | Re-apply font/size/leading; preload fonts             |
| Photo replaced but mis-positioned        | New image bounds ≠ original layer bounds   | Snap to original `bounds`, then re-scale to fit       |

---

## 9. Minimal job JSON the host sends to the automation

```jsonc
{
  "template": "EmployeeID.psd",
  "subdocs": [
    {
      "smartObject": "Signature",
      "jobs": [
        { "op": "replaceImage", "target": "<layer-name-of-existing-image>",
          "asset": "signature", "transform": { "x":0,"y":0,"scale":1,"rotation":0 } }
      ]
    },
    {
      "smartObject": "SMALLDATE",
      "jobs": [
        { "op": "setText", "target": "FIRST_2_DIGITS", "value": "19" },
        { "op": "setText", "target": "LAST_2_DIGITS",  "value": "66" }
      ]
    },
    {
      "smartObject": "SMALL_PHOTO",
      "jobs": [{ "op": "replaceImage", "target": "SMALL_IMAGE_1", "asset": "smallPhoto" }]
    },
    {
      "smartObject": "BIG_PHOTO",
      "jobs": [{ "op": "replaceImage", "target": "BIG_IMAGE_1", "asset": "bigPhoto" }]
    },
    {
      "smartObject": "PERFO",
      "jobs": [
        { "op": "setText", "byOrder": 0, "value": "0" },
        { "op": "setText", "byOrder": 1, "value": "8" },
        { "op": "setText", "byOrder": 2, "value": "1" },
        { "op": "setText", "byOrder": 3, "value": "9" },
        { "op": "setText", "byOrder": 4, "value": "6" },
        { "op": "setText", "byOrder": 5, "value": "6" }
      ]
    },
    {
      "smartObject": "Text",
      "jobs": [{ "op": "passthrough", "asset": "mrz" }]
    }
  ],
  "mainDoc": {
    "jobs": [
      { "op": "setText", "target": "BIG_DATE_1", "value": "1966" },
      { "op": "setText", "target": "BIG_DATE_2", "value": "1966" }
    ]
  }
}
```

This object is the **single source of truth** the Figma AI should produce from
its UI bindings. The Photopea executor consumes it without further
interpretation.
