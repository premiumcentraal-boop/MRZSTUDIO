# ID Generator — grounded build

User scope: MRZ Studio's working internal employee generator becomes the first PC native Cyclone Ports plugin. Cyclone's hub, phone and Glass source stay owned by the Ports builder.

## Implementation checkpoints

1. Share the current form → MRZ → Photoshop payload code. Preserve NL/DE rules, template name ordering, standard sizes, preset/custom cities, editable height and document numbers. Default signature is the **Paul Signature font**, using the employee's first name, not the literal name Paul.
2. Share photo crop/background removal and signature raster code between the panel and an isolated local renderer. Bundle MediaPipe model/WASM so photos never require a cloud service. Fail explicitly when a required image step is unavailable.
3. Mount a signed `cyclone.ports/1` connector on the existing loopback API. Accept generation on `x.id-generator.generate`; deliver metadata on `value.in` and generated files on `file.in`. Use run + request matching, durable deduplication, asynchronous work, cancellation, deadlines and stable delivery IDs.
4. Add an ID Generator plugin settings/pairing page and an embeddable panel. Persist owner defaults under `control/id-generator`; publish a manifest and machine-readable generation schema. Keep private keys and employee assets out of source/releases/logs.
5. Test against the real SDK signature vectors, conformance and Dev Hub; exercise renderer and worker paths separately. Check the existing app/runtime tests and package contents. Document what is verified and what still needs the new real hub.

The SDK referenced by the handoffs is on `claude/cyclone-ui-updates-emnerc`, not main. Its SPEC is authoritative; the local inspection copy is read-only, under ignored artifacts. No Cyclone checkout changes are needed to ship this plugin with MRZ Studio.
