#target photoshop

/*
Internal Employee Badge Generator
Production Photoshop JSX worker script.

Safety boundary: this script is only for internal company badge artwork. It updates
the documented employee badge text fields, internal MRZ/PERFO artwork, and replaces
the employee photo/signature smart-object contents. It does not create official
government identity documents or legal credential artifacts.
*/

app.bringToFront();

var BASE_PATH = resolveAutomationBasePath("C:/EmployeeBadgeAutomation");
var TEMPLATE_DIR = BASE_PATH + "/templates";
var DEFAULT_TEMPLATE_NAME = "EmployeeID.psd";
var INPUT_JSON_PATH = BASE_PATH + "/current-job/input.json";
var OUTPUT_BASE = BASE_PATH + "/output";
var LOG_DIR = BASE_PATH + "/logs";

var LAYER_PATHS = {
  FIRST: "BADGE_CONTENT/EMPLOYEE_INFO/FIRST",
  LAST: "BADGE_CONTENT/EMPLOYEE_INFO/LAST",
  DOCNMBR: "BADGE_CONTENT/DOCUMENT_INFO/DOCNMBR",
  CODE: "BADGE_CONTENT/EMPLOYEE_INFO/CODE",
  ENDVALID: "BADGE_CONTENT/VALIDITY/ENDVALID",
  VALID: "BADGE_CONTENT/VALIDITY/VALID",
  BIRTHDATE: "BADGE_CONTENT/PERSONAL_INFO/BIRTHDATE",
  YEAR: "BADGE_CONTENT/PERSONAL_INFO/YEAR",
  GENDER: "BADGE_CONTENT/PERSONAL_INFO/GENDER",
  HEIGHT: "BADGE_CONTENT/PERSONAL_INFO/HEIGHT",
  COUNTRY: "BADGE_CONTENT/PERSONAL_INFO/COUNTRY",
  CITYBIRTH: "BADGE_CONTENT/PERSONAL_INFO/CITYBIRTH",
  LOCATION: "BADGE_CONTENT/COMPANY_INFO/LOCATION"
};

var TEXT_KEYS = [
  "FIRST",
  "LAST",
  "DOCNMBR",
  "CODE",
  "ENDVALID",
  "VALID",
  "BIRTHDATE",
  "YEAR",
  "GENDER",
  "HEIGHT",
  "COUNTRY",
  "CITYBIRTH",
  "LOCATION"
];

var ACTUAL_TEXT_KEYS = [
  "FIRST",
  "LAST",
  "DOCNMBR",
  "CODE",
  "ENDVALID",
  "VALID",
  "BIRTHDATE",
  "YEAR",
  "GENDER",
  "HEIGHT",
  "COUNTRY",
  "CITYBIRTH",
  "LOCATION",
  "MRZ"
];

var SMART_OBJECTS = {
  MAIN_PHOTO: {
    layerPath: "BADGE_CONTENT/PHOTOS/MAIN_PHOTO",
    imageField: "photo_path",
    internalLayerName: "PHOTO_LAYER",
    required: true
  },
  SIGNATURE_AREA: {
    layerPath: "BADGE_CONTENT/PHOTOS/SIGNATURE_AREA",
    imageField: "signature_path",
    internalLayerName: "SIGNATURE_LAYER",
    required: false
  }
};

var ACTUAL_EMPLOYEEID_TEMPLATE = {
  textSmartObjectPath: "Text/Text Edit",
  smallPhotoLayerPath: "DublePhoto/SMALL_PHOTO",
  signatureLayerPath: "Signature/Signature",
  smallDateLayerPath: "DublePhoto/SMALLDATE",
  perfoLayerPaths: ["PERFO/PERFO1", "PERFO/PERFO2", "PERFO/PERFO3"],
  bigDateFirstPath: "Photo/BIG_DATE_1",
  bigDateLastPath: "Photo/BIG_DATE_2",
  smallPhotoInternalLayer: "SMALL_IMAGE_1",
  signatureInternalLayer: "SIGNATURE_1",
  smallDateFirstLayer: "FIRST_2_DIGITS",
  smallDateLastLayer: "LAST_2_DIGITS"
};

var IMAGE_TARGET_OVERRIDES = {
  SMALL_IMAGE_1: { width: 2421, height: 3292, resolution: 300 }
};

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
  output_folder: null,
  exported_files: [],
  template_mode: null,
  text_updates: [],
  smart_object_updates: [],
  warnings: [],
  errors: [],
  log_file: null
};

var LOG_FILE = null;
var ORIGINAL_DISPLAY_DIALOGS = app.displayDialogs;

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

function main() {
  var doc = null;
  var input = null;
  try {
    app.displayDialogs = DialogModes.NO;
    ensureFolderRecursive(LOG_DIR);
    LOG_FILE = new File(LOG_DIR + "/run_employeeid_job.log");
    REPORT.log_file = LOG_FILE.fsName;
    logLine("Starting Internal Employee Badge job.");

    input = loadInput(INPUT_JSON_PATH);
    REPORT.job_id = sanitizeJobId(input.job_id || "unknown-job");
    var jobOutputFolder = new Folder(OUTPUT_BASE + "/" + REPORT.job_id);
    ensureFolderRecursive(jobOutputFolder);
    REPORT.output_folder = jobOutputFolder.fsName;
    LOG_FILE = new File(LOG_DIR + "/run_employeeid_job_" + REPORT.job_id + ".log");
    REPORT.log_file = LOG_FILE.fsName;
    logLine("Loaded input for job " + REPORT.job_id + ".");

    var templatePath = getTemplatePath(input);
    REPORT.template_path = templatePath;
    assertFileExists(templatePath, "Template PSD");
    doc = app.open(new File(templatePath));
    app.activeDocument = doc;
    logLine("Opened template: " + templatePath);

    var templateMode = detectTemplateMode(doc);
    REPORT.template_mode = templateMode;
    logLine("Detected template mode: " + templateMode);

    if (templateMode === "backbone") {
      updateTextLayersFromTargets(doc, input.psdTextTargets || {});
      updateSmartObjects(doc, input.images || {});
    } else if (templateMode === "actual_employeeid_embedded") {
      updateActualEmployeeIdTemplate(doc, input);
    } else {
      throw new Error("EmployeeID.psd does not match the backbone structure or the detected embedded EmployeeID structure.");
    }

    exportResult(doc, input.export_format || "png", jobOutputFolder.fsName);

    closeDocumentNoSave(doc);
    doc = null;

    REPORT.status = "success";
    REPORT.completed_at = timestamp();
    writeReport(jobOutputFolder.fsName + "/job_report.json", REPORT);
    logLine("Job completed successfully.");
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
      writeReport(errorFolder + "/job_report.json", REPORT);
      writeReport(LOG_DIR + "/last_error_report.json", REPORT);
    } catch (reportError) {
      logLine("Could not write error report: " + errorToString(reportError));
    }

    throw error;
  } finally {
    app.displayDialogs = ORIGINAL_DISPLAY_DIALOGS;
  }
}

function loadInput(path) {
  var file = new File(path);
  assertFileExists(file.fsName, "Input JSON");
  file.encoding = "UTF8";
  if (!file.open("r")) {
    throw new Error("Could not open input JSON: " + file.fsName);
  }
  var text = file.read();
  file.close();
  if (!text || text.replace(/\s/g, "") === "") {
    throw new Error("Input JSON is empty: " + file.fsName);
  }
  return JSON.parse(text);
}

function getTemplatePath(input) {
  var templateName = input.template || DEFAULT_TEMPLATE_NAME;
  templateName = String(templateName).replace(/\\/g, "/");
  if (templateName.indexOf("/") >= 0 || templateName.indexOf(":") >= 0) {
    return templateName;
  }
  return TEMPLATE_DIR + "/" + templateName;
}

function detectTemplateMode(doc) {
  if (
    findLayerByPath(doc, "BADGE_CONTENT/EMPLOYEE_INFO/FIRST") &&
    findLayerByPath(doc, "BADGE_CONTENT/PHOTOS/MAIN_PHOTO")
  ) {
    return "backbone";
  }
  if (
    findLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.textSmartObjectPath) &&
    findLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.smallPhotoLayerPath)
  ) {
    return "actual_employeeid_embedded";
  }
  return "unknown";
}

function updateActualEmployeeIdTemplate(doc, input) {
  var psdTextTargets = input.psdTextTargets || {};
  var images = input.images || {};

  updateTextSmartObjectByPath(
    doc,
    ACTUAL_EMPLOYEEID_TEMPLATE.textSmartObjectPath,
    psdTextTargets,
    ACTUAL_TEXT_KEYS,
    "employee text smart object"
  );

  updateBirthYearLayers(doc, input);
  updatePerfoLayers(doc, input);

  updateSmartObjectByPath(
    doc,
    ACTUAL_EMPLOYEEID_TEMPLATE.smallPhotoLayerPath,
    images.photo_path,
    ACTUAL_EMPLOYEEID_TEMPLATE.smallPhotoInternalLayer,
    true
  );

  updateSmartObjectByPath(
    doc,
    ACTUAL_EMPLOYEEID_TEMPLATE.signatureLayerPath,
    images.signature_path,
    ACTUAL_EMPLOYEEID_TEMPLATE.signatureInternalLayer,
    false
  );

  logLine("Updated actual EmployeeID template text, MRZ, PERFO, SMALL_PHOTO, signature, and date targets.");
}

function updateTextLayersFromTargets(doc, psdTextTargets) {
  var i;
  for (i = 0; i < TEXT_KEYS.length; i++) {
    var key = TEXT_KEYS[i];
    var path = LAYER_PATHS[key];
    var value = psdTextTargets[key];
    if (value === undefined || value === null || String(value) === "") {
      warn("Skipping empty text value for " + key + ".");
      continue;
    }

    var layer = findLayerByPath(doc, path);
    if (!layer) {
      throw new Error("Missing text layer for " + key + " at path " + path);
    }
    if (!isTextLayer(layer)) {
      throw new Error("Layer " + path + " exists but is not a text layer.");
    }

    app.activeDocument = doc;
    doc.activeLayer = layer;
    var previous = "";
    try {
      previous = layer.textItem.contents;
    } catch (readError) {
      previous = "";
    }
    layer.textItem.contents = String(value);
    REPORT.text_updates.push({
      key: key,
      path: path,
      previous: previous,
      value: String(value)
    });
    logLine("Updated text layer " + key + " at " + path + ".");
  }
}

function updateTextSmartObjectByPath(parentDoc, layerPath, psdTextTargets, keys, label) {
  app.activeDocument = parentDoc;
  var smartLayer = findLayerByPath(parentDoc, layerPath);
  if (!smartLayer) {
    throw new Error("Missing " + label + " at path " + layerPath);
  }
  if (!isSmartObjectLayer(smartLayer)) {
    throw new Error("Layer " + layerPath + " exists but is not a smart object.");
  }

  parentDoc.activeLayer = smartLayer;
  executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  var subDoc = app.activeDocument;
  logLine("Opened " + label + " as " + subDoc.name + ".");

  try {
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = psdTextTargets[key];
      if (value === undefined || value === null || String(value) === "") {
        warn("Skipping empty nested text value for " + key + ".");
        continue;
      }
      var layer = findLayerByNameDeep(subDoc, key);
      if (!layer) {
        throw new Error("Missing nested text layer " + key + " inside " + layerPath);
      }
      if (!isTextLayer(layer)) {
        throw new Error("Nested layer " + key + " inside " + layerPath + " is not a text layer.");
      }
      subDoc.activeLayer = layer;
      var previous = "";
      try {
        previous = layer.textItem.contents;
      } catch (readError) {
        previous = "";
      }
      layer.textItem.contents = prepareTextContents(value);
      REPORT.text_updates.push({
        key: key,
        path: layerPath + "/" + key,
        previous: previous,
        value: String(value)
      });
      logLine("Updated nested text layer " + key + " inside " + layerPath + ".");
    }

    subDoc.save();
    subDoc.close(SaveOptions.SAVECHANGES);
    app.activeDocument = parentDoc;
    REPORT.smart_object_updates.push({
      path: layerPath,
      status: "nested text updated"
    });
  } catch (error) {
    try {
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {
      logLine("Could not close failed text smart object: " + errorToString(closeError));
    }
    app.activeDocument = parentDoc;
    throw error;
  }
}

function updateBirthYearLayers(doc, input) {
  var yearInfo = getBirthYearInfo(input);
  if (!yearInfo) {
    warn("Skipping birth-year layers because YEAR is missing or invalid.");
    return;
  }

  updateOptionalTextLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.bigDateFirstPath, "BIG_DATE_1", yearInfo.full);
  updateOptionalTextLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.bigDateLastPath, "BIG_DATE_2", yearInfo.full);

  app.activeDocument = doc;
  var smallDateLayer = findLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath);
  if (!smallDateLayer) {
    warn("Skipping SMALLDATE because layer was not found at " + ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath + ".");
    return;
  }
  if (!isSmartObjectLayer(smallDateLayer)) {
    warn("Skipping SMALLDATE because layer is not a smart object.");
    return;
  }

  doc.activeLayer = smallDateLayer;
  executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  var subDoc = app.activeDocument;
  try {
    updateOptionalTextLayerByName(subDoc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateFirstLayer, yearInfo.first, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath);
    updateOptionalTextLayerByName(subDoc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLastLayer, yearInfo.last, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath);
    subDoc.save();
    subDoc.close(SaveOptions.SAVECHANGES);
    app.activeDocument = doc;
    REPORT.smart_object_updates.push({
      path: ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath,
      status: "birth year split updated"
    });
  } catch (error) {
    try {
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {}
    app.activeDocument = doc;
    throw error;
  }
}

function getBirthYearInfo(input) {
  var year = "";
  try {
    year = String((input.psdTextTargets && input.psdTextTargets.YEAR) || (input.employee && input.employee.birth_year) || "");
  } catch (error) {
    year = "";
  }
  year = year.replace(/[^0-9]/g, "");
  if (year.length < 4) return null;
  return {
    full: year.substring(0, 4),
    first: year.substring(0, 2),
    last: year.substring(2, 4)
  };
}

function updatePerfoLayers(doc, input) {
  var perfo = getPerfoString(input);
  if (!perfo) {
    warn("Skipping PERFO because no PERFO_STRING could be derived.");
    return;
  }
  var i;
  for (i = 0; i < ACTUAL_EMPLOYEEID_TEMPLATE.perfoLayerPaths.length; i++) {
    updatePerfoSmartObjectByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.perfoLayerPaths[i], perfo);
  }
}

var MONTH_CODES = [
  "JAN/JAN", "FEB/FEB", "MAA/MAR", "APR/APR", "MEI/MAY", "JUN/JUN",
  "JUL/JUL", "AUG/AUG", "SEP/SEP", "OKT/OCT", "NOV/NOV", "DEC/DEC"
];

function monthCodeFromNumber(monthNumber) {
  var idx = parseInt(monthNumber, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return "";
  return MONTH_CODES[idx];
}

function isValidMonthCode(value) {
  for (var i = 0; i < MONTH_CODES.length; i++) {
    if (MONTH_CODES[i] === value) return true;
  }
  return false;
}

function getPerfoString(input) {
  var raw = "";
  try {
    raw = String(
      (input.perfo && input.perfo.string) ||
      (input.psdTextTargets && input.psdTextTargets.PERFO_STRING) ||
      ""
    );
  } catch (error) {
    raw = "";
  }
  var match = /^([A-Z]{3}\/[A-Z]{3})(\d{4})$/.exec(raw);
  if (match && isValidMonthCode(match[1])) return raw;

  var yearInfo = getBirthYearInfo(input);
  var birth = "";
  try {
    birth = String((input.employee && input.employee.birth_date) || (input.psdTextTargets && input.psdTextTargets.BIRTHDATE) || "");
  } catch (error) {
    birth = "";
  }
  var month = extractMonth(birth);
  if (month && yearInfo) return month + yearInfo.full;
  return "";
}

function extractMonth(dateText) {
  var text = String(dateText || "");
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (m) return monthCodeFromNumber(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) return monthCodeFromNumber(m[2]);
  return "";
}

function pad2(value) {
  value = String(value || "");
  return value.length === 1 ? "0" + value : value;
}

function updatePerfoSmartObjectByPath(parentDoc, layerPath, perfoString) {
  app.activeDocument = parentDoc;
  var smartLayer = findLayerByPath(parentDoc, layerPath);
  if (!smartLayer) {
    warn("Skipping PERFO layer because " + layerPath + " was not found.");
    return;
  }
  if (!isSmartObjectLayer(smartLayer)) {
    warn("Skipping PERFO layer because " + layerPath + " is not a smart object.");
    return;
  }

  parentDoc.activeLayer = smartLayer;
  executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  var subDoc = app.activeDocument;
  try {
    var layers = [];
    collectTextLayers(subDoc, layers);
    layers.sort(function (a, b) { return layerTop(a) - layerTop(b); });
    var digits = perfoString.split("");
    var wrote = 0;
    var i;
    if (layers.length >= digits.length) {
      for (i = 0; i < digits.length; i++) {
        layers[i].textItem.contents = digits[i];
        wrote++;
      }
    } else if (layers.length === 1) {
      layers[0].textItem.contents = digits.join("\r");
      wrote = digits.length;
    } else if (layers.length > 0) {
      for (i = 0; i < layers.length - 1 && i < digits.length; i++) {
        layers[i].textItem.contents = digits[i];
        wrote++;
      }
      layers[layers.length - 1].textItem.contents = digits.slice(layers.length - 1).join("\r");
      wrote++;
    } else {
      throw new Error("No text layers found inside PERFO smart object " + layerPath);
    }
    subDoc.save();
    subDoc.close(SaveOptions.SAVECHANGES);
    app.activeDocument = parentDoc;
    REPORT.text_updates.push({
      key: "PERFO",
      path: layerPath,
      previous: "",
      value: perfoString
    });
    REPORT.smart_object_updates.push({
      path: layerPath,
      status: "PERFO updated",
      digits_written: wrote
    });
    logLine("Updated PERFO " + layerPath + " with " + perfoString + ".");
  } catch (error) {
    try {
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {}
    app.activeDocument = parentDoc;
    throw error;
  }
}

function collectTextLayers(container, out) {
  if (!container.layers) return;
  var i;
  for (i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (isTextLayer(layer)) out.push(layer);
    if (layer.typename === "LayerSet") collectTextLayers(layer, out);
  }
}

function layerTop(layer) {
  try {
    return unitPx(layer.bounds[1]);
  } catch (error) {
    return 0;
  }
}

function prepareTextContents(value) {
  return String(value).replace(/\r\n/g, "\r").replace(/\n/g, "\r");
}

function updateOptionalTextLayerByPath(doc, path, key, value) {
  var layer = findLayerByPath(doc, path);
  if (!layer) {
    warn("Skipping optional text layer " + key + " because " + path + " was not found.");
    return;
  }
  if (!isTextLayer(layer)) {
    warn("Skipping optional text layer " + key + " because it is not a text layer.");
    return;
  }
  app.activeDocument = doc;
  doc.activeLayer = layer;
  var previous = "";
  try {
    previous = layer.textItem.contents;
  } catch (readError) {}
  layer.textItem.contents = prepareTextContents(value);
  REPORT.text_updates.push({
    key: key,
    path: path,
    previous: previous,
    value: String(value)
  });
}

function updateOptionalTextLayerByName(doc, name, value, parentPath) {
  var layer = findLayerByNameDeep(doc, name);
  if (!layer) {
    warn("Skipping optional text layer " + name + " because it was not found inside " + parentPath + ".");
    return;
  }
  if (!isTextLayer(layer)) {
    warn("Skipping optional text layer " + name + " because it is not a text layer.");
    return;
  }
  app.activeDocument = doc;
  doc.activeLayer = layer;
  var previous = "";
  try {
    previous = layer.textItem.contents;
  } catch (readError) {}
  layer.textItem.contents = prepareTextContents(value);
  REPORT.text_updates.push({
    key: name,
    path: parentPath + "/" + name,
    previous: previous,
    value: String(value)
  });
}

function updateSmartObjects(doc, images) {
  updateSmartObjectByPath(
    doc,
    SMART_OBJECTS.MAIN_PHOTO.layerPath,
    images[SMART_OBJECTS.MAIN_PHOTO.imageField],
    SMART_OBJECTS.MAIN_PHOTO.internalLayerName,
    SMART_OBJECTS.MAIN_PHOTO.required
  );

  updateSmartObjectByPath(
    doc,
    SMART_OBJECTS.SIGNATURE_AREA.layerPath,
    images[SMART_OBJECTS.SIGNATURE_AREA.imageField],
    SMART_OBJECTS.SIGNATURE_AREA.internalLayerName,
    SMART_OBJECTS.SIGNATURE_AREA.required
  );
}

function updateSmartObjectByPath(parentDoc, layerPath, imagePath, internalLayerName, required) {
  if (!imagePath || String(imagePath) === "") {
    if (required) {
      throw new Error("Required image path is missing for smart object " + layerPath);
    }
    warn("Skipping optional smart object " + layerPath + " because no image path was provided.");
    return;
  }

  imagePath = String(imagePath);
  assertFileExists(imagePath, "Image for smart object " + layerPath);

  app.activeDocument = parentDoc;
  var smartLayer = findLayerByPath(parentDoc, layerPath);
  if (!smartLayer) {
    throw new Error("Missing smart object layer at path " + layerPath);
  }
  if (!isSmartObjectLayer(smartLayer)) {
    throw new Error("Layer " + layerPath + " exists but is not a smart object.");
  }

  parentDoc.activeLayer = smartLayer;
  executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  var subDoc = app.activeDocument;
  logLine("Opened smart object " + layerPath + " as " + subDoc.name + ".");

  try {
    var targetLayer = findLayerByNameDeep(subDoc, internalLayerName);
    if (!targetLayer) {
      throw new Error("Smart object " + layerPath + " is missing internal layer " + internalLayerName + ".");
    }
    if (targetLayer.typename !== "ArtLayer") {
      throw new Error("Internal target " + internalLayerName + " in " + layerPath + " is not an art layer.");
    }

    replaceInternalImageLayer(subDoc, targetLayer, imagePath, internalLayerName);
    subDoc.save();
    subDoc.close(SaveOptions.SAVECHANGES);
    app.activeDocument = parentDoc;

    REPORT.smart_object_updates.push({
      path: layerPath,
      internal_layer: internalLayerName,
      image_path: imagePath,
      status: "updated"
    });
    logLine("Saved smart object update for " + layerPath + ".");
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

function replaceInternalImageLayer(subDoc, targetLayer, imagePath, targetName) {
  app.activeDocument = subDoc;
  unlockLayer(targetLayer);
  subDoc.activeLayer = targetLayer;
  var targetBounds = getReplacementBounds(subDoc, targetLayer, targetName);
  var sizeOverride = getImageTargetOverride(targetName);
  if (sizeOverride) {
    targetBounds.right = targetBounds.left + sizeOverride.width;
    targetBounds.bottom = targetBounds.top + sizeOverride.height;
  }
  var targetWidth = targetBounds.right - targetBounds.left;
  var targetHeight = targetBounds.bottom - targetBounds.top;
  var targetResolution = sizeOverride && sizeOverride.resolution ? sizeOverride.resolution : subDoc.resolution;
  logLine(
    "Image target " + targetName + " bounds: " +
    Math.round(targetWidth) + "x" + Math.round(targetHeight) +
    " px at x=" + Math.round(targetBounds.left) +
    ", y=" + Math.round(targetBounds.top) +
    (sizeOverride ? " using configured exact size." : ".")
  );

  if (isSmartObjectLayer(targetLayer) && !sizeOverride) {
    try {
      replaceSmartObjectContents(imagePath);
      subDoc.activeLayer.name = targetName;
      return;
    } catch (replaceError) {
      warn("Smart object content replacement failed for " + targetName + "; falling back to paste flow: " + errorToString(replaceError));
      subDoc.activeLayer = targetLayer;
    }
  }

  try {
    subDoc.selection.selectAll();
    subDoc.selection.clear();
    subDoc.selection.deselect();
  } catch (clearError) {
    warn("Could not clear existing pixels in " + targetName + ": " + errorToString(clearError));
    try {
      subDoc.selection.deselect();
    } catch (ignoreDeselect) {}
  }

  copyImagePixelsResizedTo(imagePath, targetWidth, targetHeight, targetResolution);
  app.activeDocument = subDoc;
  subDoc.activeLayer = targetLayer;
  subDoc.paste();
  var pasted = subDoc.activeLayer;
  pasted.name = targetName + "_REPLACEMENT";
  fitLayerToBounds(subDoc, pasted, targetBounds);

  try {
    pasted.merge();
    subDoc.activeLayer.name = targetName;
  } catch (mergeError) {
    warn("Could not merge replacement pixels into " + targetName + ". Leaving pasted layer in smart object: " + errorToString(mergeError));
  }
}

function getReplacementBounds(doc, targetLayer, targetName) {
  var bounds = getLayerBoundsPx(targetLayer);
  var width = bounds.right - bounds.left;
  var height = bounds.bottom - bounds.top;
  if (width > 0 && height > 0) {
    return bounds;
  }

  warn("Layer " + targetName + " has empty bounds; using the full smart-object canvas as the image target.");
  return {
    left: 0,
    top: 0,
    right: unitPx(doc.width),
    bottom: unitPx(doc.height)
  };
}

function getImageTargetOverride(targetName) {
  if (!targetName) return null;
  return IMAGE_TARGET_OVERRIDES[String(targetName)] || null;
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
    resizeImageDocumentToExactPixels(imageDoc, widthPx, heightPx, resolution);
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

function resizeImageDocumentToExactPixels(imageDoc, widthPx, heightPx, resolution) {
  var targetWidth = Math.max(1, Math.round(widthPx));
  var targetHeight = Math.max(1, Math.round(heightPx));
  var beforeWidth = Math.round(unitPx(imageDoc.width));
  var beforeHeight = Math.round(unitPx(imageDoc.height));
  var resampleMethod = ResampleMethod.BICUBIC;
  try {
    resampleMethod = ResampleMethod.BICUBICAUTOMATIC;
  } catch (ignoreMethod) {}

  imageDoc.resizeImage(UnitValue(targetWidth, "px"), UnitValue(targetHeight, "px"), resolution, resampleMethod);
  logLine("Resized source image from " + beforeWidth + "x" + beforeHeight + " px to " + targetWidth + "x" + targetHeight + " px before paste.");
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

  var scaleX = (targetWidth / layerWidth) * 100;
  var scaleY = (targetHeight / layerHeight) * 100;
  if (Math.abs(scaleX - 100) > 0.1 || Math.abs(scaleY - 100) > 0.1) {
    layer.resize(scaleX, scaleY, AnchorPosition.TOPLEFT);
  }

  bounds = getLayerBoundsPx(layer);
  layer.translate(targetBounds.left - bounds.left, targetBounds.top - bounds.top);
}

function exportResult(doc, format, outputFolderPath) {
  var normalized = String(format || "png").toLowerCase();
  if (normalized === "all") {
    exportPNG(doc, outputFolderPath + "/result.png");
    exportPDF(doc, outputFolderPath + "/result.pdf");
    exportPSD(doc, outputFolderPath + "/result.psd");
    return;
  }
  if (normalized === "png") {
    exportPNG(doc, outputFolderPath + "/result.png");
    return;
  }
  if (normalized === "pdf") {
    exportPDF(doc, outputFolderPath + "/result.pdf");
    return;
  }
  if (normalized === "psd") {
    exportPSD(doc, outputFolderPath + "/result.psd");
    return;
  }
  throw new Error("Unsupported export_format: " + format);
}

function exportPNG(doc, outputPath) {
  var duplicate = null;
  var originalBackground = app.backgroundColor;
  try {
    duplicate = doc.duplicate("badge_png_export", true);
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
  }
}

function setDocumentResolutionNoResample(doc, dpi) {
  try {
    doc.resizeImage(undefined, undefined, dpi, ResampleMethod.NONE);
  } catch (error) {
    warn("Could not set PNG resolution metadata to " + dpi + " DPI without resampling: " + errorToString(error));
  }
}

function exportPDF(doc, outputPath) {
  var pdfOptions = new PDFSaveOptions();
  try {
    pdfOptions.pDFPreset = "[High Quality Print]";
  } catch (presetError) {
    warn("Could not apply High Quality Print PDF preset: " + errorToString(presetError));
  }
  try {
    pdfOptions.embedColorProfile = true;
  } catch (embedError) {}
  try {
    pdfOptions.layers = true;
  } catch (layersError) {}
  doc.saveAs(new File(outputPath), pdfOptions, true, Extension.LOWERCASE);
  REPORT.exported_files.push(outputPath);
  logLine("Exported PDF: " + outputPath);
}

function exportPSD(doc, outputPath) {
  var psdOptions = new PhotoshopSaveOptions();
  psdOptions.layers = true;
  try {
    psdOptions.maximizeCompatibility = true;
  } catch (compatibilityError) {}
  doc.saveAs(new File(outputPath), psdOptions, true, Extension.LOWERCASE);
  REPORT.exported_files.push(outputPath);
  logLine("Exported PSD: " + outputPath);
}

function findLayerByPath(container, path) {
  var parts = String(path).split("/");
  var current = container;
  var i;
  for (i = 0; i < parts.length; i++) {
    current = findDirectChildLayer(current, parts[i]);
    if (!current) return null;
  }
  return current;
}

function findDirectChildLayer(container, name) {
  if (!container.layers) return null;
  var i;
  for (i = 0; i < container.layers.length; i++) {
    if (container.layers[i].name === name) {
      return container.layers[i];
    }
  }
  return null;
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

function isTextLayer(layer) {
  try {
    return layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT;
  } catch (error) {
    return false;
  }
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

function closeAllOpenDocumentsNoSave() {
  while (app.documents.length > 0) {
    app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
  }
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

function timestamp() {
  var d = new Date();
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

main();
