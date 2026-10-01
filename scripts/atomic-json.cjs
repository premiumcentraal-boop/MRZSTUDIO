"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
// Windows antivirus and readers can briefly deny a rename. Keep the old file
// intact, retry a bounded interval, and never use delete-then-write as a fallback.
function rename(from, to) {
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(from, to); return; }
    catch (error) {
      if (process.platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(error.code) || attempt >= 8) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  let fd;
  try {
    fd = fs.openSync(temporary, "wx"); fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    rename(temporary, file);
  } finally { if (fd !== undefined) fs.closeSync(fd); fs.rmSync(temporary, { force: true }); }
}
module.exports = { write, rename };
