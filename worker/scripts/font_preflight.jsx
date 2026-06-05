// ============================================================================
// Font Preflight Scanner
// ============================================================================
// Purpose: Scan installed fonts and verify required fonts are available
// Safety: Read-only, never modifies anything
// Output: /worker/logs/font_report.json
// ============================================================================

#target photoshop

// Configuration
var LAYER_MAP_PATH = "C:/EmployeeBadgeAutomation/EMPLOYEEID_LAYER_MAP.json";
var OUTPUT_PATH = "C:/EmployeeBadgeAutomation/logs/font_report.json";

function main() {
  try {
    log("=== Font Preflight Scanner ===");

    // Get all installed fonts
    log("Scanning installed fonts...");
    var installedFonts = getInstalledFonts();

    // Load required fonts from layer map
    log("Loading required fonts...");
    var layerMap = loadLayerMap();
    var requiredFonts = layerMap.required_fonts || [];

    // Check which required fonts are present
    log("Verifying required fonts...");
    var verification = verifyFonts(installedFonts, requiredFonts);

    // Build report
    var report = {
      timestamp: new Date().toISOString(),
      total_fonts_installed: installedFonts.length,
      required_fonts: requiredFonts.length,
      all_fonts_available: verification.all_available,
      available_fonts: verification.available,
      missing_fonts: verification.missing,
      installed_fonts: installedFonts
    };

    // Save report
    log("Saving report...");
    saveReport(report);

    log("=== Preflight Complete ===");
    log("Report saved to: " + OUTPUT_PATH);

    if (!verification.all_available) {
      log("WARNING: Missing required fonts!");
      log("Missing: " + verification.missing.join(", "));
      return false;
    }

    log("SUCCESS: All required fonts are installed");
    return true;

  } catch (error) {
    log("ERROR: " + error.message);
    return false;
  }
}

// Get all installed fonts
function getInstalledFonts() {
  var fonts = [];
  var fontList = app.fonts;

  for (var i = 0; i < fontList.length; i++) {
    fonts.push({
      name: fontList[i].name,
      postScriptName: fontList[i].postScriptName,
      family: fontList[i].family
    });
  }

  return fonts;
}

// Load layer map
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

// Verify required fonts are installed
function verifyFonts(installedFonts, requiredFonts) {
  var verification = {
    available: [],
    missing: [],
    all_available: true
  };

  for (var i = 0; i < requiredFonts.length; i++) {
    var required = requiredFonts[i];
    var found = false;

    for (var j = 0; j < installedFonts.length; j++) {
      if (installedFonts[j].postScriptName === required.postscript_name) {
        found = true;
        break;
      }
    }

    if (found) {
      verification.available.push(required.postscript_name);
    } else {
      verification.missing.push(required.postscript_name);
      verification.all_available = false;
    }
  }

  return verification;
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
  $.writeln("[FontPreflight] " + msg);
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
