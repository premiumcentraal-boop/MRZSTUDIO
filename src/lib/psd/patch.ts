/* PSD subdoc rewriter — splices new payloads into a parent PSD's lnkD/lnk2/lnk3
 * Linked Smart Object records without re-encoding the file. Pure: no DOM, no
 * ag-psd dependency. Extracted from App.tsx for editor performance.
 */

export type RewriteResult = {
  bytes: ArrayBuffer;
  rewritten: Array<{ name: string; matched: string; oldSize: number; newSize: number }>;
  skipped: Array<{ name: string; reason: string }>;
  diagnostics: string[];
};

// Match strategy: case-insensitive prefix on the bare filename without the
// .psd suffix. Same heuristic ag-psd uses for linkedFiles[i].name.
export function rewriteEmbeddedSubdocs(
  parentBytes: ArrayBuffer,
  edits: Array<{ name: string; bytes: ArrayBuffer }>,
): RewriteResult {
  const diag: string[] = [];
  const src = new Uint8Array(parentBytes);
  const srcView = new DataView(parentBytes);
  if (src.length < 26 || String.fromCharCode(src[0], src[1], src[2], src[3]) !== "8BPS") {
    throw new Error("rewriteEmbeddedSubdocs: input is not a PSD file");
  }
  const version = srcView.getUint16(4);
  if (version !== 1 && version !== 2) {
    throw new Error(`rewriteEmbeddedSubdocs: unknown PSD version ${version}`);
  }
  const isPsb = version === 2;
  const readU64 = (o: number) => srcView.getUint32(o) * 0x100000000 + srcView.getUint32(o + 4);

  // Walk past the fixed-size header (26 bytes), color-mode section, and
  // image-resources section to land on the Layer & Mask Info length field.
  let p = 26;
  const colorLen = srcView.getUint32(p); p += 4 + colorLen;
  const resLen = srcView.getUint32(p); p += 4 + resLen;
  const lmLenOff = p;
  const lmLenSize: 4 | 8 = isPsb ? 8 : 4;
  const lmLen = isPsb ? readU64(p) : srcView.getUint32(p);
  p += lmLenSize;
  const lmStart = p;
  const lmEnd = lmStart + lmLen;
  diag.push(`PSD${isPsb ? "B" : ""} · Layer&Mask len=${lmLen} @${lmLenOff} (${lmLenSize}B)`);

  type RecLoc = {
    name: string; type: string;
    recSizeOff: number; recSize: number;        // 8-byte field, value excludes trailing 4-byte pad
    dataLenOff: number; dataLen: number;        // 8-byte field, inside record metadata
    payloadStart: number; payloadEnd: number;   // payloadEnd = payloadStart + dataLen
    recPaddedEnd: number;                       // recStart + recSize + pad4(recSize)
    blockLenOff: number; blockLenSize: 4 | 8; blockLen: number;
  };
  const records: RecLoc[] = [];
  const dec = new TextDecoder("utf-16be");

  // Scan only within the Layer & Mask Info section. lnkD lives in the
  // document-level "Additional Layer Info" trailer, which sits inside this
  // section after the per-layer records. Scanning the whole section is
  // simpler than parsing past every layer record's variable-length tail.
  let i = lmStart;
  while (i < lmEnd - 12) {
    const sig = String.fromCharCode(src[i], src[i + 1], src[i + 2], src[i + 3]);
    if (sig !== "8BIM" && sig !== "8B64") { i++; continue; }
    const key = String.fromCharCode(src[i + 4], src[i + 5], src[i + 6], src[i + 7]);
    if (key !== "lnkD" && key !== "lnk2" && key !== "lnk3") { i++; continue; }
    let off = i + 8;
    const blockLenOff = off;
    const blockLenSize: 4 | 8 = key === "lnkD" ? 4 : 8;
    const blockLen = blockLenSize === 4 ? srcView.getUint32(off) : readU64(off);
    off += blockLenSize;
    const blockEnd = Math.min(off + blockLen, lmEnd);
    diag.push(`${key} block @${i} len=${blockLen} (lenField ${blockLenSize}B)`);

    let r = off;
    while (r + 8 < blockEnd) {
      const recSizeOff = r;
      const recSize = readU64(r);
      if (recSize <= 0 || r + 8 + recSize > blockEnd + 4) break;
      const recStart = r + 8;
      const padded = recSize + ((4 - (recSize % 4)) % 4);
      const recPaddedEnd = Math.min(recStart + padded, blockEnd);

      try {
        let q = recStart;
        const ftype = String.fromCharCode(src[q], src[q + 1], src[q + 2], src[q + 3]); q += 4;
        if (ftype !== "liFD" && ftype !== "liFE" && ftype !== "liFA") { r = recPaddedEnd; continue; }
        q += 4; // version
        const uuidLen = src[q]; q += 1 + uuidLen;
        q += (4 - ((1 + uuidLen) % 4)) % 4; // pad UUID Pascal string to mult of 4
        const nameLen = srcView.getUint32(q); q += 4;
        let name = "";
        if (nameLen > 0 && q + nameLen * 2 <= recPaddedEnd) {
          name = dec.decode(src.subarray(q, q + nameLen * 2)).replace(/ +$/, "");
        }
        q += nameLen * 2;
        if (ftype !== "liFD") { r = recPaddedEnd; continue; }
        q += 8; // filetype(4) + creator(4)
        const dataLenOff = q;
        const dataLen = readU64(q);
        q += 8;
        // Anchor on the embedded PSD's 8BPS magic — descriptor-flag size
        // varies (1 vs 4 bytes) across writers, so don't trust it for the
        // payload start.
        let psdAt = -1;
        for (let s = q; s < recPaddedEnd - 4; s++) {
          if (src[s] === 0x38 && src[s + 1] === 0x42 && src[s + 2] === 0x50 && src[s + 3] === 0x53) {
            psdAt = s; break;
          }
        }
        if (psdAt < 0) { r = recPaddedEnd; continue; }
        records.push({
          name, type: ftype, recSizeOff, recSize, dataLenOff, dataLen,
          payloadStart: psdAt, payloadEnd: psdAt + dataLen, recPaddedEnd,
          blockLenOff, blockLenSize, blockLen,
        });
      } catch { /* skip bad record */ }
      r = recPaddedEnd;
    }
    i = blockEnd;
  }
  diag.push(`indexed ${records.length} liFD record(s)`);

  // Build edit plan: case-insensitive prefix match on bare filename.
  const norm = (s: string) => String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/\s+/g, "");
  const usedRecs = new Set<number>();
  type Plan = {
    rec: RecLoc; newPayload: Uint8Array;
    newRecSize: number; newPadded: number; oldPadded: number; recDelta: number;
    requestedName: string;
  };
  const plan: Plan[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const rewritten: Array<{ name: string; matched: string; oldSize: number; newSize: number }> = [];
  for (const e of edits) {
    const needle = norm(e.name);
    const idx = records.findIndex((r, ri) => !usedRecs.has(ri) && norm(r.name).startsWith(needle));
    if (idx < 0) { skipped.push({ name: e.name, reason: "no matching lnkD record" }); continue; }
    usedRecs.add(idx);
    const rec = records[idx];
    const newPayload = new Uint8Array(e.bytes);
    if (newPayload.length < 4 || newPayload[0] !== 0x38 || newPayload[1] !== 0x42 || newPayload[2] !== 0x50 || newPayload[3] !== 0x53) {
      skipped.push({ name: e.name, reason: "replacement is not a valid PSD (missing 8BPS magic)" });
      usedRecs.delete(idx);
      continue;
    }
    const delta = newPayload.length - rec.dataLen;
    const newRecSize = rec.recSize + delta;
    const pad4 = (n: number) => (4 - (n % 4)) % 4;
    const oldPadded = rec.recSize + pad4(rec.recSize);
    const newPadded = newRecSize + pad4(newRecSize);
    const recDelta = newPadded - oldPadded;
    plan.push({ rec, newPayload, newRecSize, newPadded, oldPadded, recDelta, requestedName: e.name });
    rewritten.push({ name: e.name, matched: rec.name, oldSize: rec.dataLen, newSize: newPayload.length });
  }

  if (plan.length === 0) {
    return { bytes: parentBytes.slice(0), rewritten, skipped, diagnostics: diag };
  }

  plan.sort((a, b) => a.rec.payloadStart - b.rec.payloadStart);
  const totalDelta = plan.reduce((s, pl) => s + pl.recDelta, 0);
  diag.push(`plan: ${plan.length} edit(s), total byte delta = ${totalDelta}`);

  const out = new Uint8Array(src.length + totalDelta);
  const outView = new DataView(out.buffer);

  // Splice through src: copy preamble, write new payload, skip old record's
  // padded tail (regenerate fresh trailing pad in the output, which is
  // already zero-filled).
  let srcCursor = 0;
  let dstCursor = 0;
  for (const pl of plan) {
    const span = pl.rec.payloadStart - srcCursor;
    out.set(src.subarray(srcCursor, pl.rec.payloadStart), dstCursor);
    dstCursor += span;
    out.set(pl.newPayload, dstCursor);
    dstCursor += pl.newPayload.length;
    const newPad = (4 - (pl.newRecSize % 4)) % 4;
    dstCursor += newPad; // already zero
    srcCursor = pl.rec.recPaddedEnd;
  }
  out.set(src.subarray(srcCursor), dstCursor);

  // Translate an original-buffer offset into its output-buffer offset by
  // summing the deltas of every record that ended strictly before it.
  const shift = (origOff: number): number => {
    let s = 0;
    for (const pl of plan) {
      if (pl.rec.recPaddedEnd <= origOff) s += pl.recDelta;
    }
    return origOff + s;
  };
  const writeU64 = (o: number, v: number) => {
    outView.setUint32(o, Math.floor(v / 0x100000000));
    outView.setUint32(o + 4, v >>> 0);
  };

  // Per-record field updates (recSize, dataLen).
  for (const pl of plan) {
    writeU64(shift(pl.rec.recSizeOff), pl.newRecSize);
    writeU64(shift(pl.rec.dataLenOff), pl.newPayload.length);
  }

  // Per-block length update (sum deltas of all records inside each block).
  const blockDeltas = new Map<number, number>();
  for (const pl of plan) {
    blockDeltas.set(pl.rec.blockLenOff, (blockDeltas.get(pl.rec.blockLenOff) || 0) + pl.recDelta);
  }
  for (const [blockLenOff, delta] of blockDeltas) {
    const sample = plan.find((pl) => pl.rec.blockLenOff === blockLenOff)!;
    const newBlockLen = sample.rec.blockLen + delta;
    const dstOff = shift(blockLenOff);
    if (sample.rec.blockLenSize === 4) outView.setUint32(dstOff, newBlockLen);
    else writeU64(dstOff, newBlockLen);
  }

  // Layer & Mask Info length update (file-scope).
  const newLmLen = lmLen + totalDelta;
  if (lmLenSize === 4) outView.setUint32(lmLenOff, newLmLen);
  else writeU64(lmLenOff, newLmLen);
  diag.push(`Layer&Mask len ${lmLen} → ${newLmLen}`);

  return { bytes: out.buffer, rewritten, skipped, diagnostics: diag };
}
