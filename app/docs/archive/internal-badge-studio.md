Codex prompt — Internal Badge Studio: auto-unpack embedded subdocs + force proper font rendering in edited PSDs
Context
I'm building Internal Badge Studio, a browser-only React/TypeScript app hosted inside Figma Make (no backend, no server-side Photoshop). It generates a printable employee ID by editing a 76 MB Photoshop template called EmployeeID.psd. The template has 7 nested embedded smart objects, each its own PSD:

SMALLDATE.psd — text layers FIRST_2_DIGITS, LAST_2_DIGITS (birth year split into 19 / 90)
PERFO.psd — 6 vertically stacked text layers, one digit each (MMYYYY perforation code; referenced by 3 sibling smart-object hosts PERFO1/2/3)
MRZ.psd — 14 named text layers: DOCNMBR, FIRST, LAST, GENDER, COUNTRY, ENDVALID, VALID, BIRTHDATE, YEAR, CODE, CITYBIRTH, HEIGHT, MRZ, LOCATION
SIGNATURE.psd — single raster layer SIGNATURE_1 (signature image)
SMALL_PHOTO.psd — single raster layer SMALL_IMAGE_1 (small portrait)
BIG_PHOTO.psd — single raster layer BIG_IMAGE_1 (main portrait)
Parent doc also has 2 top-level text layers BIG_DATE_1, BIG_DATE_2 (birth year), which Photopea edits correctly because they're not nested.

What I've already tried and confirmed broken vs working
Working (verified through 20+ iterations of logs):

Top-level text edits in Photopea via textItem.contents = "..." + executeAction("setd") descriptor fallback. Edits commit and Photopea saves the PSD with the new text in the TySh/EngineData blocks.
Image paste flow into top-level docs: open image as separate doc, copy, close, paste onto target subdoc, snap to (0,0), remove old placeholder layer, save.
Multi-line MRZ (\n vs \r normalization fix prevents the descriptor-fallback hang).
Broken (Photopea bug — independently flagged by two prior reviewers):

Text edits inside nested smart objects (open parent → placedLayerEditContents → edit → save subdoc → save parent) appear to commit in logs but the parent's exported PSD still shows placeholder text. placedLayerConvertToEmbedded hangs Photopea indefinitely.
My current architecture (Option A1 — accepted approach)
Instead of fighting the nested-edit bug, I extract each embedded subdoc PSD from the parent's linkedFiles block (via ag-psd's psd.linkedFiles[i].data Uint8Array), then for each subdoc:

Force-reload Photopea iframe
Post subdoc PSD bytes → Photopea opens as top-level
Run an ExtendScript-flavored script via postMessage that finds layers by name (with normalized matching: case-insensitive, strip non-alphanumeric, with fallback alias lists) and writes new text via setText (high-level textItem.contents = ... with setd descriptor fallback)
Call app.activeDocument.saveToOE("psd") to get the edited PSD bytes back
closeAllDocs() and move to next subdoc
Bundle parent + all 7 edited subdoc PSDs into one folder inside a ZIP, with a README telling the user to open EmployeeID.psd in real Photoshop where the linked smart-objects auto-refresh from sibling files
Code lives entirely in /workspaces/default/code/src/app/App.tsx (~5800 lines). Key functions: exportSubdocBundle, autoExtractSubdocsFromParent, handleSubdocZipUpload. Helpers injected into every Photopea script: findLayerLoose, setText, collectTextLayers, closeAllDocs.

The two problems I need you to solve
Problem 1 — Auto-unpack input ZIP cleanly
Right now the user can drop either: (a) just EmployeeID.psd, in which case I auto-extract subdocs from psd.linkedFiles, OR (b) a ZIP containing the parent plus optional sibling subdoc PSDs that override the embedded ones. I want this to be bulletproof and self-explanatory:

If a ZIP contains the parent PSD: extract embedded subdocs from it AND let sibling files in the ZIP override per-slot (e.g. user dropped a hand-edited MRZ.psd alongside the parent — that one should win over the embedded copy).
The parent's linkedFiles sometimes has subdocs stored as external (linked, not embedded) — lf.data will be undefined. In that case I need to parse lnkD / lnk2 / lnk3 document-level image-resource blocks directly to get the bytes. Research the PSD binary spec for these blocks: their location in the resource section, the layout for each linked-file entry (UUID, type code "liFD"/"liFE"/"liFA", name, size, payload), and how to extract the embedded PSD payload bytes from a raw ArrayBuffer without ag-psd's help. Reference implementation we already trust: /workspaces/default/code/Card_Generator/card-psd-editor.js (1929 lines, proven binary patcher for TySh blocks). Look at how it parses image-resource blocks.
Problem 2 — Text in edited subdocs renders with the placeholder font, not the real font
This is the bigger problem. When Photopea writes new text into a top-level subdoc (e.g. MRZ.psd) and saves, the saved PSD's TySh descriptor contains the new string, BUT Photopea does not have the original font installed in its sandbox. Photoshop opens the saved subdoc and falls back to a substitute font (usually default sans), so the badge looks wrong even though the text content is correct. Symptoms in real Photoshop:

Yellow font-substitution warning triangle on each edited text layer
Layout breaks because substitute font has different metrics
"missing font" dialog when opening MRZ.psd standalone
The original fonts are real licensed fonts the user has installed locally on the machine that runs Photoshop. They are NOT installed in Photopea's sandbox and we cannot install them there (no admin access in Photopea's iframe).

The user explicitly wants the text to render with the correct local font when the bundle is opened in their Photoshop. They said: "I have to access the file to make sure it renders it properly using the fonts, otherwise it gets stuck on these placeholder fonts."

This is the core research question. Investigate every approach for forcing Photoshop to re-typeset text in a font Photopea doesn't have. Options to evaluate:

Preserve the original TySh font reference but only replace the EngineData string. When Photopea changes textItem.contents, it rewrites the entire TySh block including the FontSet array. If we could only patch the actual character string in EngineData while leaving the FontSet reference and font PostScript name intact, Photoshop would re-typeset with the original font on open. Look at how Card_Generator/card-psd-editor.js does its patchTySh and patchRunLengths (lines 440–500-ish). This is the most promising path — research whether this can be done after Photopea saves (post-process the saved subdoc PSD bytes in browser), or whether it requires NOT going through Photopea at all (pure binary patch on the original subdoc bytes).
Force Photopea to keep the font reference via some scripting hook before saving. Investigate Photopea's font handling internals — is there a way to set textItem.font to a font NAME string that doesn't exist in the Photopea font list? Does Photopea preserve unknown font references in the saved TySh, or does it substitute? Test by inspecting raw saved PSD bytes.
Ship per-subdoc font metadata in the bundle README so the user manually fixes fonts on open. This is the fallback if (1) and (2) both fail; it's terrible UX so only consider it if the others are confirmed impossible.
For each option, evaluate:

Feasibility in a browser-only environment (no Node, no Adobe SDK, no server)
Implementation effort (hours / days)
Reliability (does it work for ALL text layers, or only certain ones?)
Whether it preserves font size, color, leading, kerning, alignment
What I want from you
A concise written analysis (under 1500 words). For Problem 1, give me the exact byte layout of lnkD/lnk2/lnk3 blocks with enough detail that I can write a parser. For Problem 2, give me a recommendation between options 1/2/3 with the reasoning, AND a sketch of the binary patch flow if you recommend (1) — including which offsets matter in TySh and where the FontSet boundary is relative to the string. Cite the Adobe PSD spec sections you draw from. Don't write code; give me the spec-level understanding I need to implement it correctly.

Important constraints to repeat back to yourself before answering:

Browser-only environment, no backend
The user's real Photoshop has all the correct fonts installed — we just need to not destroy the references during the edit
ag-psd is available client-side and exposes linkedFiles, psd.layers[i].placedLayer, basic TySh round-tripping (but may rewrite blocks on save)
We are allowed to bypass Photopea entirely for any part of the pipeline if it gives us correct font preservation