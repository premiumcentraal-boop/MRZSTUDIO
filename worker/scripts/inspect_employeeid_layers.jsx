// ============================================================================
// EmployeeID.psd Layer Inspector
// ============================================================================
// Purpose: Diagnostic tool to scan and verify EmployeeID.psd structure
// Safety: Read-only inspection, never modifies the template
// Output: /worker/logs/employeeid_layer_report.json
// ============================================================================

#target photoshop

// Configuration
var TEMPLATE_PATH = "C:/EmployeeBadgeAutomation/templates/EmployeeID.psd";
var LAYER_MAP_PATH = "C:/EmployeeBadgeAutomation/EMPLOYEEID_LAYER_MAP.json";
var OUTPUT_PATH = "C:/EmployeeBadgeAutomation/logs/employeeid_layer_report.json";

// Main execution
function main() {
  try {
    log("=== EmployeeID.psd Layer Inspector ===");
    log("Template: " + TEMPLATE_PATH);

    // Check if template exists
    var templateFile = new File(TEMPLATE_PATH);
    if (!templateFile.exists) {
      throw new Error("Template file not found: " + TEMPLATE_PATH);
    }

    // Open template (read-only)
    log("Opening template...");
    var doc = app.open(templateFile);

    // Scan all layers
    log("Scanning layer structure...");
    var layerTree = scanDocument(doc);

    // Load layer map for verification
    log("Loading layer map...");
    var layerMap = loadLayerMap();

    // Verify required layers exist
    log("Verifying required layers...");
    var verification = verifyLayers(layerTree, layerMap);

    // Build report
    var report = {
      timestamp: new Date().toISOString(),
      template_path: TEMPLATE_PATH,
      document: {
        name: doc.name,
        width: doc.width.as("px"),
        height: doc.height.as("px"),
        resolution: doc.resolution,
        color_mode: doc.mode.toString(),
        bit_depth: doc.bitsPerChannel.toString()
      },
      layer_tree: layerTree,
      verification: verification,
      summary: {
        total_layers: countLayers(layerTree),
        text_layers_found: verification.text_layers_found,
        text_layers_missing: verification.text_layers_missing,
        smart_objects_found: verification.smart_objects_found,
        smart_objects_missing: verification.smart_objects_missing,
        all_required_present: verification.all_required_present
      }
    };

    // Save report
    log("Saving report...");
    saveReport(report);

    // Close document without saving
    doc.close(SaveOptions.DONOTSAVECHANGES);

    log("=== Inspection Complete ===");
    log("Report saved to: " + OUTPUT_PATH);

    if (!verification.all_required_present) {
      log("WARNING: Some required layers are missing!");
      log("Missing layers: " + verification.missing_layers.join(", "));
      return false;
    }

    return true;

  } catch (error) {
    log("ERROR: " + error.message);
    log("Stack: " + error.line);
    return false;
  }
}

// Recursively scan document structure
function scanDocument(doc) {
  var tree = {
    type: "document",
    name: doc.name,
    children: []
  };

  for (var i = 0; i < doc.layers.length; i++) {
    tree.children.push(scanLayer(doc.layers[i], ""));
  }

  return tree;
}

// Recursively scan a layer or layer set
function scanLayer(layer, parentPath) {
  var layerPath = parentPath ? parentPath + "/" + layer.name : layer.name;

  var layerInfo = {
    name: layer.name,
    path: layerPath,
    type: layer.typename,
    visible: layer.visible,
    opacity: layer.opacity
  };

  // Check if it's a layer set (group)
  if (layer.typename === "LayerSet") {
    layerInfo.children = [];
    for (var i = 0; i < layer.layers.length; i++) {
      layerInfo.children.push(scanLayer(layer.layers[i], layerPath));
    }
  }

  // Check if it's a text layer
  if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT) {
    try {
      layerInfo.text_info = {
        contents: layer.textItem.contents,
        font: layer.textItem.font,
        size: layer.textItem.size.as("pt")
      };
    } catch (e) {
      layerInfo.text_info = { error: e.message };
    }
  }

  // Check if it's a Smart Object
  if (layer.typename === "ArtLayer" && layer.kind === LayerKind.SMARTOBJECT) {
    layerInfo.is_smart_object = true;
  }

  return layerInfo;
}

// Load layer map from JSON
function loadLayerMap() {
  try {
    var file = new File(LAYER_MAP_PATH);
    if (!file.exists) {
      throw new Error("Layer map not found: " + LAYER_MAP_PATH);
    }

    file.open("r");
    var content = file.read();
    file.close();

    return eval("(" + content + ")");
  } catch (error) {
    throw new Error("Failed to load layer map: " + error.message);
  }
}

// Verify that all required layers exist
function verifyLayers(layerTree, layerMap) {
  var verification = {
    text_layers_found: [],
    text_layers_missing: [],
    smart_objects_found: [],
    smart_objects_missing: [],
    missing_layers: [],
    all_required_present: true
  };

  // Check text layers
  for (var key in layerMap.text_layers) {
    var layerDef = layerMap.text_layers[key];
    var found = findLayerByPath(layerTree, layerDef.path);

    if (found) {
      verification.text_layers_found.push(layerDef.path);
    } else {
      verification.text_layers_missing.push(layerDef.path);
      verification.missing_layers.push(layerDef.path);
      verification.all_required_present = false;
    }
  }

  // Check Smart Objects
  for (var key in layerMap.smart_objects) {
    var soDef = layerMap.smart_objects[key];
    var found = findLayerByPath(layerTree, soDef.layer_path);

    if (found && found.is_smart_object) {
      verification.smart_objects_found.push(soDef.layer_path);
    } else {
      verification.smart_objects_missing.push(soDef.layer_path);
      verification.missing_layers.push(soDef.layer_path);
      verification.all_required_present = false;
    }
  }

  return verification;
}

// Find a layer by its full path
function findLayerByPath(tree, targetPath) {
  var parts = targetPath.split("/");
  return findLayerRecursive(tree, parts, 0);
}

function findLayerRecursive(node, parts, index) {
  if (index >= parts.length) {
    return node;
  }

  var targetName = parts[index];

  if (node.children) {
    for (var i = 0; i < node.children.length; i++) {
      if (node.children[i].name === targetName) {
        return findLayerRecursive(node.children[i], parts, index + 1);
      }
    }
  }

  return null;
}

// Count total layers
function countLayers(node) {
  var count = node.type === "document" ? 0 : 1;
  if (node.children) {
    for (var i = 0; i < node.children.length; i++) {
      count += countLayers(node.children[i]);
    }
  }
  return count;
}

// Save report
function saveReport(report) {
  var file = new File(OUTPUT_PATH);
  var folder = new Folder(file.parent.fsName);
  if (!folder.exists) folder.create();
  
  file.open("w");
  file.write(JSON.stringify(report, null, 2));
  file.close();
}

function log(msg) {
  $.writeln("[Inspector] " + msg);
}

// JSON.stringify polyfill
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
          if (v !== undefined) {
            pairs.push('"' + key + '":' + (space ? " " : "") + v);
          }
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
