#target photoshop

/*
Internal Employee Badge — IDCARDPRINT stage 2.

Places the EmployeeID full-template result.png into IDCARDPRINT.psd smart
objects RESULTBACK / RESULTFRONT, then exports Badge back and Badge front.

Safety boundary: internal company badge artwork only. Does not create official
government identity documents or legal credential artifacts.

ExtendScript ES3: no String.trim, no arrow functions, no const/let.
*/

app.bringToFront();

var JOB_CONTEXT = $.global.CYCLONE_JOB_CONTEXT || null;
var BASE_PATH = JOB_CONTEXT ? JOB_CONTEXT.base_path : resolveAutomationBasePath("C:/EmployeeBadgeAutomation");
var TEMPLATE_DIR = BASE_PATH + "/templates";
var DEFAULT_TEMPLATE_NAME = "IDCARDPRINT.psd";
var SIDECAR_JSON_PATH = JOB_CONTEXT ? JOB_CONTEXT.sidecar_path : BASE_PATH + "/current-job/idcardprint_input.json";
var FALLBACK_JSON_PATH = JOB_CONTEXT ? JOB_CONTEXT.input_path : BASE_PATH + "/current-job/input.json";
var OUTPUT_BASE = BASE_PATH + "/output";
var LOG_DIR = BASE_PATH + "/logs";

if (typeof JSON === "undefined") {
  JSON = {};
}

if (typeof JSON.parse !== "function") {
  JSON.parse = function (text) {
    return eval("(" + text + ")");
  };
}

if (typeof JSON.stringify !== "function") {
  JSON.stringify = function (value, replacer, space) {
    var gap = "";
    var indent = "";
    var i;
    if (typeof space === "number") {
      for (i = 0; i < space; i++) indent += " ";
    } else if (typeof space === "string") {
      indent = space;
    }

    function quote(str) {
      return "\"" + String(str)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t") + "\"";
    }

    function str(key, holder) {
      var v = holder[key];
      var partial;
      var k;
      var mind = gap;
      if (v && typeof v === "object" && typeof v.toJSON === "function") {
        v = v.toJSON(key);
      }
      if (typeof replacer === "function") {
        v = replacer.call(holder, key, v);
      }
      if (v === null) return "null";
      if (typeof v === "string") return quote(v);
      if (typeof v === "number") return isFinite(v) ? String(v) : "null";
      if (typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        gap += indent;
        partial = [];
        if (Object.prototype.toString.apply(v) === "[object Array]") {
          for (i = 0; i < v.length; i++) {
            partial[i] = str(i, v) || "null";
          }
          if (partial.length === 0) {
            v = "[]";
          } else if (indent) {
            v = "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]";
          } else {
            v = "[" + partial.join(",") + "]";
          }
          gap = mind;
          return v;
        }
        for (k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            var item = str(k, v);
            if (item) {
              partial.push(quote(k) + (indent ? ": " : ":") + item);
            }
          }
        }
        if (partial.length === 0) {
          v = "{}";
        } else if (indent) {
          v = "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}";
        } else {
          v = "{" + partial.join(",") + "}";
        }
        gap = mind;
        return v;
      }
      return undefined;
    }

    return str("", { "": value });
  };
}

var REPORT = {
  status: "started",
  job_id: null,
  started_at: timestamp(),
  completed_at: null,
  template_path: null,
  work_copy_path: null,
  result_png: null,
  output_folder: null,
  exported_files: [],
  layer_updates: [],
  warnings: [],
  errors: [],
  log_file: null
};

var LOG_FILE = null;
var ORIGINAL_DISPLAY_DIALOGS = app.displayDialogs;
var WORK_COPY_PATH = null;
var KEEP_WORK_COPY = false;

function resolveAutomationBasePath(defaultPath) {
  try {
    var envPath = $.getenv("BADGE_AUTOMATION_BASE_PATH");
    if (envPath && String(envPath) !== "") {
      return String(envPath).replace(/\\/g, "/");
    }
  } catch (envError) {}
  try {
    var scriptFile = new File($.fileName);
    if (scriptFile.exists && scriptFile.parent && scriptFile.parent.parent) {
      return scriptFile.parent.parent.fsName.replace(/\\/g, "/");
    }
  } catch (fileError) {}
  return defaultPath;
}

var PREEXISTING_DOCUMENT_IDS = {};
function main() {
  for (var openedIndex = 0; openedIndex < app.documents.length; openedIndex++) PREEXISTING_DOCUMENT_IDS[app.documents[openedIndex].id] = true;
  var doc = null;
  var input = null;
  try {
    app.displayDialogs = DialogModes.NO;
    ensureFolderRecursive(LOG_DIR);
    LOG_FILE = new File(LOG_DIR + "/run_idcardprint_job.log");
    REPORT.log_file = LOG_FILE.fsName;
    logLine("Starting IDCARDPRINT stage-2 job.");

    input = loadInput();
    REPORT.job_id = sanitizeJobId(input.job_id || "unknown-job");
    KEEP_WORK_COPY = isTruthy(input.keep_work_copy);

    var jobOutputFolder = resolveOutputFolder(input);
    ensureFolderRecursive(jobOutputFolder);
    REPORT.output_folder = jobOutputFolder;
    LOG_FILE = new File(LOG_DIR + "/run_idcardprint_job_" + REPORT.job_id + ".log");
    REPORT.log_file = LOG_FILE.fsName;
    logLine("Loaded input for job " + REPORT.job_id + ".");

    var resultPng = resolveResultPng(input);
    REPORT.result_png = resultPng;
    assertFileExists(resultPng, "EmployeeID result.png");
    logLine("result.png: " + resultPng);

    var templatePath = getTemplatePath(input);
    REPORT.template_path = templatePath;
    assertFileExists(templatePath, "IDCARDPRINT template");

    var workCopyPath = prepareWorkingCopy(templatePath, jobOutputFolder);
    WORK_COPY_PATH = workCopyPath;
    REPORT.work_copy_path = workCopyPath;
    logLine("Working copy: " + workCopyPath);

    doc = app.open(new File(workCopyPath));
    app.activeDocument = doc;
    logLine("Opened IDCARDPRINT working copy: " + doc.name + " (" + Math.round(unitPx(doc.width)) + "x" + Math.round(unitPx(doc.height)) + " px).");

    var resultBack = findLayerByNameDeep(doc, "RESULTBACK");
    var resultFront = findLayerByNameDeep(doc, "RESULTFRONT");
    var backgroundLayer = findLayerByNameDeep(doc, "Background");

    if (!resultBack) throw new Error("Missing layer RESULTBACK in IDCARDPRINT.psd");
    if (!resultFront) throw new Error("Missing layer RESULTFRONT in IDCARDPRINT.psd");
    if (!backgroundLayer) warn("Background layer was not found; exporting whatever is visible.");

    unlockLayer(resultBack);
    unlockLayer(resultFront);
    if (backgroundLayer) {
      unlockLayer(backgroundLayer);
      backgroundLayer.visible = true;
    }

    resultFront.visible = false;
    resultBack.visible = true;
    replaceLayerWithImage(doc, resultBack, resultPng, "RESULTBACK");
    exportPNG(doc, resolveOutputPath(input, jobOutputFolder, "output_back", "result-back.png"));

    resultBack.visible = false;
    resultFront.visible = true;
    if (backgroundLayer) backgroundLayer.visible = true;
    replaceLayerWithImage(doc, resultFront, resultPng, "RESULTFRONT");
    exportPNG(doc, resolveOutputPath(input, jobOutputFolder, "output_front", "result-front.png"));

    closeDocumentNoSave(doc);
    doc = null;

    if (!KEEP_WORK_COPY) {
      removeFileQuiet(workCopyPath);
      WORK_COPY_PATH = null;
      REPORT.work_copy_path = null;
      logLine("Removed IDCARDPRINT working copy after success.");
    }

    REPORT.status = "success";
    REPORT.completed_at = timestamp();
    writeReport(jobOutputFolder + "/idcardprint_report.json", REPORT);
    logLine("IDCARDPRINT job completed successfully.");
  } catch (error) {
    REPORT.status = "error";
    REPORT.completed_at = timestamp();
    REPORT.errors.push(errorToObject(error));
    logLine("ERROR: " + errorToString(error));

    try {
      if (doc) closeDocumentNoSave(doc);
    } catch (closeError) {
      logLine("Error while closing document: " + errorToString(closeError));
    }
    try {
      closeAllOpenDocumentsNoSave();
    } catch (closeAllError) {
      logLine("Error while closing open documents: " + errorToString(closeAllError));
    }

    try {
      var errorFolder = REPORT.output_folder || LOG_DIR;
      ensureFolderRecursive(errorFolder);
      writeReport(errorFolder + "/idcardprint_report.json", REPORT);
      writeReport(LOG_DIR + "/last_idcardprint_error_report.json", REPORT);
    } catch (reportError) {
      logLine("Could not write error report: " + errorToString(reportError));
    }

  } finally {
    app.displayDialogs = ORIGINAL_DISPLAY_DIALOGS;
  }
}

function loadInput() {
  var path = SIDECAR_JSON_PATH;
  var sidecar = new File(SIDECAR_JSON_PATH);
  if (!sidecar.exists) path = FALLBACK_JSON_PATH;
  var file = new File(path);
  assertFileExists(file.fsName, "IDCARDPRINT input JSON");
  file.encoding = "UTF8";
  if (!file.open("r")) {
    throw new Error("Could not open input JSON: " + file.fsName);
  }
  var text = file.read();
  file.close();
  if (!text || text.replace(/\s/g, "") === "") {
    throw new Error("Input JSON is empty: " + file.fsName);
  }
  logLine("Reading input: " + file.fsName);
  return JSON.parse(text);
}

function resolveOutputFolder(input) {
  if (input.output_folder && String(input.output_folder) !== "") {
    return toJsxPath(input.output_folder);
  }
  return OUTPUT_BASE + "/" + REPORT.job_id;
}

function resolveResultPng(input) {
  var raw = input.result_png || input.result_png_path || input.resultPng || "";
  if ((!raw || String(raw) === "") && input.images && input.images.result_png) {
    raw = input.images.result_png;
  }
  raw = toJsxPath(raw);
  if (!raw) {
    throw new Error("Input JSON is missing result_png (path to EmployeeID result.png).");
  }
  return raw;
}

function getTemplatePath(input) {
  var templateName = input.template_path || input.template || DEFAULT_TEMPLATE_NAME;
  templateName = toJsxPath(templateName);
  if (templateName.indexOf("/") >= 0 || templateName.indexOf(":") >= 0) {
    return templateName;
  }
  return TEMPLATE_DIR + "/" + templateName;
}

function resolveOutputPath(input, outputFolder, fieldName, defaultName) {
  var raw = input[fieldName];
  if (raw && String(raw) !== "") return toJsxPath(raw);
  return outputFolder + "/" + defaultName;
}

function prepareWorkingCopy(templatePath, outputFolder) {
  var destPath = outputFolder + "/IDCARDPRINT_work.psd";
  var src = new File(templatePath);
  var dest = new File(destPath);
  if (sameFilePath(src, dest)) {
    logLine("Template path is already the per-job working copy.");
    return toJsxPath(dest.fsName);
  }
  if (dest.exists) {
    try {
      dest.remove();
    } catch (removeError) {
      warn("Could not remove previous working copy: " + errorToString(removeError));
    }
  }
  if (!src.copy(dest)) {
    throw new Error("Could not copy IDCARDPRINT template to working copy: " + dest.fsName);
  }
  logLine("Copied IDCARDPRINT master to working copy.");
  return toJsxPath(dest.fsName);
}

function sameFilePath(a, b) {
  return toJsxPath(a.fsName).toLowerCase() === toJsxPath(b.fsName).toLowerCase();
}

function replaceLayerWithImage(doc, layer, imagePath, layerName) {
  app.activeDocument = doc;
  unlockLayer(layer);
  layer.visible = true;
  doc.activeLayer = layer;

  if (isSmartObjectLayer(layer)) {
    try {
      replaceSmartObjectContents(imagePath);
      REPORT.layer_updates.push({
        layer: layerName,
        method: "placedLayerReplaceContents",
        image_path: imagePath,
        status: "updated"
      });
      logLine("Replaced smart-object contents for " + layerName + ".");
      return;
    } catch (replaceError) {
      warn("placedLayerReplaceContents failed for " + layerName + "; falling back to edit-contents: " + errorToString(replaceError));
    }
    replaceSmartObjectByEditing(doc, layer, imagePath, layerName);
    return;
  }

  replaceArtLayerByPaste(doc, layer, imagePath, layerName);
}

function replaceSmartObjectByEditing(parentDoc, smartLayer, imagePath, layerName) {
  app.activeDocument = parentDoc;
  parentDoc.activeLayer = smartLayer;
  var subDoc = openSmartObjectDocument(app.activeDocument);
  logLine("Opened " + layerName + " smart object as " + subDoc.name + ".");

  try {
    var canvasBounds = {
      left: 0,
      top: 0,
      right: unitPx(subDoc.width),
      bottom: unitPx(subDoc.height)
    };
    deleteCompetingArtLayers(subDoc, null);
    if (subDoc.artLayers.length === 0) {
      var blank = subDoc.artLayers.add();
      blank.name = layerName;
      blank.kind = LayerKind.NORMAL;
    }
    copyImagePixelsResizedTo(imagePath, canvasBounds.right, canvasBounds.bottom, subDoc.resolution);
    app.activeDocument = subDoc;
    subDoc.paste();
    var pasted = subDoc.activeLayer;
    unlockLayer(pasted);
    pasted.name = layerName;
    fitLayerToBounds(subDoc, pasted, canvasBounds);
    deleteCompetingArtLayers(subDoc, pasted);
    subDoc.save();
    subDoc.close(SaveOptions.SAVECHANGES);
    app.activeDocument = parentDoc;
    REPORT.layer_updates.push({
      layer: layerName,
      method: "editContents-paste-contain",
      image_path: imagePath,
      status: "updated"
    });
    logLine("Saved edited smart object for " + layerName + ".");
  } catch (error) {
    try {
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {
      logLine("Could not close failed smart object: " + errorToString(closeError));
    }
    app.activeDocument = parentDoc;
    throw error;
  }
}

function replaceArtLayerByPaste(doc, targetLayer, imagePath, layerName) {
  app.activeDocument = doc;
  unlockLayer(targetLayer);
  var targetBounds = getReplacementBounds(doc, targetLayer, layerName);
  var originalName = String(targetLayer.name || layerName);

  copyImagePixelsResizedTo(
    imagePath,
    targetBounds.right - targetBounds.left,
    targetBounds.bottom - targetBounds.top,
    doc.resolution
  );
  app.activeDocument = doc;
  doc.activeLayer = targetLayer;
  doc.paste();
  var pasted = doc.activeLayer;
  unlockLayer(pasted);
  pasted.name = originalName;
  fitLayerToBounds(doc, pasted, targetBounds);

  try {
    if (targetLayer !== pasted) {
      unlockLayer(targetLayer);
      targetLayer.remove();
    }
  } catch (removeError) {
    warn("Could not remove placeholder art layer " + layerName + ": " + errorToString(removeError));
  }

  REPORT.layer_updates.push({
    layer: layerName,
    method: "artLayer-paste-contain",
    image_path: imagePath,
    status: "updated"
  });
  logLine("Pasted and contain-fitted " + layerName + " on the parent document.");
}

function replaceSmartObjectContents(imagePath) {
  var desc = new ActionDescriptor();
  desc.putPath(charIDToTypeID("null"), new File(imagePath));
  executeAction(stringIDToTypeID("placedLayerReplaceContents"), desc, DialogModes.NO);
}

function copyImagePixelsResizedTo(imagePath, widthPx, heightPx, resolution) {
  var imageDoc = null;
  try {
    imageDoc = app.open(new File(imagePath));
    app.activeDocument = imageDoc;
    resizeImageDocumentToFitPixels(imageDoc, widthPx, heightPx, resolution);
    imageDoc.selection.selectAll();
    try {
      imageDoc.selection.copy(true);
    } catch (copyMergedError) {
      imageDoc.selection.copy();
    }
    imageDoc.selection.deselect();
  } finally {
    if (imageDoc) {
      imageDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
  }
}

function resizeImageDocumentToFitPixels(imageDoc, widthPx, heightPx, resolution) {
  var boxW = Math.max(1, Math.round(widthPx));
  var boxH = Math.max(1, Math.round(heightPx));
  var beforeWidth = Math.max(1, Math.round(unitPx(imageDoc.width)));
  var beforeHeight = Math.max(1, Math.round(unitPx(imageDoc.height)));
  var scale = Math.min(boxW / beforeWidth, boxH / beforeHeight);
  var targetWidth = Math.max(1, Math.round(beforeWidth * scale));
  var targetHeight = Math.max(1, Math.round(beforeHeight * scale));
  var resampleMethod = ResampleMethod.BICUBIC;
  try {
    resampleMethod = ResampleMethod.BICUBICAUTOMATIC;
  } catch (ignoreMethod) {}

  imageDoc.resizeImage(UnitValue(targetWidth, "px"), UnitValue(targetHeight, "px"), resolution, resampleMethod);
  logLine(
    "Fit-resized source image from " + beforeWidth + "x" + beforeHeight +
    " px to " + targetWidth + "x" + targetHeight +
    " px inside " + boxW + "x" + boxH + " px box (no stretch)."
  );
}

function fitLayerToBounds(doc, layer, targetBounds) {
  app.activeDocument = doc;
  doc.activeLayer = layer;
  var bounds = getLayerBoundsPx(layer);
  var layerWidth = bounds.right - bounds.left;
  var layerHeight = bounds.bottom - bounds.top;
  var targetWidth = targetBounds.right - targetBounds.left;
  var targetHeight = targetBounds.bottom - targetBounds.top;

  if (layerWidth <= 0 || layerHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Cannot fit image layer because source or target dimensions are invalid.");
  }

  var scale = Math.min(targetWidth / layerWidth, targetHeight / layerHeight) * 100;
  if (Math.abs(scale - 100) > 0.1) {
    layer.resize(scale, scale, AnchorPosition.TOPLEFT);
  }

  bounds = getLayerBoundsPx(layer);
  layerWidth = bounds.right - bounds.left;
  layerHeight = bounds.bottom - bounds.top;
  var offsetX = targetBounds.left + (targetWidth - layerWidth) / 2 - bounds.left;
  var offsetY = targetBounds.top + (targetHeight - layerHeight) / 2 - bounds.top;
  layer.translate(offsetX, offsetY);
  logLine(
    "Fit layer into target (contain, no stretch): scale=" +
    Math.round(scale * 10) / 10 +
    "% into " + Math.round(targetWidth) + "x" + Math.round(targetHeight) + " px"
  );
}

function collectArtLayers(container, out) {
  var i;
  for (i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (layer.typename === "LayerSet") {
      collectArtLayers(layer, out);
    } else if (layer.typename === "ArtLayer") {
      out.push(layer);
    }
  }
}

function deleteCompetingArtLayers(doc, keepLayer) {
  app.activeDocument = doc;
  var removed = 0;
  var guard = 0;
  while (guard < 50) {
    guard++;
    var arts = [];
    collectArtLayers(doc, arts);
    var victim = null;
    var i;
    for (i = 0; i < arts.length; i++) {
      if (keepLayer && arts[i] === keepLayer) continue;
      victim = arts[i];
      break;
    }
    if (!victim) break;
    try {
      unlockLayer(victim);
      victim.remove();
      removed++;
    } catch (removeError) {
      warn("Could not remove competing layer: " + errorToString(removeError));
      break;
    }
  }
  if (removed > 0) {
    logLine("Removed " + removed + " competing art layer(s) before/after image replace.");
  }
}

function getReplacementBounds(doc, targetLayer, targetName) {
  var bounds = getLayerBoundsPx(targetLayer);
  var width = bounds.right - bounds.left;
  var height = bounds.bottom - bounds.top;
  if (width > 0 && height > 0) {
    return bounds;
  }
  warn("Layer " + targetName + " has empty bounds; using the full document canvas as the image target.");
  return {
    left: 0,
    top: 0,
    right: unitPx(doc.width),
    bottom: unitPx(doc.height)
  };
}

function exportPNG(doc, outputPath) {
  var duplicate = null;
  var originalBackground = app.backgroundColor;
  try {
    duplicate = doc.duplicate("idcardprint_png_export", true);
    app.activeDocument = duplicate;
    setDocumentResolutionNoResample(duplicate, 300);
    var white = new SolidColor();
    white.rgb.red = 255;
    white.rgb.green = 255;
    white.rgb.blue = 255;
    app.backgroundColor = white;
    duplicate.flatten();
    var pngOptions = new PNGSaveOptions();
    duplicate.saveAs(new File(outputPath), pngOptions, true, Extension.LOWERCASE);
    REPORT.exported_files.push(outputPath);
    logLine("Exported PNG: " + outputPath);
  } finally {
    app.backgroundColor = originalBackground;
    if (duplicate) {
      duplicate.close(SaveOptions.DONOTSAVECHANGES);
    }
    app.activeDocument = doc;
  }
}

function setDocumentResolutionNoResample(doc, dpi) {
  try {
    doc.resizeImage(undefined, undefined, dpi, ResampleMethod.NONE);
  } catch (error) {
    warn("Could not set PNG resolution metadata to " + dpi + " DPI without resampling: " + errorToString(error));
  }
}

function findLayerByNameDeep(container, name) {
  if (!container.layers) return null;
  var i;
  for (i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (layer.name === name) return layer;
    if (layer.typename === "LayerSet") {
      var found = findLayerByNameDeep(layer, name);
      if (found) return found;
    }
  }
  return null;
}

function isSmartObjectLayer(layer) {
  try {
    return layer.typename === "ArtLayer" && layer.kind === LayerKind.SMARTOBJECT;
  } catch (error) {
    return false;
  }
}

function unlockLayer(layer) {
  try { layer.allLocked = false; } catch (ignoreAll) {}
  try { layer.pixelsLocked = false; } catch (ignorePixels) {}
  try { layer.positionLocked = false; } catch (ignorePosition) {}
  try { layer.transparentPixelsLocked = false; } catch (ignoreTransparency) {}
}

function getLayerBoundsPx(layer) {
  return {
    left: unitPx(layer.bounds[0]),
    top: unitPx(layer.bounds[1]),
    right: unitPx(layer.bounds[2]),
    bottom: unitPx(layer.bounds[3])
  };
}

function unitPx(value) {
  try {
    return value.as("px");
  } catch (error) {
    return Number(value);
  }
}

function assertFileExists(path, label) {
  var file = new File(path);
  if (!file.exists) {
    throw new Error(label + " not found: " + path);
  }
}

function ensureFolderRecursive(folderOrPath) {
  var folder = folderOrPath instanceof Folder ? folderOrPath : new Folder(folderOrPath);
  if (folder.exists) return;
  var stack = [];
  var current = folder;
  while (current && !current.exists) {
    stack.unshift(current);
    current = current.parent;
  }
  var i;
  for (i = 0; i < stack.length; i++) {
    if (!stack[i].exists && !stack[i].create()) {
      throw new Error("Could not create folder: " + stack[i].fsName);
    }
  }
}

function closeDocumentNoSave(doc) {
  if (!doc) return;
  app.activeDocument = doc;
  doc.close(SaveOptions.DONOTSAVECHANGES);
}


function openSmartObjectDocument(parentDoc) {
  var parentId = parentDoc.id;
  executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  for (var attempt = 0; attempt < 100; attempt++) {
    app.refresh();
    if (app.documents.length && app.activeDocument.id !== parentId) {
      if (PREEXISTING_DOCUMENT_IDS[app.activeDocument.id]) throw new Error("The smart object is already open in another document. Close it before retrying.");
      return app.activeDocument;
    }
    $.sleep(100);
  }
  throw new Error("Photoshop did not open the smart object. Retry after Photoshop is ready.");
}

function closeAllOpenDocumentsNoSave() {
  for (var i = app.documents.length - 1; i >= 0; i--) {
    var opened = app.documents[i];
    if (!PREEXISTING_DOCUMENT_IDS[opened.id]) opened.close(SaveOptions.DONOTSAVECHANGES);
  }
}

function removeFileQuiet(path) {
  try {
    var file = new File(path);
    if (file.exists) file.remove();
  } catch (ignoreRemove) {}
}

function writeReport(path, report) {
  var file = new File(path);
  ensureFolderRecursive(file.parent);
  file.encoding = "UTF8";
  if (!file.open("w")) {
    throw new Error("Could not write report: " + file.fsName);
  }
  file.write(JSON.stringify(report, null, 2));
  file.close();
}

function logLine(message) {
  var line = "[" + timestamp() + "] " + message;
  $.writeln(line);
  if (!LOG_FILE) return;
  try {
    ensureFolderRecursive(LOG_FILE.parent);
    LOG_FILE.encoding = "UTF8";
    LOG_FILE.open("a");
    LOG_FILE.writeln(line);
    LOG_FILE.close();
  } catch (logError) {
    $.writeln("Log write failed: " + errorToString(logError));
  }
}

function warn(message) {
  REPORT.warnings.push(message);
  logLine("WARNING: " + message);
}

function errorToObject(error) {
  return {
    message: errorToString(error),
    line: error && error.line ? error.line : null,
    fileName: error && error.fileName ? error.fileName : null
  };
}

function errorToString(error) {
  if (!error) return "Unknown error";
  if (error.message) return String(error.message);
  return String(error);
}

function sanitizeJobId(jobId) {
  return String(jobId).replace(/[^A-Za-z0-9_.-]/g, "_");
}

function toJsxPath(value) {
  return String(value == null ? "" : value).replace(/\\/g, "/");
}

function isTruthy(value) {
  if (value === true) return true;
  var s = trimString(String(value == null ? "" : value)).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function trimString(value) {
  return String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
}

function timestamp() {
  var d = new Date();
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

if (new File(FALLBACK_JSON_PATH).exists && (!JOB_CONTEXT || !new File(JOB_CONTEXT.terminal_path).exists)) main();
