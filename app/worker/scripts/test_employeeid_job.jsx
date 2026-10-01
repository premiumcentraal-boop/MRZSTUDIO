// ============================================================================
// EmployeeID Test Job (Dry Run)
// ============================================================================
// Purpose: Test the badge generation with sample data (no Supabase)
// Safety: Creates test output only, never connects to Supabase
// Output: C:/EmployeeBadgeAutomation/output/test-job/
// ============================================================================

#target photoshop

var BASE_PATH = "C:/EmployeeBadgeAutomation";
var TEMPLATE_PATH = BASE_PATH + "/templates/EmployeeID.psd";
var LAYER_MAP_PATH = BASE_PATH + "/EMPLOYEEID_LAYER_MAP.json";
var OUTPUT_FOLDER = BASE_PATH + "/output/test-job";

function main() {
  try {
    log("=== EmployeeID Test Job (Dry Run) ===");

    // Create sample input
    var testInput = {
      job_id: "test-job",
      payload: {
        employee_name: "JOHN DOE",
        employee_id: "EMP001234",
        department: "Engineering",
        role: "Senior Developer",
        valid_from: "2024-01-01",
        valid_until: "2024-12-31",
        export_format: "png"
      }
    };

    // Save test input
    ensureFolder(BASE_PATH + "/current-job");
    var inputFile = new File(BASE_PATH + "/current-job/input.json");
    inputFile.open("w");
    inputFile.write(JSON.stringify(testInput, null, 2));
    inputFile.close();

    log("Test input created");
    log("Employee: " + testInput.payload.employee_name);
    log("ID: " + testInput.payload.employee_id);

    // Load layer map
    var layerMap = loadLayerMap();

    // Open template
    log("Opening template...");
    var templateFile = new File(TEMPLATE_PATH);
    if (!templateFile.exists) {
      throw new Error("Template not found: " + TEMPLATE_PATH);
    }

    var doc = app.open(templateFile);

    // Update text layers
    log("Updating text layers...");
    updateTextLayers(doc, testInput.payload, layerMap);

    // Create output folder
    ensureFolder(OUTPUT_FOLDER);

    // Export PNG
    log("Exporting PNG...");
    var pngPath = OUTPUT_FOLDER + "/result.png";
    exportPNG(doc, pngPath);
    log("PNG saved: " + pngPath);

    // Close without saving
    doc.close(SaveOptions.DONOTSAVECHANGES);

    // Save test report
    var report = {
      status: "success",
      test: true,
      timestamp: new Date().toISOString(),
      input: testInput,
      output: pngPath
    };
    saveReport(OUTPUT_FOLDER + "/test_report.json", report);

    log("=== Test Complete ===");
    log("Output saved to: " + OUTPUT_FOLDER);
    return true;

  } catch (error) {
    log("ERROR: " + error.message);
    try {
      if (app.documents.length > 0) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (e) {}
    return false;
  }
}

function loadLayerMap() {
  var file = new File(LAYER_MAP_PATH);
  if (!file.exists) throw new Error("Layer map not found");
  file.open("r");
  var content = file.read();
  file.close();
  return eval("(" + content + ")");
}

function updateTextLayers(doc, payload, layerMap) {
  for (var key in layerMap.text_layers) {
    var layerDef = layerMap.text_layers[key];
    var value = payload[layerDef.field];
    if (!value) continue;

    try {
      var layer = findLayerByPath(doc, layerDef.path);
      if (!layer || layer.kind !== LayerKind.TEXT) continue;

      if (layerDef.format && layerDef.format.indexOf("MM/DD/YYYY") > -1) {
        value = formatDate(value, layerDef.format);
      }

      layer.textItem.contents = value || "";
      log("Updated: " + layerDef.path);
    } catch (e) {
      log("WARNING: " + e.message);
    }
  }
}

function findLayerByPath(doc, path) {
  var parts = path.split("/");
  var current = doc;
  for (var i = 0; i < parts.length; i++) {
    var found = false;
    var layers = current.layers || current.artLayers;
    for (var j = 0; j < layers.length; j++) {
      if (layers[j].name === parts[i]) {
        current = layers[j];
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  return current;
}

function formatDate(dateStr, format) {
  if (!dateStr) return "";
  var parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  var year = parts[0], month = parts[1], day = parts[2];
  return format.replace("MM/DD/YYYY", month + "/" + day + "/" + year);
}

function exportPNG(doc, path) {
  var file = new File(path);
  var opts = new PNGSaveOptions();
  opts.compression = 6;
  opts.interlaced = false;
  doc.saveAs(file, opts, true, Extension.LOWERCASE);
}

function ensureFolder(path) {
  var folder = new Folder(path);
  if (!folder.exists) folder.create();
}

function saveReport(path, report) {
  var file = new File(path);
  file.open("w");
  file.write(JSON.stringify(report, null, 2));
  file.close();
}

function log(msg) {
  $.writeln("[TestJob] " + msg);
}

// JSON polyfill
if (typeof JSON === "undefined") JSON = {};
if (typeof JSON.stringify !== "function") {
  JSON.stringify = function(obj, r, space) {
    return stringifyValue(obj, r, space || "", "");
  };
  function stringifyValue(val, r, space, indent) {
    var type = typeof val;
    if (val === null) return "null";
    if (type === "undefined") return undefined;
    if (type === "boolean" || type === "number") return String(val);
    if (type === "string") return '"' + val.replace(/"/g, '\\"') + '"';
    if (val instanceof Array) {
      var items = [];
      for (var i = 0; i < val.length; i++) {
        var item = stringifyValue(val[i], r, space, indent + space);
        items.push(item === undefined ? "null" : item);
      }
      if (space && items.length > 0) {
        return "[\n" + indent + space + items.join(",\n" + indent + space) + "\n" + indent + "]";
      }
      return "[" + items.join(",") + "]";
    }
    if (type === "object") {
      var pairs = [];
      for (var key in val) {
        if (val.hasOwnProperty(key)) {
          var v = stringifyValue(val[key], r, space, indent + space);
          if (v !== undefined) pairs.push('"' + key + '":' + (space ? " " : "") + v);
        }
      }
      if (space && pairs.length > 0) {
        return "{\n" + indent + space + pairs.join(",\n" + indent + space) + "\n" + indent + "}";
      }
      return "{" + pairs.join(",") + "}";
    }
    return undefined;
  }
}

main();
