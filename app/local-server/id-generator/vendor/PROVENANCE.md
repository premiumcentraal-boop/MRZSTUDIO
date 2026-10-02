# Cyclone Ports verifier

`verify.mjs` is copied **without modifications** from the owner repository `premiumcentraal-boop/Cyclone`, branch `claude/cyclone-ui-updates-emnerc`, commit `d8ed3c6b04a38b63aa82a8f8124e148e618cafc4`.

Source: `tools/cyclone-ports-sdk/js/verify.mjs`. Normative contract: `tools/cyclone-ports-sdk/SPEC.md`, `cyclone.ports/1`.

The SDK's signature vectors are kept in `app/tests/ports-signature-vectors.json`. They exercise raw-body hashing, query paths, key rotation and replay. The plugin owns cache expiry and persistent replay protection; the SDK helper owns cryptographic verification.
