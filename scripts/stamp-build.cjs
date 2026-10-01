"use strict";
const c = require("./common.cjs");
const v = c.version();
if (!v || v.product !== c.PRODUCT) throw Error("Studio release metadata is missing.");
c.write(c.path.join(c.ROOT, "app", "dist", "mrz-build.json"), { product: v.product, version: v.version, builtAt: new Date().toISOString(), local: true });
console.log(`MRZ Studio Local ${v.version}: production UI stamped.`);
