#target photoshop

/*
Template verifier for the Internal Employee Badge Generator.

Run this in Photoshop before production use. It opens the template, verifies the
documented internal badge layers, checks smart objects, reports fonts, and closes
without saving.
*/

app.bringToFront();

var BASE_PATH = resolveAutomationBasePath("C:/EmployeeBadgeAutomation");
var TEMPLATE_PATH = BASE_PATH + "/templates/EmployeeID.psd";
var LOG_DIR = BASE_PATH + "/logs";
var REPORT_PATH = LOG_DIR + "/template_verification.json";

var TEXT_LAYER_PATHS = {
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

var SMART_OBJECTS = [
  {
    key: "MAIN_PHOTO",
    path: "BADGE_CONTENT/PHOTOS/MAIN_PHOTO",
    internalTarget: "PHOTO_LAYER",
    required: true
  },
  {
    key: "SIGNATURE_AREA",
    path: "BADGE_CONTENT/PHOTOS/SIGNATURE_AREA",
    internalTarget: "SIGNATURE_LAYER",
    required: false
  }
];

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

var REQUIRED_FONTS = ["Helvetica", "Helvetica-Bold"];

if (typeof JSON === "undefined") {
  JSON = {};
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
      if (v && typeof v === "object" && typeof v.toJSON === "function") v = v.toJSON(key);
      if (typeof replacer === "function") v = replacer.call(holder, key, v);
      if (v === null) return "null";
      if (typeof v === "string") return quote(v);
      if (typeof v === "number") return isFinite(v) ? String(v) : "null";
      if (typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        gap += indent;
        partial = [];
        if (Object.prototype.toString.apply(v) === "[object Array]") {
          for (i = 0; i < v.length; i++) partial[i] = str(i, v) || "null";
          v = partial.length === 0 ? "[]" : (indent ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]");
          gap = mind;
          return v;
        }
        for (k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            var item = str(k, v);
            if (item) partial.push(quote(k) + (indent ? ": " : ":") + item);
          }
        }
        v = partial.length === 0 ? "{}" : (indent ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}");
        gap = mind;
        return v;
      }
      return undefined;
    }

    return str("", { "": value });
  };
}

var REPORT = {
  script: "verify_template.jsx",
  template_path: TEMPLATE_PATH,
  checked_at: timestamp(),
  status: "started",
  template_mode: null,
  document: null,
  expected_text_layers: [],
  smart_objects: [],
  fonts: {
    required: REQUIRED_FONTS,
    required_available: [],
    required_missing: [],
    used_text_fonts: [],
    installed_matches: []
  },
  warnings: [],
  errors: []
};

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
  try {
    app.displayDialogs = DialogModes.NO;
    ensureFolderRecursive(LOG_DIR);
    assertFileExists(TEMPLATE_PATH, "Template PSD");

    doc = app.open(new File(TEMPLATE_PATH));
    app.activeDocument = doc;
    REPORT.document = {
      name: doc.name,
      width_px: unitPx(doc.width),
      height_px: unitPx(doc.height),
      resolution: doc.resolution,
      mode: safeString(doc.mode),
      bits_per_channel: safeString(doc.bitsPerChannel)
    };

    var mode = detectTemplateMode(doc);
    REPORT.template_mode = mode;
    if (mode === "backbone") {
      verifyTextLayers(doc);
      verifySmartObjects(doc);
    } else if (mode === "actual_employeeid_embedded") {
      verifyActualEmployeeIdTemplate(doc);
    } else {
      addError("Template does not match the documented BADGE_CONTENT backbone or the detected embedded EmployeeID.psd structure.");
    }
    collectFontReport(doc);

    REPORT.status = REPORT.errors.length ? "failed" : (REPORT.warnings.length ? "warning" : "passed");
    writeReport(REPORT_PATH, REPORT);
    closeDocumentNoSave(doc);
    doc = null;
    alert("Template verification " + REPORT.status + ". Report written to:\n" + REPORT_PATH);
  } catch (error) {
    REPORT.status = "error";
    REPORT.errors.push(errorToObject(error));
    try {
      writeReport(REPORT_PATH, REPORT);
    } catch (writeError) {}
    try {
      if (doc) closeDocumentNoSave(doc);
    } catch (closeError) {}
    throw error;
  } finally {
    app.displayDialogs = ORIGINAL_DISPLAY_DIALOGS;
  }
}

function verifyTextLayers(doc) {
  var i;
  for (i = 0; i < TEXT_KEYS.length; i++) {
    var key = TEXT_KEYS[i];
    var path = TEXT_LAYER_PATHS[key];
    var layer = findLayerByPath(doc, path);
    var entry = {
      key: key,
      expected_path: path,
      exists: !!layer,
      is_text_layer: false,
      layer_kind: null,
      font: null,
      size: null,
      sample_contents: null
    };
    if (!layer) {
      addError("Missing expected text layer " + key + " at " + path);
    } else {
      entry.layer_kind = getLayerKindName(layer);
      entry.is_text_layer = isTextLayer(layer);
      if (!entry.is_text_layer) {
        addError("Expected text layer " + path + " exists but is " + entry.layer_kind + ".");
      } else {
        entry.font = safeTextFont(layer);
        entry.size = safeTextSize(layer);
        entry.sample_contents = safeTextContents(layer);
      }
    }
    REPORT.expected_text_layers.push(entry);
  }
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

function verifyActualEmployeeIdTemplate(doc) {
  verifyActualTextSmartObject(doc);
  verifyActualBirthYearLayers(doc);
  verifyActualPerfoLayers(doc);
  verifyActualImageSmartObject(doc, "SMALL_PHOTO", ACTUAL_EMPLOYEEID_TEMPLATE.smallPhotoLayerPath, ACTUAL_EMPLOYEEID_TEMPLATE.smallPhotoInternalLayer, true);
  verifyActualImageSmartObject(doc, "SIGNATURE", ACTUAL_EMPLOYEEID_TEMPLATE.signatureLayerPath, ACTUAL_EMPLOYEEID_TEMPLATE.signatureInternalLayer, false);
}

function verifyActualTextSmartObject(doc) {
  var path = ACTUAL_EMPLOYEEID_TEMPLATE.textSmartObjectPath;
  var layer = findLayerByPath(doc, path);
  if (!layer) {
    addError("Missing actual EmployeeID text smart object at " + path);
    return;
  }
  if (!isSmartObjectLayer(layer)) {
    addError("Actual EmployeeID text layer " + path + " is not a smart object.");
    return;
  }

  try {
    app.activeDocument = doc;
    doc.activeLayer = layer;
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
    var subDoc = app.activeDocument;
    var i;
    for (i = 0; i < ACTUAL_TEXT_KEYS.length; i++) {
      var key = ACTUAL_TEXT_KEYS[i];
      var nested = findLayerByNameDeep(subDoc, key);
      var entry = {
        key: key,
        expected_path: path + "/" + key,
        exists: !!nested,
        is_text_layer: false,
        layer_kind: null,
        font: null,
        size: null,
        sample_contents: null
      };
      if (!nested) {
        addError("Missing nested text layer " + key + " inside " + path);
      } else {
        entry.layer_kind = getLayerKindName(nested);
        entry.is_text_layer = isTextLayer(nested);
        if (!entry.is_text_layer) {
          addError("Nested layer " + key + " inside " + path + " is not a text layer.");
        } else {
          entry.font = safeTextFont(nested);
          entry.size = safeTextSize(nested);
          entry.sample_contents = safeTextContents(nested);
        }
      }
      REPORT.expected_text_layers.push(entry);
    }
    subDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
  } catch (error) {
    addError("Could not inspect actual EmployeeID text smart object: " + errorToString(error));
    try {
      if (app.documents.length > 0 && app.activeDocument !== doc) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (closeError) {}
    app.activeDocument = doc;
  }
}

function verifyActualBirthYearLayers(doc) {
  verifyOptionalTextPath(doc, "BIG_DATE_1", ACTUAL_EMPLOYEEID_TEMPLATE.bigDateFirstPath);
  verifyOptionalTextPath(doc, "BIG_DATE_2", ACTUAL_EMPLOYEEID_TEMPLATE.bigDateLastPath);

  var layer = findLayerByPath(doc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath);
  if (!layer) {
    addWarning("SMALLDATE smart object was not found at " + ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath + ".");
    return;
  }
  if (!isSmartObjectLayer(layer)) {
    addWarning("SMALLDATE layer exists but is not a smart object.");
    return;
  }

  try {
    app.activeDocument = doc;
    doc.activeLayer = layer;
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
    var subDoc = app.activeDocument;
    verifyNestedOptionalText(subDoc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateFirstLayer);
    verifyNestedOptionalText(subDoc, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLayerPath, ACTUAL_EMPLOYEEID_TEMPLATE.smallDateLastLayer);
    subDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
  } catch (error) {
    addWarning("Could not inspect SMALLDATE smart object: " + errorToString(error));
    try {
      if (app.documents.length > 0 && app.activeDocument !== doc) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (closeError) {}
    app.activeDocument = doc;
  }
}

function verifyOptionalTextPath(doc, key, path) {
  var layer = findLayerByPath(doc, path);
  var entry = {
    key: key,
    expected_path: path,
    exists: !!layer,
    is_text_layer: false,
    layer_kind: null,
    font: null,
    size: null,
    sample_contents: null,
    optional_supporting_layer: true
  };
  if (!layer) {
    addWarning("Optional supporting text layer " + key + " was not found at " + path + ".");
  } else {
    entry.layer_kind = getLayerKindName(layer);
    entry.is_text_layer = isTextLayer(layer);
    if (entry.is_text_layer) {
      entry.font = safeTextFont(layer);
      entry.size = safeTextSize(layer);
      entry.sample_contents = safeTextContents(layer);
    } else {
      addWarning("Optional supporting layer " + key + " exists but is not text.");
    }
  }
  REPORT.expected_text_layers.push(entry);
}

function verifyNestedOptionalText(doc, parentPath, key) {
  var layer = findLayerByNameDeep(doc, key);
  var entry = {
    key: key,
    expected_path: parentPath + "/" + key,
    exists: !!layer,
    is_text_layer: false,
    layer_kind: null,
    optional_supporting_layer: true
  };
  if (!layer) {
    addWarning("Optional supporting nested text layer " + key + " was not found inside " + parentPath + ".");
  } else {
    entry.layer_kind = getLayerKindName(layer);
    entry.is_text_layer = isTextLayer(layer);
    if (!entry.is_text_layer) addWarning("Optional supporting nested layer " + key + " is not text.");
  }
  REPORT.expected_text_layers.push(entry);
}

function verifyActualPerfoLayers(doc) {
  var i;
  for (i = 0; i < ACTUAL_EMPLOYEEID_TEMPLATE.perfoLayerPaths.length; i++) {
    var path = ACTUAL_EMPLOYEEID_TEMPLATE.perfoLayerPaths[i];
    var layer = findLayerByPath(doc, path);
    var entry = {
      key: "PERFO" + (i + 1),
      expected_path: path,
      required: true,
      exists: !!layer,
      is_smart_object: false,
      smart_object_info: null,
      internal_document_name: null,
      internal_target: "one or more text layers",
      internal_target_exists: false,
      internal_layers: []
    };
    if (!layer) {
      addError("Missing PERFO smart object at " + path);
      REPORT.smart_objects.push(entry);
      continue;
    }
    entry.is_smart_object = isSmartObjectLayer(layer);
    entry.smart_object_info = getSmartObjectInfo(doc, layer);
    if (!entry.is_smart_object) {
      addError("PERFO layer " + path + " exists but is not a smart object.");
      REPORT.smart_objects.push(entry);
      continue;
    }
    try {
      app.activeDocument = doc;
      doc.activeLayer = layer;
      executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
      var subDoc = app.activeDocument;
      var textLayers = [];
      collectTextLayers(subDoc, textLayers);
      entry.internal_document_name = subDoc.name;
      entry.internal_layers = collectLayerTree(subDoc, "");
      entry.internal_target_exists = textLayers.length > 0;
      if (!entry.internal_target_exists) {
        addError("PERFO smart object " + path + " opened, but no text layers were found.");
      }
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
      app.activeDocument = doc;
    } catch (error) {
      addError("Could not inspect PERFO smart object " + path + ": " + errorToString(error));
      try {
        if (app.documents.length > 0 && app.activeDocument !== doc) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
      } catch (closeError) {}
      app.activeDocument = doc;
    }
    REPORT.smart_objects.push(entry);
  }
}

function verifyActualImageSmartObject(doc, key, path, internalTarget, required) {
  var layer = findLayerByPath(doc, path);
  var entry = {
    key: key,
    expected_path: path,
    required: required,
    exists: !!layer,
    is_smart_object: false,
    smart_object_info: null,
    internal_document_name: null,
    internal_target: internalTarget,
    internal_target_exists: false,
    internal_layers: []
  };
  if (!layer) {
    if (required) addError("Missing actual EmployeeID smart object " + key + " at " + path);
    else addWarning("Optional actual EmployeeID smart object " + key + " not found at " + path);
    REPORT.smart_objects.push(entry);
    return;
  }
  entry.is_smart_object = isSmartObjectLayer(layer);
  entry.smart_object_info = getSmartObjectInfo(doc, layer);
  if (!entry.is_smart_object) {
    if (required) addError("Layer " + path + " exists but is not a smart object.");
    else addWarning("Optional layer " + path + " exists but is not a smart object.");
    REPORT.smart_objects.push(entry);
    return;
  }

  try {
    app.activeDocument = doc;
    doc.activeLayer = layer;
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
    var subDoc = app.activeDocument;
    entry.internal_document_name = subDoc.name;
    entry.internal_layers = collectLayerTree(subDoc, "");
    entry.internal_target_exists = !!findLayerByNameDeep(subDoc, internalTarget);
    if (!entry.internal_target_exists) {
      if (required) addError("Smart object " + key + " opened, but internal layer " + internalTarget + " was not found.");
      else addWarning("Optional smart object " + key + " opened, but internal layer " + internalTarget + " was not found.");
    }
    subDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
  } catch (error) {
    if (required) addError("Could not inspect smart object " + key + ": " + errorToString(error));
    else addWarning("Could not inspect optional smart object " + key + ": " + errorToString(error));
    try {
      if (app.documents.length > 0 && app.activeDocument !== doc) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (closeError) {}
    app.activeDocument = doc;
  }
  REPORT.smart_objects.push(entry);
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

function verifySmartObjects(doc) {
  var i;
  for (i = 0; i < SMART_OBJECTS.length; i++) {
    var spec = SMART_OBJECTS[i];
    var layer = findLayerByPath(doc, spec.path);
    var entry = {
      key: spec.key,
      expected_path: spec.path,
      required: spec.required,
      exists: !!layer,
      is_smart_object: false,
      smart_object_info: null,
      internal_document_name: null,
      internal_target: spec.internalTarget,
      internal_target_exists: false,
      internal_layers: []
    };

    if (!layer) {
      var missingMessage = "Missing smart object " + spec.key + " at " + spec.path;
      if (spec.required) addError(missingMessage); else addWarning(missingMessage);
      REPORT.smart_objects.push(entry);
      continue;
    }

    entry.is_smart_object = isSmartObjectLayer(layer);
    entry.smart_object_info = getSmartObjectInfo(doc, layer);
    if (!entry.is_smart_object) {
      addError("Layer " + spec.path + " exists but is not a smart object.");
      REPORT.smart_objects.push(entry);
      continue;
    }

    try {
      app.activeDocument = doc;
      doc.activeLayer = layer;
      executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
      var subDoc = app.activeDocument;
      entry.internal_document_name = subDoc.name;
      entry.internal_layers = collectLayerTree(subDoc, "");
      entry.internal_target_exists = !!findLayerByNameDeep(subDoc, spec.internalTarget);
      if (!entry.internal_target_exists) {
        addError("Smart object " + spec.key + " opened, but internal layer " + spec.internalTarget + " was not found.");
      }
      subDoc.close(SaveOptions.DONOTSAVECHANGES);
      app.activeDocument = doc;
    } catch (smartError) {
      addError("Could not inspect smart object " + spec.key + ": " + errorToString(smartError));
      try {
        if (app.documents.length > 0 && app.activeDocument !== doc) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
      } catch (closeError) {}
      app.activeDocument = doc;
    }

    REPORT.smart_objects.push(entry);
  }
}

function collectFontReport(doc) {
  var used = {};
  collectTextFonts(doc, used);
  var name;
  for (name in used) {
    if (Object.prototype.hasOwnProperty.call(used, name)) {
      REPORT.fonts.used_text_fonts.push({
        font: name,
        count: used[name]
      });
    }
  }

  var installed = collectInstalledFonts();
  var i;
  for (i = 0; i < REQUIRED_FONTS.length; i++) {
    var required = REQUIRED_FONTS[i];
    var matches = findInstalledFontMatches(installed, required);
    if (matches.length) {
      REPORT.fonts.required_available.push(required);
      REPORT.fonts.installed_matches.push({
        required: required,
        matches: matches
      });
    } else {
      REPORT.fonts.required_missing.push(required);
      addWarning("Required font was not found in Photoshop font list: " + required);
    }
  }
}

function collectTextFonts(container, used) {
  if (!container.layers) return;
  var i;
  for (i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (isTextLayer(layer)) {
      var font = safeTextFont(layer) || "(unknown)";
      used[font] = used[font] ? used[font] + 1 : 1;
    }
    if (layer.typename === "LayerSet") {
      collectTextFonts(layer, used);
    }
  }
}

function collectInstalledFonts() {
  var fonts = [];
  try {
    var i;
    for (i = 0; i < app.fonts.length; i++) {
      fonts.push({
        postScriptName: safeString(app.fonts[i].postScriptName),
        name: safeString(app.fonts[i].name),
        family: safeString(app.fonts[i].family),
        style: safeString(app.fonts[i].style)
      });
    }
  } catch (error) {
    addWarning("Could not enumerate Photoshop fonts: " + errorToString(error));
  }
  return fonts;
}

function findInstalledFontMatches(installed, needle) {
  var matches = [];
  var lowNeedle = String(needle).toLowerCase();
  var i;
  for (i = 0; i < installed.length; i++) {
    var record = installed[i];
    var joined = (record.postScriptName + " " + record.name + " " + record.family + " " + record.style).toLowerCase();
    if (joined.indexOf(lowNeedle) >= 0) {
      matches.push(record);
    }
  }
  return matches;
}

function collectLayerTree(container, prefix) {
  var result = [];
  if (!container.layers) return result;
  var i;
  for (i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    var path = prefix ? prefix + "/" + layer.name : layer.name;
    var entry = {
      name: layer.name,
      path: path,
      typename: layer.typename,
      kind: getLayerKindName(layer),
      visible: safeBoolean(layer.visible),
      opacity: safeNumber(layer.opacity)
    };
    if (isTextLayer(layer)) {
      entry.text = {
        font: safeTextFont(layer),
        size: safeTextSize(layer),
        contents: safeTextContents(layer)
      };
    }
    if (layer.typename === "LayerSet") {
      entry.children = collectLayerTree(layer, path);
    }
    result.push(entry);
  }
  return result;
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
    if (container.layers[i].name === name) return container.layers[i];
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

function getSmartObjectInfo(doc, layer) {
  var info = {
    linked: null,
    file_reference: null,
    link_missing: null,
    raw_available: false,
    error: null
  };
  try {
    app.activeDocument = doc;
    doc.activeLayer = layer;
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    var key = stringIDToTypeID("smartObject");
    if (!desc.hasKey(key)) return info;
    var smart = desc.getObjectValue(key);
    info.raw_available = true;
    if (smart.hasKey(stringIDToTypeID("linked"))) {
      info.linked = smart.getBoolean(stringIDToTypeID("linked"));
    }
    if (smart.hasKey(stringIDToTypeID("fileReference"))) {
      info.file_reference = smart.getString(stringIDToTypeID("fileReference"));
    }
    if (smart.hasKey(stringIDToTypeID("linkMissing"))) {
      info.link_missing = smart.getBoolean(stringIDToTypeID("linkMissing"));
    }
  } catch (error) {
    info.error = errorToString(error);
  }
  return info;
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

function getLayerKindName(layer) {
  try {
    if (layer.typename === "LayerSet") return "LayerSet";
    if (layer.kind === LayerKind.TEXT) return "TEXT";
    if (layer.kind === LayerKind.SMARTOBJECT) return "SMARTOBJECT";
    if (layer.kind === LayerKind.NORMAL) return "NORMAL";
    return safeString(layer.kind);
  } catch (error) {
    return null;
  }
}

function safeTextFont(layer) {
  try { return String(layer.textItem.font); } catch (error) { return null; }
}

function safeTextSize(layer) {
  try { return String(layer.textItem.size); } catch (error) { return null; }
}

function safeTextContents(layer) {
  try { return String(layer.textItem.contents); } catch (error) { return null; }
}

function safeString(value) {
  try {
    return String(value);
  } catch (error) {
    return null;
  }
}

function safeBoolean(value) {
  try {
    return !!value;
  } catch (error) {
    return null;
  }
}

function safeNumber(value) {
  try {
    return Number(value);
  } catch (error) {
    return null;
  }
}

function assertFileExists(path, label) {
  var file = new File(path);
  if (!file.exists) throw new Error(label + " not found: " + path);
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
  app.activeDocument = doc;
  doc.close(SaveOptions.DONOTSAVECHANGES);
}

function writeReport(path, report) {
  var file = new File(path);
  ensureFolderRecursive(file.parent);
  file.encoding = "UTF8";
  if (!file.open("w")) throw new Error("Could not write report: " + file.fsName);
  file.write(JSON.stringify(report, null, 2));
  file.close();
}

function addWarning(message) {
  REPORT.warnings.push(message);
}

function addError(message) {
  REPORT.errors.push(message);
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

function unitPx(value) {
  try {
    return value.as("px");
  } catch (error) {
    return Number(value);
  }
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
