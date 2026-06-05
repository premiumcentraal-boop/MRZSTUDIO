/* Photopea ExtendScript helpers injected into Photopea scripts.
 * Plain string templates — no interpolation. Extracted from App.tsx.
 */

export const PHOTOPEA_HELPERS = `
function findLayerRecursive(c, name){
  var want = String(name).toLowerCase();
  for (var i=0;i<c.layers.length;i++){
    var l = c.layers[i];
    if (String(l.name).toLowerCase() === want) return l;
    if (l.typename === "LayerSet"){
      var f = findLayerRecursive(l, name);
      if (f) return f;
    }
  }
  return null;
}
// Smart-object hosts are always ArtLayers — never groups. Calling
// placedLayerEditContents on a LayerSet hangs Photopea. Prefer an ArtLayer
// match anywhere in the tree before descending into groups.
function findSmartHost(c, name){
  var want = String(name).toLowerCase();
  for (var i=0;i<c.layers.length;i++){
    var l = c.layers[i];
    if (l.typename === "ArtLayer" && String(l.name).toLowerCase() === want) return l;
  }
  for (var j=0;j<c.layers.length;j++){
    var g = c.layers[j];
    if (g.typename === "LayerSet"){
      var f = findSmartHost(g, name);
      if (f) return f;
    }
  }
  return null;
}
function findLayerAny(c, names){
  for (var i=0;i<names.length;i++){
    var f = findLayerRecursive(c, names[i]);
    if (f) return f;
  }
  return null;
}
function findSmartHostAny(c, names){
  for (var i=0;i<names.length;i++){
    var f = findSmartHost(c, names[i]);
    if (f) return f;
  }
  return null;
}
function collectTextLayers(c, out){
  for (var i=0;i<c.layers.length;i++){
    var l = c.layers[i];
    if (l.typename === "ArtLayer"){ try { if (l.kind === LayerKind.TEXT) out.push(l); } catch(e){} }
    else if (l.typename === "LayerSet"){ collectTextLayers(l, out); }
  }
}
function px(v){
  if (v === null || v === undefined) return NaN;
  try { return Number(v.as("px")); } catch(e){ var n = Number(v); return isNaN(n) ? NaN : n; }
}
function layerTop(l){ try { return px(l.bounds[1]); } catch(e){ return 0; } }
// Walk back to the bottom (first-opened) document if a previous step left
// a subdoc active. Bounded by guard to avoid infinite loops.
function ensureMain(){
  var guard = 0;
  while (app.documents.length > 1 && guard < 8){
    try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch(e){ break; }
    guard++;
  }
}
function setText(layer, value){
  var newText = String(value);
  var nm = String(layer.name||"");
  try { layer.allLocked = false; } catch(e){}
  try { layer.visible = true; } catch(e){}
  // CRITICAL: textItem.contents only reliably updates the underlying TySh
  // block when the layer is the document's active layer. Some text layers
  // (YEAR/ENDVALID/FIRST observed) silently no-op the setter when they
  // aren't active — the descriptor gets the new string but the engine data
  // keeps the old one, so Photoshop renders the placeholder.
  try { app.activeDocument.activeLayer = layer; } catch(e){}
  var ti = layer.textItem;
  var f, sz, ld, col;
  try { f = ti.font; } catch(e){}
  try { sz = ti.size; } catch(e){}
  try { ld = ti.leading; } catch(e){}
  try { col = ti.color; } catch(e){}

  // Primary: high-level setter.
  try { ti.contents = newText; } catch(e){ log("warn", "[setText] '" + nm + "' contents= failed: " + (e.message||e)); }

  // Verify the write actually landed. If not, fall back to the low-level
  // setd descriptor (the same call Photoshop fires internally).
  // Photopea normalizes line breaks to \r inside TySh, so compare on \n to
  // avoid a spurious mismatch on multi-line text (e.g. MRZ) that would push
  // us into the setd path — which can hang on multi-line strings.
  function _eq(a,b){ return String(a).replace(/\r\n?/g,"\n") === String(b).replace(/\r\n?/g,"\n"); }
  var actual = "";
  try { actual = String(layer.textItem.contents); } catch(e){}
  if (!_eq(actual, newText)){
    log("warn", "[setText] '" + nm + "' contents= silently no-op (got " + JSON.stringify(actual.slice(0,40)) + "), trying setd descriptor");
    try {
      var desc = new ActionDescriptor();
      var ref = new ActionReference();
      ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      desc.putReference(charIDToTypeID("null"), ref);
      var td = new ActionDescriptor();
      td.putString(charIDToTypeID("Txt "), newText);
      desc.putObject(charIDToTypeID("T   "), charIDToTypeID("TxLr"), td);
      executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
    } catch(eA){ log("warn", "[setText] '" + nm + "' setd failed: " + (eA.message||eA)); }
    try { actual = String(layer.textItem.contents); } catch(e){}
  }

  // Re-apply font/size/leading/color so Photopea re-tessellates and the
  // styling survives the descriptor write.
  try { if (f) ti.font = f; } catch(e){}
  try { if (sz) ti.size = sz; } catch(e){}
  try { if (ld) ti.leading = ld; } catch(e){}
  try { if (col) ti.color = col; } catch(e){}

  if (!_eq(actual, newText)) log("error", "[setText] '" + nm + "' FINAL contents mismatch: want " + JSON.stringify(newText) + " got " + JSON.stringify(actual.slice(0,40)));
  else log("info", "[setText] '" + nm + "' verified := " + JSON.stringify(newText.slice(0,40)));
}
function openSmart(name){
  var doc = app.activeDocument;
  var l = findSmartHost(doc, name);
  if (!l){
    var any = findLayerRecursive(doc, name);
    if (any) throw new Error("'" + name + "' is a " + any.typename + ", not a smart object");
    throw new Error("Missing smart-object layer: " + name);
  }
  doc.activeLayer = l;
  try { executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO); }
  catch(e){ app.runMenuItem(stringIDToTypeID("placedLayerEditContents")); }
}
function closeSmart(){
  // Two distinct commit paths because Photopea handles linked vs embedded
  // smart objects differently:
  //   • Linked   (e.g. PERFO opens subdoc named "PERFO"): sub.save() writes
  //                back to the linked source file, parent re-reads on render.
  //   • Embedded (e.g. SMALLDATE, SIGNATURE, MRZ): the bytes live INSIDE
  //                the parent's SoLE block. sub.save() is a no-op for these;
  //                only close(SAVECHANGES) commits the subdoc bytes back
  //                into the parent's embedded slot.
  // So we do BOTH: save() first (commits linked), then close(SAVECHANGES)
  // (commits embedded). One of them is always the right operation; the
  // other is a harmless no-op.
  var sub = app.activeDocument;
  var subName = sub.name;
  try { sub.save(); log("info", "[closeSmart] save() ok ('" + subName + "')"); }
  catch(e){ log("info", "[closeSmart] save() noop/err ('" + subName + "'): " + (e.message||e)); }
  try { sub.close(SaveOptions.SAVECHANGES); log("info", "[closeSmart] close(SAVECHANGES) ok ('" + subName + "')"); }
  catch(e2){
    log("warn", "[closeSmart] close(SAVECHANGES) failed ('" + subName + "'): " + (e2.message||e2));
    try { sub.close(SaveOptions.DONOTSAVECHANGES); }
    catch(e3){ log("error", "[closeSmart] hard-close failed ('" + subName + "'): " + (e3.message||e3)); throw e3; }
  }
}
function log(level, msg){ try { app.echoToOE("CARD_LOG:" + JSON.stringify({level:level, msg:String(msg)})); } catch(e){} }
// Photopea quirk: in an EMBEDDED smart-object subdoc, edits to textItem.contents
// update the text engine but the subdoc's rendered raster (which is what gets
// baked into the parent's SoLE block on close) doesn't re-render before save.
// Result: text edits silently disappear from the saved PSD. Pixel edits don't
// have this problem because they're already raster. Linked smart objects
// (PERFO) work because the parent re-reads the linked file on render.
// Fix: rasterize text layers after editing, before closing the subdoc. Loses
// re-editability of the text but the EXPORTED PSD shows the correct content.
// Codex-prescribed verification: reopen a smart-object host on the parent
// AFTER closeSmart and read back what's actually inside. Tells us whether
// the inner subdoc was truly updated (commit worked) or still holds the
// original content (commit silently failed). Closes the verification subdoc
// without saving so we don't disturb state.
function verifySmart(hostName){
  ensureMain();
  var host = findSmartHost(app.activeDocument, hostName);
  if (!host){ log("warn", "[verify:" + hostName + "] host not found"); return; }
  app.activeDocument.activeLayer = host;
  try { executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO); }
  catch(e){ log("warn", "[verify:" + hostName + "] reopen failed: " + (e.message||e)); return; }
  var v = app.activeDocument;
  log("info", "[verify:" + hostName + "] reopened subdoc '" + v.name + "', " + v.layers.length + " layers");
  var texts = [];
  collectTextLayers(v, texts);
  for (var i=0;i<texts.length;i++){
    var t = texts[i];
    var c = "";
    try { c = String(t.textItem.contents); } catch(e){}
    log("info", "[verify:" + hostName + "]   text '" + t.name + "' = " + JSON.stringify(c.slice(0,60)));
  }
  // Also report top-level art-layer count + names for raster verification.
  for (var j=0;j<v.layers.length;j++){
    var L = v.layers[j];
    log("info", "[verify:" + hostName + "]   layer " + j + ": '" + L.name + "' (" + L.typename + ")");
  }
  try { v.close(SaveOptions.DONOTSAVECHANGES); }
  catch(e2){ log("warn", "[verify:" + hostName + "] close failed: " + (e2.message||e2)); }
}
function rasterizeTextLayers(doc){
  var arr = [];
  collectTextLayers(doc, arr);
  var ok = 0;
  for (var i=0;i<arr.length;i++){
    var nm = String(arr[i].name||"");
    try { arr[i].rasterize(RasterizeType.TEXTCONTENTS); ok++; log("info", "[raster] '" + nm + "' (TEXTCONTENTS)"); }
    catch(e){
      try { arr[i].rasterize(RasterizeType.ENTIRELAYER); ok++; log("info", "[raster] '" + nm + "' (ENTIRELAYER fallback)"); }
      catch(e2){ log("warn", "[raster] '" + nm + "' failed: " + (e2.message||e2)); }
    }
  }
  return ok;
}
// Per-layer rasterize is unreliable in Photopea (some calls silently leave
// old pixels) and produces a structurally fragile subdoc that Photoshop
// rejects. Flattening to ONE merged layer bakes every text edit into a
// single raster atomically — yields a tiny, valid PSD that Photoshop opens
// cleanly and that commits intact into the parent's SoLE block.
function flattenSubdoc(){
  var d = app.activeDocument;
  try { d.flatten(); log("info", "[flatten] doc.flatten() ok ('" + d.name + "')"); return; }
  catch(e){}
  try { executeAction(charIDToTypeID("FltI"), undefined, DialogModes.NO); log("info", "[flatten] FltI ok ('" + d.name + "')"); return; }
  catch(e2){}
  try { d.mergeVisibleLayers(); log("info", "[flatten] mergeVisibleLayers ok ('" + d.name + "')"); }
  catch(e3){ log("warn", "[flatten] all paths failed for '" + d.name + "': " + (e3.message||e3)); }
}
`;

export const PHOTOPEA_HELPERS_MINI = `
function log(level, msg){ try { app.echoToOE("CARD_LOG:" + JSON.stringify({level:level, msg:String(msg)})); } catch(e){} }
function done(label){ try { app.echoToOE("STEP_DONE:" + JSON.stringify({label:String(label)})); } catch(e){} }
function findLayerRecursive(c, name){
  var want = String(name).toLowerCase();
  for (var i=0;i<c.layers.length;i++){
    var l = c.layers[i];
    if (String(l.name).toLowerCase() === want) return l;
    if (l.typename === "LayerSet"){ var f = findLayerRecursive(l, name); if (f) return f; }
  }
  return null;
}
function _norm(s){ return String(s||"").replace(/[^a-z0-9]/gi,"").toLowerCase(); }
function findLayerLoose(c, names){
  var wants = []; for (var k=0;k<names.length;k++) wants.push(_norm(names[k]));
  function walk(set){
    for (var i=0;i<set.layers.length;i++){
      var l = set.layers[i];
      var nn = _norm(l.name);
      for (var w=0;w<wants.length;w++){ if (nn === wants[w]) return l; }
      if (l.typename === "LayerSet"){ var f = walk(l); if (f) return f; }
    }
    return null;
  }
  return walk(c);
}
function collectTextLayers(c, out){
  for (var i=0;i<c.layers.length;i++){
    var l = c.layers[i];
    if (l.typename === "ArtLayer"){ try { if (l.kind === LayerKind.TEXT) out.push(l); } catch(e){} }
    else if (l.typename === "LayerSet"){ collectTextLayers(l, out); }
  }
}
function px(v){ try { return Number(v.as("px")); } catch(e){ return Number(v); } }
function layerTop(l){ try { return px(l.bounds[1]); } catch(e){ return 0; } }
function setText(layer, value){
  // Photopea's TySh format internally uses CR (\r) for line breaks. Normalize
  // both sides on \n so we don't false-fail a successful multi-line write and
  // tumble into setd-descriptor land (which can hang on multi-line strings).
  function _eq(a,b){ return String(a).replace(/\r\n?/g,"\n") === String(b).replace(/\r\n?/g,"\n"); }
  var newText = String(value);
  try { layer.allLocked = false; } catch(e){}
  try { layer.visible = true; } catch(e){}
  try { app.activeDocument.activeLayer = layer; } catch(e){}
  var ti = layer.textItem;
  var f, sz, ld, col;
  try { f = ti.font; } catch(e){}
  try { sz = ti.size; } catch(e){}
  try { ld = ti.leading; } catch(e){}
  try { col = ti.color; } catch(e){}
  try { ti.contents = newText; } catch(e){}
  var actual = "";
  try { actual = String(layer.textItem.contents); } catch(e){}
  if (!_eq(actual, newText)){
    try {
      var desc = new ActionDescriptor();
      var ref = new ActionReference();
      ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      desc.putReference(charIDToTypeID("null"), ref);
      var td = new ActionDescriptor();
      td.putString(charIDToTypeID("Txt "), newText);
      desc.putObject(charIDToTypeID("T   "), charIDToTypeID("TxLr"), td);
      executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
      try { actual = String(layer.textItem.contents); } catch(e){}
    } catch(e){}
  }
  try { if (f) layer.textItem.font = f; } catch(e){}
  try { if (sz) layer.textItem.size = sz; } catch(e){}
  try { if (ld) layer.textItem.leading = ld; } catch(e){}
  try { if (col) layer.textItem.color = col; } catch(e){}
  log("info", "[setText] '" + layer.name + "' := " + JSON.stringify(actual));
}
function closeAll(){
  var guard = 0;
  while (app.documents.length > 0 && guard < 10){
    try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch(e){ break; }
    guard++;
  }
}
function saveOut(label){
  try { app.activeDocument.saveToOE("psd"); log("info", "[" + label + "] saveToOE posted"); }
  catch(e){ app.echoToOE("CARD_ERROR:saveToOE failed for " + label + ": " + e); }
}
`;
