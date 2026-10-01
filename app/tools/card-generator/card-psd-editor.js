#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, "Example page.psb");
const UI_FILE = path.join(ROOT, "card-psd-editor.html");
const OUTPUT_DIR = path.join(ROOT, "output", "cards");
const AUTOMATION_DIR = path.join(ROOT, "output", "automation");
const DEBUG_DIR = path.join(ROOT, "output", "debug");
const FONT_DIR = path.join(ROOT, "fonts");
const PORT = Number(process.env.PORT || 8787);

const TARGETS = [
  "CODE",
  "DOCNMBR",
  "VALID",
  "ENDVALID",
  "BIRTHDATE",
  "YEAR",
  "FIRST",
  "LAST",
  "GENDER",
  "COUNTRY",
  "CITYBIRTH",
  "LOCATION",
  "HEIGHT",
  "MRZ"
];

const SAMPLE_LAYER_HINTS = {
  LOCATION: [{ name: "Burg. van Zoetermeer", left: 702, top: 111 }],
  MRZ: [{ name: "MRZ", left: 723, top: 391 }],
  HEIGHT: [{ name: "1,72 m", left: 1397, top: 114 }],
  CITYBIRTH: [{ name: "Zoetermeer", left: 702, top: 57 }],
  CODE: [{ name: "999999999", left: 1395, top: 59 }],
  DOCNMBR: [{ name: "999999999", left: 380, top: 97 }],
  FULLNAME: [{ name: "Trump Donald John", left: 701, top: 0 }],
  YEAR: [{ name: "1966", left: 216, top: 316 }],
  BIRTHDATE: [{ name: "02 AUG/AUG", left: 1, top: 315 }],
  VALID: [{ name: "03 MAA/MAR 2020", left: 0, top: 373 }],
  ENDVALID: [{ name: "03 MAA/MAR 2030", left: 0, top: 430 }],
  COUNTRY: [{ name: "Nederlandse", left: 119, top: 260 }],
  GENDER: [{ name: "M/M", left: 5, top: 261 }],
  LAST: [{ name: "Last name", left: 4, top: 207 }],
  FIRST: [{ name: "First name", left: 4, top: 151 }]
};

const MONTHS = {
  JAN: "JAN",
  FEB: "FEB",
  MAR: "MAR",
  APR: "APR",
  MAY: "MEI",
  JUN: "JUN",
  JUL: "JUL",
  AUG: "AUG",
  SEP: "SEP",
  OCT: "OKT",
  NOV: "NOV",
  DEC: "DEC"
};

class Reader {
  constructor(buffer) {
    this.buffer = buffer;
  }

  ascii(offset, length) {
    return this.buffer.toString("latin1", offset, offset + length);
  }

  u8(offset) {
    return this.buffer.readUInt8(offset);
  }

  i16(offset) {
    return this.buffer.readInt16BE(offset);
  }

  u16(offset) {
    return this.buffer.readUInt16BE(offset);
  }

  i32(offset) {
    return this.buffer.readInt32BE(offset);
  }

  u32(offset) {
    return this.buffer.readUInt32BE(offset);
  }

  u64(offset) {
    const value = this.buffer.readBigUInt64BE(offset);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("This PSB is too large for this no-dependency editor.");
    }
    return Number(value);
  }
}

function writeU32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function writeI16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeInt16BE(value);
  return buffer;
}

function writeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

function encodeUtf16BE(text) {
  const out = [];
  for (const char of String(text)) {
    const code = char.charCodeAt(0);
    out.push(code >> 8, code & 255);
  }
  return Buffer.from(out);
}

function decodeUtf16BE(buffer) {
  const chars = [];
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const code = buffer.readUInt16BE(i);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

function encodeUnicodeDescriptorString(text) {
  const clean = String(text);
  return Buffer.concat([writeU32(clean.length + 1), encodeUtf16BE(clean), Buffer.from([0, 0])]);
}

function encodeEngineLiteralText(text) {
  const raw = Buffer.concat([Buffer.from([0xfe, 0xff]), encodeUtf16BE(text), Buffer.from([0, 13])]);
  const escaped = [];
  for (const byte of raw) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) escaped.push(0x5c);
    escaped.push(byte);
  }
  return Buffer.concat([Buffer.from("("), Buffer.from(escaped), Buffer.from(")")]);
}

function normalizePhotoshopText(text) {
  return String(text).replace(/\r\n/g, "\r").replace(/\n/g, "\r");
}

function decodePascalName(buffer, offset) {
  const length = buffer.readUInt8(offset);
  return buffer.toString("latin1", offset + 1, offset + 1 + length);
}

function encodePascalName(name) {
  const bytes = Buffer.from(String(name).slice(0, 255), "latin1");
  const raw = Buffer.concat([Buffer.from([bytes.length]), bytes]);
  const pad = (4 - (raw.length % 4)) % 4;
  return pad ? Buffer.concat([raw, Buffer.alloc(pad)]) : raw;
}

function padEven(buffer) {
  return buffer.length % 2 ? Buffer.concat([buffer, Buffer.alloc(1)]) : buffer;
}

function cleanLayerName(name) {
  return String(name || "").trim();
}

function parsePsd(buffer) {
  const r = new Reader(buffer);
  if (r.ascii(0, 4) !== "8BPS") throw new Error("This is not a PSD/PSB file.");

  const version = r.u16(4);
  const isPsb = version === 2;
  if (version !== 1 && version !== 2) throw new Error(`Unsupported Photoshop version ${version}.`);

  let offset = 26;
  const colorLength = r.u32(offset);
  offset += 4 + colorLength;
  const imageResourceLength = r.u32(offset);
  offset += 4 + imageResourceLength;

  const layerMaskLengthOffset = offset;
  const layerMaskLength = isPsb ? r.u64(offset) : r.u32(offset);
  offset += isPsb ? 8 : 4;
  const layerMaskStart = offset;
  const layerMaskEnd = layerMaskStart + layerMaskLength;

  const layerInfoLengthOffset = offset;
  const layerInfoLength = isPsb ? r.u64(offset) : r.u32(offset);
  offset += isPsb ? 8 : 4;
  const layerInfoStart = offset;
  const layerInfoEnd = layerInfoStart + layerInfoLength;

  const layerCountRaw = r.i16(offset);
  const layerCount = Math.abs(layerCountRaw);
  const layerCountOffset = offset;
  offset += 2;

  const layers = [];
  for (let index = 0; index < layerCount; index += 1) {
    const recordStart = offset;
    const top = r.i32(offset);
    const left = r.i32(offset + 4);
    const bottom = r.i32(offset + 8);
    const right = r.i32(offset + 12);
    offset += 16;

    const channelCountOffset = offset;
    const channelCount = r.u16(offset);
    offset += 2;
    const channelInfoStart = offset;
    const channels = [];
    for (let c = 0; c < channelCount; c += 1) {
      const id = r.i16(offset);
      const lengthOffset = offset + 2;
      const length = isPsb ? r.u64(lengthOffset) : r.u32(lengthOffset);
      channels.push({ id, length, lengthOffset });
      offset += isPsb ? 10 : 6;
    }

    const blendModeStart = offset;
    offset += 8;
    offset += 4;
    const extraLengthOffset = offset;
    const extraLength = r.u32(offset);
    offset += 4;
    const extraStart = offset;
    const extraEnd = extraStart + extraLength;

    const maskLength = r.u32(offset);
    const maskStart = offset;
    offset += 4 + maskLength;
    const blendingLength = r.u32(offset);
    const blendingStart = offset;
    offset += 4 + blendingLength;

    const pascalStart = offset;
    const pascalName = decodePascalName(buffer, offset);
    offset += 1 + r.u8(offset);
    while ((offset - extraStart) % 4 !== 0) offset += 1;
    const afterPascal = offset;

    const blocks = [];
    while (offset + 12 <= extraEnd) {
      const blockStart = offset;
      const signature = r.ascii(offset, 4);
      const key = r.ascii(offset + 4, 4);
      const length = r.u32(offset + 8);
      const dataStart = offset + 12;
      const dataEnd = dataStart + length;
      blocks.push({
        signature,
        key,
        length,
        blockStart,
        dataStart,
        dataEnd,
        paddedEnd: dataEnd + (length % 2)
      });
      offset = dataEnd + (length % 2);
    }

    const unicodeBlock = blocks.find((block) => block.key === "luni");
    let unicodeName = "";
    if (unicodeBlock) {
      const count = r.u32(unicodeBlock.dataStart);
      unicodeName = decodeUtf16BE(buffer.subarray(unicodeBlock.dataStart + 4, unicodeBlock.dataStart + 4 + count * 2));
    }

    const textBlock = blocks.find((block) => block.key === "TySh" || block.key === "tySh");
    const text = textBlock ? readTextFromTySh(buffer.subarray(textBlock.dataStart, textBlock.dataEnd)) : "";
    const fonts = textBlock ? extractFontsFromTySh(buffer.subarray(textBlock.dataStart, textBlock.dataEnd)) : [];

    layers.push({
      index,
      recordStart,
      top,
      left,
      bottom,
      right,
      channels,
      channelCountOffset,
      channelInfoStart,
      blendModeStart,
      extraLengthOffset,
      extraStart,
      extraEnd,
      maskStart,
      blendingStart,
      pascalStart,
      afterPascal,
      pascalName,
      unicodeName,
      name: cleanLayerName(unicodeName || pascalName),
      blocks,
      textBlock,
      text,
      fonts
    });
  }

  const channelDataStart = offset;
  let channelCursor = channelDataStart;
  for (const layer of layers) {
    for (const channel of layer.channels) {
      channel.dataStart = channelCursor;
      channel.dataEnd = channelCursor + channel.length;
      channelCursor = channel.dataEnd;
    }
  }
  const layerInfoTail = buffer.subarray(channelCursor, layerInfoEnd);

  return {
    buffer,
    reader: r,
    version,
    isPsb,
    width: r.u32(18),
    height: r.u32(14),
    channels: r.u16(12),
    depth: r.u16(22),
    colorMode: r.u16(24),
    layerMaskLengthOffset,
    layerMaskLength,
    layerMaskStart,
    layerMaskEnd,
    layerInfoLengthOffset,
    layerInfoLength,
    layerInfoStart,
    layerInfoEnd,
    layerCountOffset,
    layerCountRaw,
    layerCount,
    layers,
    channelDataStart,
    channelDataEnd: channelCursor,
    layerInfoTail,
    afterLayerInfo: layerInfoEnd,
    afterLayerMask: layerMaskEnd
  };
}

function readTextFromTySh(data) {
  const key = data.indexOf(Buffer.from("Txt TEXT", "latin1"));
  if (key < 0 || key + 12 > data.length) return "";
  const length = data.readUInt32BE(key + 8);
  return decodeUtf16BE(data.subarray(key + 12, key + 12 + length * 2));
}

function getRunLengthArrays(buffer, layer) {
  if (!layer.textBlock) return [];
  const data = buffer.subarray(layer.textBlock.dataStart, layer.textBlock.dataEnd).toString("latin1");
  return [...data.matchAll(/\/RunLengthArray \[([^\]]*)\]/g)].map((match) => runLengthNumbers(match[1]));
}

function validateTextRuns(parsed) {
  const errors = [];
  for (const layer of parsed.layers) {
    if (!layer.textBlock) continue;
    const expected = layer.text.length + 1;
    const arrays = getRunLengthArrays(parsed.buffer, layer);
    arrays.forEach((numbers, index) => {
      const total = numbers.reduce((sum, number) => sum + number, 0);
      if (total !== expected) {
        errors.push(`${layer.name || `layer ${layer.index}`} run ${index + 1} totals ${total}, expected ${expected}.`);
      }
    });
  }
  return errors;
}

function extractFontsFromTySh(data) {
  const text = data.toString("latin1");
  const fonts = new Set();
  for (const match of text.matchAll(/\(\xfe\xff([\s\S]*?)\)/g)) {
    const body = Buffer.from(match[1], "latin1");
    const decoded = decodeUtf16BE(body);
    if (/^[A-Za-z0-9_. -]+$/.test(decoded) && /(Arial|Myriad|Font|MT|Pro|Bold|Regular|Italic)/i.test(decoded)) {
      fonts.add(decoded);
    }
  }
  return [...fonts];
}

function replaceBetween(buffer, start, end, replacement) {
  return Buffer.concat([buffer.subarray(0, start), replacement, buffer.subarray(end)]);
}

function findLiteralStringEnd(buffer, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0x5c) {
      i += 1;
      continue;
    }
    if (byte === 0x28) depth += 1;
    if (byte === 0x29) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function runLengthNumbers(value) {
  return String(value).trim().split(/\s+/).map(Number).filter(Number.isFinite);
}

function distributeRunLength(total, oldNumbers) {
  if (oldNumbers.length <= 1) return [total];
  let remaining = total;
  return oldNumbers.map((number, index) => {
    if (index === oldNumbers.length - 1) return Math.max(0, remaining);
    const current = Math.max(0, Math.min(number, remaining));
    remaining -= current;
    return current;
  });
}

function paragraphRunLengths(text) {
  return String(text).split("\r").map((line) => line.length + 1);
}

function patchRunLengths(engineData, newText) {
  const text = engineData.toString("latin1");
  const total = String(newText).length + 1;
  const paragraphs = paragraphRunLengths(newText);
  let index = 0;
  const updated = text.replace(/\/RunLengthArray \[([^\]]*)\]/g, (match, body) => {
    const numbers = index === 0 ? paragraphs : distributeRunLength(total, runLengthNumbers(body));
    index += 1;
    return `/RunLengthArray [ ${numbers.join(" ")} ]`;
  });
  return Buffer.from(updated, "latin1");
}

function patchTySh(data, newText) {
  newText = normalizePhotoshopText(newText);
  let updated = Buffer.from(data);
  const descriptorKey = updated.indexOf(Buffer.from("Txt TEXT", "latin1"));
  if (descriptorKey >= 0) {
    const oldLength = updated.readUInt32BE(descriptorKey + 8);
    const valueStart = descriptorKey + 12;
    const valueEnd = valueStart + oldLength * 2;
    updated = replaceBetween(updated, descriptorKey + 8, valueEnd, encodeUnicodeDescriptorString(newText));
  }

  const engineStart = updated.indexOf(Buffer.from("EngineData", "latin1"));
  const textMarker = engineStart >= 0 ? updated.indexOf(Buffer.from("/Text ", "latin1"), engineStart) : -1;
  if (textMarker >= 0) {
    const open = updated.indexOf(Buffer.from("("), textMarker);
    const close = open >= 0 ? findLiteralStringEnd(updated, open) : -1;
    if (open >= 0 && close > open) {
      updated = replaceBetween(updated, open, close, encodeEngineLiteralText(newText));
    }
  }

  return patchRunLengths(updated, newText);
}

function makeLuniBlock(signature, name) {
  const text = String(name);
  const data = Buffer.concat([writeU32(text.length), encodeUtf16BE(text)]);
  return makeAdditionalBlock(signature || "8BIM", "luni", data);
}

function makeAdditionalBlock(signature, key, data) {
  const body = Buffer.from(data);
  return Buffer.concat([
    Buffer.from(signature, "latin1"),
    Buffer.from(key, "latin1"),
    writeU32(body.length),
    padEven(body)
  ]);
}

function ensureClassicLength(length, label) {
  if (length > 0xffffffff) throw new Error(`${label} is too large for classic PSD output.`);
  return length;
}

function rebuildLayerRecordHeader(parsed, layer, outputPsb, channelBuffers) {
  const beforeChannels = parsed.buffer.subarray(layer.recordStart, layer.channelInfoStart);
  const channelParts = layer.channels.map((channel, index) => {
    const channelLength = channelBuffers[index]?.length ?? channel.length;
    ensureClassicLength(channelLength, `Layer ${layer.name} channel ${channel.id}`);
    return Buffer.concat([
      writeI16(channel.id),
      outputPsb ? writeU64(channelLength) : writeU32(channelLength)
    ]);
  });
  const afterChannels = parsed.buffer.subarray(layer.blendModeStart, layer.extraLengthOffset);
  return Buffer.concat([beforeChannels, ...channelParts, afterChannels]);
}

function convertRleCounts(data, rows, fromPsb, toPsb, label) {
  if (data.length < 2) return data;
  const compression = data.readUInt16BE(0);
  if (compression !== 1 || fromPsb === toPsb) return data;

  const sourceSize = fromPsb ? 4 : 2;
  const targetSize = toPsb ? 4 : 2;
  const tableStart = 2;
  const tableEnd = tableStart + rows * sourceSize;
  if (tableEnd > data.length) {
    throw new Error(`${label} has an invalid RLE row table.`);
  }

  const table = Buffer.alloc(rows * targetSize);
  for (let row = 0; row < rows; row += 1) {
    const value = fromPsb ? data.readUInt32BE(tableStart + row * 4) : data.readUInt16BE(tableStart + row * 2);
    if (!toPsb) ensureClassicLength(value, `${label} RLE row`);
    if (!toPsb && value > 0xffff) throw new Error(`${label} has an RLE row too large for PSD.`);
    if (toPsb) table.writeUInt32BE(value, row * 4);
    else table.writeUInt16BE(value, row * 2);
  }

  return Buffer.concat([data.subarray(0, 2), table, data.subarray(tableEnd)]);
}

function prepareChannelData(parsed, outputPsb) {
  const byLayer = new Map();
  const parts = [];

  for (const layer of parsed.layers) {
    const height = Math.max(0, layer.bottom - layer.top);
    const channelBuffers = layer.channels.map((channel) => {
      const source = parsed.buffer.subarray(channel.dataStart, channel.dataEnd);
      return convertRleCounts(source, height, parsed.isPsb, outputPsb, `${layer.name || `layer ${layer.index}`} channel ${channel.id}`);
    });
    byLayer.set(layer.index, channelBuffers);
    parts.push(...channelBuffers);
  }

  return { byLayer, data: Buffer.concat(parts) };
}

function prepareCompositeImageData(parsed, outputPsb) {
  const source = parsed.buffer.subarray(parsed.afterLayerMask);
  const rows = parsed.height * parsed.channels;
  return convertRleCounts(source, rows, parsed.isPsb, outputPsb, "Composite image");
}

function rebuildLayerRecord(parsed, layer, changes, outputPsb, channelBuffers) {
  const header = rebuildLayerRecordHeader(parsed, layer, outputPsb, channelBuffers);
  const mask = parsed.buffer.subarray(layer.maskStart, layer.blendingStart);
  const blendingLength = parsed.reader.u32(layer.blendingStart);
  const blending = parsed.buffer.subarray(layer.blendingStart, layer.blendingStart + 4 + blendingLength);
  const displayName = changes?.layerName || layer.pascalName;
  const pascal = encodePascalName(displayName);
  const blocks = [];
  const handled = new Set();

  for (const block of layer.blocks) {
    if ((block.key === "TySh" || block.key === "tySh") && changes?.text !== undefined) {
      const patched = patchTySh(parsed.buffer.subarray(block.dataStart, block.dataEnd), changes.text);
      blocks.push(makeAdditionalBlock(block.signature, block.key, patched));
      handled.add(block.key);
      continue;
    }
    if (block.key === "luni" && changes?.layerName) {
      blocks.push(makeLuniBlock(block.signature, changes.layerName));
      handled.add(block.key);
      continue;
    }
    blocks.push(parsed.buffer.subarray(block.blockStart, block.paddedEnd));
    handled.add(block.key);
  }

  if (changes?.layerName && !handled.has("luni")) {
    blocks.push(makeLuniBlock("8BIM", changes.layerName));
  }

  const extra = Buffer.concat([mask, blending, pascal, ...blocks]);
  return Buffer.concat([header, writeU32(extra.length), extra]);
}

function normalizeName(value) {
  return cleanLayerName(value).toUpperCase();
}

function layerMatchesHint(layer, hint) {
  if (hint.name && normalizeName(layer.name) !== normalizeName(hint.name)) return false;
  if (Number.isFinite(hint.left) && Math.abs(layer.left - hint.left) > 4) return false;
  if (Number.isFinite(hint.top) && Math.abs(layer.top - hint.top) > 4) return false;
  return true;
}

function buildMapping(layers) {
  const textLayers = layers.filter((layer) => layer.textBlock);
  const used = new Set();
  const mapping = {};
  const report = [];
  const allTargets = [...TARGETS, "FULLNAME"];

  for (const target of allTargets) {
    const exact = textLayers.find((layer) => !used.has(layer.index) && normalizeName(layer.name) === target);
    if (exact) {
      mapping[target] = exact;
      used.add(exact.index);
      report.push({ target, layer: exact.name, method: "exact" });
      continue;
    }

    const hints = SAMPLE_LAYER_HINTS[target] || [];
    const hinted = textLayers.find((layer) => !used.has(layer.index) && hints.some((hint) => layerMatchesHint(layer, hint)));
    if (hinted) {
      mapping[target] = hinted;
      used.add(hinted.index);
      report.push({ target, layer: hinted.name, method: "auto" });
      continue;
    }

    if (TARGETS.includes(target)) report.push({ target, layer: "", method: "missing" });
  }

  return { mapping, report: report.filter((item) => TARGETS.includes(item.target)) };
}

function rebuildPsd(parsed, values, options = {}) {
  const outputPsb = options.outputFormat === "psb";
  if (!outputPsb) {
    if (parsed.width > 30000 || parsed.height > 30000) {
      throw new Error("This template is too large for classic PSD output.");
    }
  }

  const { mapping, report } = buildMapping(parsed.layers);
  const warnings = [];
  const changesByIndex = new Map();

  for (const [target, layer] of Object.entries(mapping)) {
    if (values[target] === undefined || values[target] === "") continue;
    changesByIndex.set(layer.index, {
      text: values[target],
      layerName: target
    });
  }

  for (const target of TARGETS) {
    if (!mapping[target]) warnings.push(`Layer ${target} was not found.`);
  }

  const preparedChannels = prepareChannelData(parsed, outputPsb);
  const records = parsed.layers.map((layer) => (
    rebuildLayerRecord(parsed, layer, changesByIndex.get(layer.index), outputPsb, preparedChannels.byLayer.get(layer.index))
  ));
  const channelData = preparedChannels.data;
  const layerInfoTail = parsed.layerInfoTail.some((byte) => byte !== 0) ? parsed.layerInfoTail : Buffer.alloc(0);
  let layerInfo = Buffer.concat([
    parsed.buffer.subarray(parsed.layerCountOffset, parsed.layerCountOffset + 2),
    ...records,
    channelData,
    layerInfoTail
  ]);
  if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, Buffer.alloc(1)]);

  ensureClassicLength(layerInfo.length, "Layer info section");
  const layerInfoLength = outputPsb ? writeU64(layerInfo.length) : writeU32(layerInfo.length);
  const afterLayerInfo = parsed.buffer.subarray(parsed.afterLayerInfo, parsed.afterLayerMask);
  let layerMaskSection = Buffer.concat([layerInfoLength, layerInfo, afterLayerInfo]);
  if (layerMaskSection.length % 2) layerMaskSection = Buffer.concat([layerMaskSection, Buffer.alloc(1)]);

  ensureClassicLength(layerMaskSection.length, "Layer and mask section");
  const layerMaskLength = outputPsb ? writeU64(layerMaskSection.length) : writeU32(layerMaskSection.length);
  const beforeLayerMask = Buffer.from(parsed.buffer.subarray(0, parsed.layerMaskLengthOffset));
  beforeLayerMask.writeUInt16BE(outputPsb ? 2 : 1, 4);
  const compositeImageData = prepareCompositeImageData(parsed, outputPsb);
  const output = Buffer.concat([
    beforeLayerMask,
    layerMaskLength,
    layerMaskSection,
    compositeImageData
  ]);

  return { output, warnings, report, changed: [...changesByIndex.keys()].length, outputFormat: outputPsb ? "psb" : "psd" };
}

function fileNameSafe(text) {
  return String(text || "card").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64) || "card";
}

function normalizeValues(values) {
  const out = {};
  for (const target of TARGETS) out[target] = values[target] === undefined ? "" : String(values[target]).trim();
  out.MRZ = String(values.MRZ || "").replace(/\r\n/g, "\n").trimEnd();
  out.FULLNAME = String(values.FULLNAME || [out.LAST, out.FIRST].filter(Boolean).join(" ")).trim();
  return out;
}

function validateValues(values) {
  const errors = [];
  if (values.CODE && !/^[0-9]{9}$/.test(values.CODE)) errors.push("Personal number must be exactly 9 digits.");
  if (values.DOCNMBR && !/^[A-Za-z0-9]{9}$/.test(values.DOCNMBR)) errors.push("Document code must be exactly 9 letters/numbers.");
  if (values.YEAR && !/^[0-9]{4}$/.test(values.YEAR)) errors.push("Birth year must be 4 digits.");
  if (values.MRZ && values.MRZ.split("\n").some((line) => line.length > 90)) errors.push("MRZ lines are unusually long.");
  return errors;
}

function exampleValues() {
  const examplePath = path.join(ROOT, "card-data.example.json");
  if (fs.existsSync(examplePath)) {
    return JSON.parse(fs.readFileSync(examplePath, "utf8"));
  }
  return {
    CODE: "123456789",
    DOCNMBR: "AB12C34D5",
    VALID: "14 JUN/JUN 2020",
    ENDVALID: "14 JUN/JUN 2030",
    BIRTHDATE: "14 JUN/JUN",
    YEAR: "1990",
    FIRST: "Mila",
    LAST: "De Vries",
    GENDER: "F/F",
    COUNTRY: "Nederlandse",
    CITYBIRTH: "Zoetermeer",
    LOCATION: "Burg. van Zoetermeer",
    HEIGHT: "1,72 m",
    MRZ: "I<NLDAB12C34D55<<<<<<<<<<<<<<<\n9006142F3006140NLD<<<<<<<<<<<8\nDE<VRIES<<MILA<<<<<<<<<<<<<<<"
  };
}

function jsxString(value) {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function psSingleQuoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function photoshopPathLiteral(filePath) {
  return jsxString(filePath.replace(/\\/g, "/"));
}

function findPhotoshopExe() {
  if (process.env.PHOTOSHOP_EXE && fs.existsSync(process.env.PHOTOSHOP_EXE)) {
    return process.env.PHOTOSHOP_EXE;
  }

  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"]
  ].filter(Boolean);
  const candidates = [];

  for (const root of roots) {
    const adobeRoot = path.join(root, "Adobe");
    if (!fs.existsSync(adobeRoot)) continue;
    for (const folder of fs.readdirSync(adobeRoot)) {
      if (/Adobe Photoshop/i.test(folder)) {
        const exe = path.join(adobeRoot, folder, "Photoshop.exe");
        if (fs.existsSync(exe)) candidates.push(exe);
      }
    }
  }

  candidates.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return candidates[0] || "";
}

function buildPhotoshopJobs(parsed, values) {
  const { mapping, report } = buildMapping(parsed.layers);
  const textLayers = parsed.layers.filter((layer) => layer.textBlock);
  const jobs = [];
  const warnings = [];

  for (const target of [...TARGETS, "FULLNAME"]) {
    const layer = mapping[target];
    if (!layer) {
      if (TARGETS.includes(target)) warnings.push(`Layer ${target} was not found.`);
      continue;
    }
    if (values[target] === undefined || values[target] === "") continue;
    const normalizedSourceName = normalizeName(layer.name);
    const sourceOccurrence = textLayers
      .slice(0, textLayers.findIndex((item) => item.index === layer.index))
      .filter((item) => normalizeName(item.name) === normalizedSourceName)
      .length;
    jobs.push({
      target,
      sourceName: layer.name,
      sourceText: layer.text,
      sourceIndex: layer.index,
      sourceOccurrence,
      left: layer.left,
      top: layer.top,
      value: normalizePhotoshopText(values[target])
    });
  }

  return { jobs, report, warnings };
}

function buildPhotoshopScript({ templatePath, outputPath, reportPath, jobs }) {
  const jobText = jobs.map((job) => (
    `{target:${jsxString(job.target)},sourceName:${jsxString(job.sourceName)},sourceText:${jsxString(job.sourceText || "")},sourceIndex:${Number(job.sourceIndex)},sourceOccurrence:${Number(job.sourceOccurrence || 0)},left:${Number(job.left)},top:${Number(job.top)},value:${jsxString(job.value)}}`
  )).join(",\n");

  return `#target photoshop
app.displayDialogs = DialogModes.NO;

var templateFile = new File(${photoshopPathLiteral(templatePath)});
var outputFile = new File(${photoshopPathLiteral(outputPath)});
var reportFile = new File(${photoshopPathLiteral(reportPath)});
var jobs = [
${jobText}
];

function esc(value) {
  return String(value).replace(/\\\\/g, "\\\\\\\\").replace(/"/g, "\\\\\\"").replace(/\\r/g, "\\\\r").replace(/\\n/g, "\\\\n");
}

function writeReport(ok, message, changed, missing) {
  reportFile.encoding = "UTF8";
  reportFile.open("w");
  reportFile.write("{\\"ok\\":" + (ok ? "true" : "false") + ",\\"message\\":\\"" + esc(message || "") + "\\",\\"changed\\":" + changed + ",\\"missing\\":[");
  for (var i = 0; i < missing.length; i++) {
    if (i) reportFile.write(",");
    reportFile.write("\\"" + esc(missing[i]) + "\\"");
  }
  reportFile.write("]}");
  reportFile.close();
}

function px(value) {
  try { return Number(value.as("px")); } catch (e) { return Number(value); }
}

function collectTextLayers(container, output) {
  for (var i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (layer.typename === "ArtLayer") {
      try {
        if (layer.kind === LayerKind.TEXT) output.push(layer);
      } catch (e) {}
    } else if (layer.typename === "LayerSet") {
      collectTextLayers(layer, output);
    }
  }
}

function layerLeft(layer) {
  try { return px(layer.bounds[0]); } catch (e) { return -999999; }
}

function layerTop(layer) {
  try { return px(layer.bounds[1]); } catch (e) { return -999999; }
}

function closeEnough(a, b) {
  return Math.abs(Number(a) - Number(b)) <= 40;
}

function cleanName(value) {
  return String(value).replace(/^\\s+|\\s+$/g, "").replace(/\\s+/g, " ").toUpperCase();
}

function layerText(layer) {
  try { return String(layer.textItem.contents); } catch (e) { return ""; }
}

function findLayer(layers, job) {
  var i;
  for (i = 0; i < layers.length; i++) {
    if (String(layers[i].name).toUpperCase() === String(job.target).toUpperCase()) return layers[i];
  }

  if (job.sourceIndex >= 0 && job.sourceIndex < layers.length) {
    var indexed = layers[job.sourceIndex];
    if (cleanName(indexed.name) === cleanName(job.sourceName) || cleanName(layerText(indexed)) === cleanName(job.sourceText)) {
      return indexed;
    }
  }

  for (i = 0; i < layers.length; i++) {
    if (cleanName(layers[i].name) === cleanName(job.sourceName) && closeEnough(layerLeft(layers[i]), job.left) && closeEnough(layerTop(layers[i]), job.top)) {
      return layers[i];
    }
  }

  var named = [];
  for (i = 0; i < layers.length; i++) {
    if (cleanName(layers[i].name) === cleanName(job.sourceName)) named.push(layers[i]);
  }
  if (named.length > Number(job.sourceOccurrence || 0)) {
    return named[Number(job.sourceOccurrence || 0)];
  }
  if (named.length === 1) return named[0];

  var textMatches = [];
  for (i = 0; i < layers.length; i++) {
    if (cleanName(layerText(layers[i])) === cleanName(job.sourceText)) textMatches.push(layers[i]);
  }
  if (textMatches.length > Number(job.sourceOccurrence || 0)) {
    return textMatches[Number(job.sourceOccurrence || 0)];
  }
  if (textMatches.length === 1) return textMatches[0];

  return null;
}

var doc = null;
try {
  doc = app.open(templateFile);
  var textLayers = [];
  collectTextLayers(doc, textLayers);
  var missing = [];
  var changed = 0;

  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    var layer = findLayer(textLayers, job);
    if (!layer) {
      missing.push(job.target);
      continue;
    }
    try { layer.allLocked = false; } catch (e1) {}
    app.activeDocument.activeLayer = layer;
    layer.textItem.contents = job.value;
    layer.name = job.target;
    changed++;
  }

  var options = new PhotoshopSaveOptions();
  options.alphaChannels = true;
  options.annotations = true;
  options.embedColorProfile = true;
  options.layers = true;
  options.maximizeCompatibility = true;
  options.spotColor = true;
  doc.saveAs(outputFile, options, true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  writeReport(missing.length === 0, missing.length ? "Some layers were not found." : "Saved by Photoshop.", changed, missing);
} catch (error) {
  try {
    if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);
  } catch (closeError) {}
  writeReport(false, error.message || String(error), 0, []);
}
`;
}

function sharedLayerScript(jobText) {
  return `
var jobs = [
${jobText}
];

function px(value) {
  try { return Number(value.as("px")); } catch (e) { return Number(value); }
}

function collectTextLayers(container, output) {
  for (var i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (layer.typename === "ArtLayer") {
      try {
        if (layer.kind === LayerKind.TEXT) output.push(layer);
      } catch (e) {}
    } else if (layer.typename === "LayerSet") {
      collectTextLayers(layer, output);
    }
  }
}

function layerLeft(layer) {
  try { return px(layer.bounds[0]); } catch (e) { return -999999; }
}

function layerTop(layer) {
  try { return px(layer.bounds[1]); } catch (e) { return -999999; }
}

function closeEnough(a, b) {
  return Math.abs(Number(a) - Number(b)) <= 40;
}

function cleanName(value) {
  return String(value).replace(/^\\s+|\\s+$/g, "").replace(/\\s+/g, " ").toUpperCase();
}

function layerText(layer) {
  try { return String(layer.textItem.contents); } catch (e) { return ""; }
}

function findLayer(layers, job) {
  var i;
  for (i = 0; i < layers.length; i++) {
    if (String(layers[i].name).toUpperCase() === String(job.target).toUpperCase()) return layers[i];
  }

  if (job.sourceIndex >= 0 && job.sourceIndex < layers.length) {
    var indexed = layers[job.sourceIndex];
    if (cleanName(indexed.name) === cleanName(job.sourceName) || cleanName(layerText(indexed)) === cleanName(job.sourceText)) {
      return indexed;
    }
  }

  for (i = 0; i < layers.length; i++) {
    if (cleanName(layers[i].name) === cleanName(job.sourceName) && closeEnough(layerLeft(layers[i]), job.left) && closeEnough(layerTop(layers[i]), job.top)) {
      return layers[i];
    }
  }
  var named = [];
  for (i = 0; i < layers.length; i++) {
    if (cleanName(layers[i].name) === cleanName(job.sourceName)) named.push(layers[i]);
  }
  if (named.length > Number(job.sourceOccurrence || 0)) {
    return named[Number(job.sourceOccurrence || 0)];
  }
  if (named.length === 1) return named[0];

  var textMatches = [];
  for (i = 0; i < layers.length; i++) {
    if (cleanName(layerText(layers[i])) === cleanName(job.sourceText)) textMatches.push(layers[i]);
  }
  if (textMatches.length > Number(job.sourceOccurrence || 0)) {
    return textMatches[Number(job.sourceOccurrence || 0)];
  }
  if (textMatches.length === 1) return textMatches[0];

  return null;
}

function applyJobs() {
  var doc = app.activeDocument;
  var textLayers = [];
  collectTextLayers(doc, textLayers);
  var missing = [];
  var changed = 0;

  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    var layer = findLayer(textLayers, job);
    if (!layer) {
      missing.push(job.target);
      continue;
    }
    try { layer.allLocked = false; } catch (e1) {}
    app.activeDocument.activeLayer = layer;
    layer.textItem.contents = job.value;
    layer.name = job.target;
    changed++;
  }

  return { changed: changed, missing: missing };
}
`;
}

function buildPhotopeaScript({ jobs, format = "psd:true" }) {
  const jobText = jobs.map((job) => (
    `{target:${jsxString(job.target)},sourceName:${jsxString(job.sourceName)},sourceText:${jsxString(job.sourceText || "")},sourceIndex:${Number(job.sourceIndex)},sourceOccurrence:${Number(job.sourceOccurrence || 0)},left:${Number(job.left)},top:${Number(job.top)},value:${jsxString(job.value)}}`
  )).join(",\n");

  return `
${sharedLayerScript(jobText)}

try {
  var result = applyJobs();
  if (result.missing.length) {
    app.echoToOE("CARD_ERROR:" + JSON.stringify({ message: "Missing layers", missing: result.missing, changed: result.changed }));
  } else {
    app.echoToOE("CARD_STATUS:" + JSON.stringify({ message: "Layers updated", changed: result.changed }));
    app.activeDocument.saveToOE(${jsxString(format)});
  }
} catch (error) {
  app.echoToOE("CARD_ERROR:" + JSON.stringify({ message: error.message || String(error) }));
}
`;
}

function waitForReport(reportPath, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (fs.existsSync(reportPath)) {
        clearInterval(timer);
        try {
          resolve(JSON.parse(fs.readFileSync(reportPath, "utf8")));
        } catch (error) {
          reject(new Error(`Photoshop wrote an unreadable report: ${error.message}`));
        }
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Photoshop did not finish the save. Close any Photoshop dialog windows and try again."));
      }
    }, 500);
  });
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      windowsHide: options.windowsHide !== false
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const startedAt = Date.now();
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({
        ok: false,
        code: null,
        timedOut: true,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt
      });
    }, options.timeoutMs || 15000);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        code: null,
        timedOut: false,
        stdout,
        stderr: stderr || error.message,
        durationMs: Date.now() - startedAt
      });
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: code === 0,
        code,
        timedOut: false,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function runPhotoshopScript(scriptPath, reportPath) {
  const escapedScript = scriptPath.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    `$app = New-Object -ComObject Photoshop.Application`,
    `$app.DoJavaScriptFile('${escapedScript}')`
  ].join("; ");

  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
      cwd: ROOT,
      windowsHide: true
    });
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Photoshop automation timed out. Close Photoshop dialogs, restart Photoshop if needed, and try again."));
    }, 15000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(
          stderr.trim()
            || "Photoshop automation could not start. Close Photoshop dialogs, restart Photoshop, and try again."
        ));
      }
    });
  });

  return waitForReport(reportPath, 10000);
}

async function createCardWithPhotoshop(values, templatePath = TEMPLATE) {
  const clean = normalizeValues(values);
  const errors = validateValues(clean);
  if (errors.length) throw new Error(errors.join(" "));
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  const parsed = parsePsd(fs.readFileSync(templatePath));
  if (parsed.width > 30000 || parsed.height > 30000) {
    throw new Error("This template is too large for classic PSD output.");
  }

  const result = buildPhotoshopJobs(parsed, clean);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(AUTOMATION_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const fileName = `${fileNameSafe(clean.LAST || clean.FIRST)}-${fileNameSafe(clean.CODE || clean.DOCNMBR)}-${stamp}.psd`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  const scriptPath = path.join(AUTOMATION_DIR, `${fileName}.jsx`);
  const reportPath = path.join(AUTOMATION_DIR, `${fileName}.json`);

  fs.rmSync(reportPath, { force: true });
  fs.writeFileSync(scriptPath, buildPhotoshopScript({
    templatePath,
    outputPath,
    reportPath,
    jobs: result.jobs
  }), "utf8");

  let report;
  try {
    report = await runPhotoshopScript(scriptPath, reportPath);
  } catch (error) {
    return {
      outputPath,
      fileName,
      scriptPath,
      scriptFileName: path.basename(scriptPath),
      manualAction: true,
      warnings: [
        "Photoshop automation is blocked on this machine.",
        "A Photoshop script was created instead. In Photoshop choose File > Scripts > Browse, run that script, and Photoshop will save the PSD."
      ],
      automationError: error.message,
      changed: 0,
      mapping: result.report,
      engine: "Photoshop script",
      verify: null
    };
  }

  if (!report.ok) {
    return {
      outputPath,
      fileName,
      scriptPath,
      scriptFileName: path.basename(scriptPath),
      manualAction: true,
      warnings: [
        `Photoshop did not finish the automatic save: ${report.message}`,
        "A Photoshop script was created instead. In Photoshop choose File > Scripts > Browse, run that script, and Photoshop will save the PSD."
      ],
      automationError: report.message,
      changed: report.changed || 0,
      mapping: result.report,
      engine: "Photoshop script",
      verify: null
    };
  }
  if (!fs.existsSync(outputPath)) {
    throw new Error("Photoshop reported success but no PSD file was created.");
  }

  const verify = parsePsd(fs.readFileSync(outputPath));
  if (verify.isPsb) {
    fs.unlinkSync(outputPath);
    throw new Error("Photoshop created a PSB instead of a PSD.");
  }
  return {
    outputPath,
    fileName,
    warnings: result.warnings,
    changed: report.changed,
    mapping: result.report,
    engine: "Photoshop",
    verify: {
      format: verify.isPsb ? "PSB" : "PSD",
      layerCount: verify.layerCount,
      textLayerCount: verify.layers.filter((layer) => layer.textBlock).length
    }
  };
}

async function createCard(values, templatePath = TEMPLATE) {
  return createCardWithPhotoshop(values, templatePath);
}

function makeDiagnosticStep(id, label) {
  const startedAt = Date.now();
  return {
    id,
    label,
    status: "running",
    details: "",
    data: {},
    finish(status, details, data = {}) {
      this.status = status;
      this.details = details;
      this.data = data;
      this.durationMs = Date.now() - startedAt;
      return this;
    }
  };
}

function workflowDiagnosis(steps) {
  const failed = steps.find((step) => step.status === "fail");
  if (failed) {
    return {
      status: "fail",
      stage: failed.id,
      summary: `${failed.label} failed: ${failed.details}`
    };
  }

  const manual = steps.find((step) => step.status === "manual");
  if (manual) {
    return {
      status: "manual",
      stage: manual.id,
      summary: manual.details
    };
  }

  const warning = steps.find((step) => step.status === "warn");
  if (warning) {
    return {
      status: "warn",
      stage: warning.id,
      summary: warning.details
    };
  }

  return {
    status: "pass",
    stage: "complete",
    summary: "Automatic PSD save workflow is working."
  };
}

function writeDebugPhotoshopScript(values, parsed) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const clean = normalizeValues(values);
  const jobs = buildPhotoshopJobs(parsed, clean);
  const scriptPath = path.join(DEBUG_DIR, "debug-save-test.psd.jsx");
  const reportPath = path.join(DEBUG_DIR, "debug-save-test.psd.json");
  const outputPath = path.join(DEBUG_DIR, "debug-save-test.psd");
  fs.rmSync(reportPath, { force: true });
  fs.rmSync(outputPath, { force: true });
  fs.writeFileSync(scriptPath, buildPhotoshopScript({
    templatePath: TEMPLATE,
    outputPath,
    reportPath,
    jobs: jobs.jobs
  }), "utf8");
  return { scriptPath, reportPath, outputPath, jobs };
}

async function probePhotoshopCom(timeoutMs = 25000) {
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "$app = New-Object -ComObject Photoshop.Application",
    "$app.Version | Write-Output"
  ].join("; ");
  return runProcess("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { timeoutMs });
}

async function probePhotoshopCli(photoshopExe, scriptPath, reportPath, timeoutMs = 15000) {
  fs.rmSync(reportPath, { force: true });
  const scriptForJs = scriptPath.replace(/\\/g, "/").replace(/'/g, "\\'");
  const evalCode = `$.evalFile('${scriptForJs}')`;
  const ps = [
    `$exe = ${psSingleQuoted(photoshopExe)}`,
    `$evalCode = ${psSingleQuoted(evalCode)}`,
    "Start-Process -FilePath $exe -ArgumentList @('-r', $evalCode)",
    `Start-Sleep -Milliseconds ${timeoutMs}`,
    `if (Test-Path ${psSingleQuoted(reportPath)}) { Get-Content ${psSingleQuoted(reportPath)} -Raw } else { Write-Output 'NO_REPORT' }`
  ].join("; ");
  return runProcess("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { timeoutMs: timeoutMs + 5000 });
}

async function runDiagnostics(values = exampleValues()) {
  const steps = [];
  const add = (step) => {
    steps.push({
      id: step.id,
      label: step.label,
      status: step.status,
      details: step.details,
      data: step.data,
      durationMs: step.durationMs
    });
  };

  let parsed = null;
  let debugScript = null;
  const startedAt = Date.now();

  let step = makeDiagnosticStep("template", "Template parse");
  try {
    if (!fs.existsSync(TEMPLATE)) throw new Error(`Missing ${TEMPLATE}`);
    parsed = parsePsd(fs.readFileSync(TEMPLATE));
    add(step.finish("pass", `${parsed.isPsb ? "PSB" : "PSD"} template parsed.`, {
      file: TEMPLATE,
      format: parsed.isPsb ? "PSB" : "PSD",
      size: `${parsed.width}x${parsed.height}`,
      layers: parsed.layerCount,
      textLayers: parsed.layers.filter((layer) => layer.textBlock).length
    }));
  } catch (error) {
    add(step.finish("fail", error.message));
    return { ...workflowDiagnosis(steps), steps, durationMs: Date.now() - startedAt };
  }

  step = makeDiagnosticStep("mapping", "Layer mapping");
  try {
    const mapped = buildMapping(parsed.layers);
    const missing = mapped.report.filter((item) => !item.layer).map((item) => item.target);
    add(step.finish(missing.length ? "fail" : "pass", missing.length ? `Missing mapped layers: ${missing.join(", ")}` : `${mapped.report.length}/${TARGETS.length} target fields mapped.`, {
      mapped: mapped.report
    }));
    if (missing.length) return { ...workflowDiagnosis(steps), steps, durationMs: Date.now() - startedAt };
  } catch (error) {
    add(step.finish("fail", error.message));
    return { ...workflowDiagnosis(steps), steps, durationMs: Date.now() - startedAt };
  }

  step = makeDiagnosticStep("native-psd", "Native PSD structural smoke test");
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const nativeResult = rebuildPsd(parsed, normalizeValues(values), { outputFormat: "psd" });
    const nativePath = path.join(DEBUG_DIR, "native-writer-smoke-test.psd");
    fs.writeFileSync(nativePath, nativeResult.output);
    const nativeParsed = parsePsd(fs.readFileSync(nativePath));
    const textRunErrors = validateTextRuns(nativeParsed);
    if (nativeParsed.isPsb) throw new Error("Native writer produced PSB instead of PSD.");
    if (textRunErrors.length) throw new Error(textRunErrors.join(" "));
    add(step.finish("pass", "Native writer creates a structurally valid PSD, but Photoshop-save remains preferred.", {
      file: nativePath,
      version: 1,
      textLayers: nativeParsed.layers.filter((layer) => layer.textBlock).length
    }));
  } catch (error) {
    add(step.finish("warn", `Native writer is not safe for final output: ${error.message}`));
  }

  step = makeDiagnosticStep("script", "Photoshop script generation");
  try {
    debugScript = writeDebugPhotoshopScript(values, parsed);
    add(step.finish("pass", "Debug Photoshop script generated.", {
      scriptPath: debugScript.scriptPath,
      outputPath: debugScript.outputPath,
      reportPath: debugScript.reportPath,
      jobs: debugScript.jobs.jobs.length
    }));
  } catch (error) {
    add(step.finish("fail", error.message));
    return { ...workflowDiagnosis(steps), steps, durationMs: Date.now() - startedAt };
  }

  step = makeDiagnosticStep("photoshop-exe", "Photoshop executable");
  const photoshopExe = findPhotoshopExe();
  if (photoshopExe) {
    add(step.finish("pass", "Photoshop executable found.", { photoshopExe }));
  } else {
    add(step.finish("manual", "Photoshop.exe was not found. Install Photoshop or set PHOTOSHOP_EXE.", {}));
    return { ...workflowDiagnosis(steps), steps, durationMs: Date.now() - startedAt };
  }

  step = makeDiagnosticStep("photoshop-com", "Photoshop COM automation");
  const com = await probePhotoshopCom();
  if (com.ok) {
    add(step.finish("pass", "COM automation started Photoshop.", {
      stdout: com.stdout.trim(),
      durationMs: com.durationMs
    }));
  } else {
    const message = com.timedOut
      ? "COM startup timed out."
      : (com.stderr || com.stdout || "COM startup failed.").trim();
    add(step.finish("manual", message, {
      timedOut: com.timedOut,
      code: com.code,
      stdout: com.stdout.trim(),
      stderr: com.stderr.trim(),
      durationMs: com.durationMs
    }));
  }

  step = makeDiagnosticStep("photoshop-cli", "Photoshop command-line script probe");
  const cli = await probePhotoshopCli(photoshopExe, debugScript.scriptPath, debugScript.reportPath);
  const cliOutput = `${cli.stdout}\n${cli.stderr}`.trim();
  if (fs.existsSync(debugScript.reportPath)) {
    let report = {};
    try {
      report = JSON.parse(fs.readFileSync(debugScript.reportPath, "utf8"));
    } catch (error) {
      report = { ok: false, message: error.message };
    }
    add(step.finish(report.ok ? "pass" : "manual", report.ok ? "Command-line script executed." : `Photoshop script ran but reported: ${report.message}`, {
      report,
      stdout: cli.stdout.trim(),
      stderr: cli.stderr.trim()
    }));
  } else {
    add(step.finish("manual", "Photoshop command-line script launch did not produce a report. Use File > Scripts > Browse with the generated script.", {
      stdout: cli.stdout.trim(),
      stderr: cli.stderr.trim(),
      timedOut: cli.timedOut,
      durationMs: cli.durationMs,
      scriptPath: debugScript.scriptPath,
      outputPath: debugScript.outputPath
    }));
  }

  step = makeDiagnosticStep("final-output", "Final PSD output");
  if (fs.existsSync(debugScript.outputPath)) {
    try {
      const outputParsed = parsePsd(fs.readFileSync(debugScript.outputPath));
      add(step.finish(outputParsed.isPsb ? "fail" : "pass", outputParsed.isPsb ? "Output exists but is PSB." : "Debug PSD output exists and parses as PSD.", {
        outputPath: debugScript.outputPath,
        format: outputParsed.isPsb ? "PSB" : "PSD",
        textLayers: outputParsed.layers.filter((layer) => layer.textBlock).length
      }));
    } catch (error) {
      add(step.finish("fail", `Output exists but could not be parsed: ${error.message}`, { outputPath: debugScript.outputPath }));
    }
  } else {
    add(step.finish("manual", "No PSD was created automatically. The generated script is ready for Photoshop's File > Scripts > Browse flow.", {
      scriptPath: debugScript.scriptPath,
      outputPath: debugScript.outputPath
    }));
  }

  return {
    ...workflowDiagnosis(steps),
    steps,
    durationMs: Date.now() - startedAt,
    generatedScript: debugScript?.scriptPath || "",
    expectedOutput: debugScript?.outputPath || ""
  };
}

function getAvailableFontFiles() {
  const dirs = [path.join(process.env.SystemRoot || "C:\\Windows", "Fonts"), FONT_DIR];
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) files.push(file.toLowerCase());
  }
  return files;
}

function fontLooksAvailable(fontName, files) {
  const normalized = fontName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "adobeinvisfont") return true;
  const aliases = {
    arialmt: ["arial", "arialregular"],
    arialboldmt: ["arialbd", "arialbold"],
    tahomabold: ["tahomabd", "tahomabold"],
    myriadproregular: ["myriadproregular", "myriadpro"],
    metapronormal: ["metapronormal", "metapro"],
    ocrb10pitchbtregular: ["ocrb", "ocrb10"]
  };
  const candidates = [normalized, ...(aliases[normalized] || [])];
  const normalizedFiles = files.map((file) => file.replace(/[^a-z0-9]/g, ""));
  return candidates.some((candidate) => (
    candidate.length >= 5 && normalizedFiles.some((file) => file.includes(candidate))
  ));
}

function getStatus() {
  const exists = fs.existsSync(TEMPLATE);
  const template = {
    exists,
    fileName: path.basename(TEMPLATE),
    format: "-",
    size: exists ? `${Math.round(fs.statSync(TEMPLATE).size / 1024)} KB` : "-",
    textLayerCount: 0
  };
  const warnings = [];
  let mapping = TARGETS.map((target) => ({ target, layer: "", method: "missing" }));
  let fonts = [];

  if (exists) {
    const parsed = parsePsd(fs.readFileSync(TEMPLATE));
    template.format = parsed.isPsb ? "PSB" : "PSD";
    template.size = `${parsed.width} x ${parsed.height}`;
    template.textLayerCount = parsed.layers.filter((layer) => layer.textBlock).length;
    const mapped = buildMapping(parsed.layers);
    mapping = mapped.report;
    const availableFiles = getAvailableFontFiles();
    const fontNames = [...new Set(parsed.layers.flatMap((layer) => layer.fonts))];
    fonts = fontNames.map((name) => ({ name, available: fontLooksAvailable(name, availableFiles) }));
    const missing = fonts.filter((font) => !font.available).map((font) => font.name);
    if (missing.length) {
      warnings.push(`Font check: ${missing.join(", ")} may need to be installed. Arial fallback remains available in the PSD style list.`);
    }
    const missingLayers = mapping.filter((item) => !item.layer).map((item) => item.target);
    if (missingLayers.length) warnings.push(`Missing mapped layers: ${missingLayers.join(", ")}.`);
  }

  return {
    template,
    outputFormat: "PSD",
    engine: "Photoshop",
    targetCount: TARGETS.length,
    mappedCount: mapping.filter((item) => item.layer).length,
    mapping,
    fonts,
    warnings
  };
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readRaw(req, limit = 250 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Uploaded file is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createOutputName(values) {
  const clean = normalizeValues(values);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${fileNameSafe(clean.LAST || clean.FIRST)}-${fileNameSafe(clean.CODE || clean.DOCNMBR)}-${stamp}.psd`;
}

function makePhotopeaSession(values) {
  const clean = normalizeValues(values);
  const errors = validateValues(clean);
  if (errors.length) throw new Error(errors.join(" "));
  if (!fs.existsSync(TEMPLATE)) throw new Error(`Template not found: ${TEMPLATE}`);

  const parsed = parsePsd(fs.readFileSync(TEMPLATE));
  const result = buildPhotoshopJobs(parsed, clean);
  const missing = result.report.filter((item) => !item.layer).map((item) => item.target);
  if (missing.length) throw new Error(`Missing mapped layers: ${missing.join(", ")}`);
  const fileName = createOutputName(clean);

  return {
    engine: "Photopea Live Messaging",
    templateUrl: "/api/template",
    fileName,
    uploadUrl: `/api/photopea-output?file=${encodeURIComponent(fileName)}`,
    script: buildPhotopeaScript({ jobs: result.jobs, format: "psd:true" }),
    jobs: result.jobs.length,
    warnings: result.warnings,
    expectedOutput: path.join(OUTPUT_DIR, fileName)
  };
}

function serveDownload(res, name) {
  const safe = path.basename(name || "");
  const file = path.join(OUTPUT_DIR, safe);
  if (!safe || !fs.existsSync(file)) {
    sendJson(res, 404, { error: "File not found." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safe.replace(/"/g, "")}"`
  });
  fs.createReadStream(file).pipe(res);
}

function serveTemplate(res) {
  if (!fs.existsSync(TEMPLATE)) {
    sendJson(res, 404, { error: "Template not found." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": fs.statSync(TEMPLATE).size,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(TEMPLATE).pipe(res);
}

function serveAutomationDownload(res, name) {
  const safe = path.basename(name || "");
  const file = path.join(AUTOMATION_DIR, safe);
  if (!safe || !fs.existsSync(file)) {
    sendJson(res, 404, { error: "Script not found." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safe.replace(/"/g, "")}"`
  });
  fs.createReadStream(file).pipe(res);
}

async function savePhotopeaOutput(req, res, name) {
  const safe = path.basename(name || "");
  if (!safe || !/\.psd$/i.test(safe)) {
    sendJson(res, 400, { error: "Output file name must end with .psd." });
    return;
  }
  const data = await readRaw(req);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, safe);
  fs.writeFileSync(outputPath, data);

  let verify = null;
  try {
    const parsed = parsePsd(data);
    verify = {
      format: parsed.isPsb ? "PSB" : "PSD",
      layerCount: parsed.layerCount,
      textLayerCount: parsed.layers.filter((layer) => layer.textBlock).length,
      width: parsed.width,
      height: parsed.height
    };
  } catch (error) {
    sendJson(res, 400, {
      error: `Photopea returned a file, but it did not parse as PSD/PSB: ${error.message}`,
      outputPath
    });
    return;
  }

  sendJson(res, 200, {
    fileName: safe,
    outputPath,
    downloadUrl: `/api/download?file=${encodeURIComponent(safe)}`,
    verify
  });
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === "GET" && url.pathname === "/") {
        const html = fs.readFileSync(UI_FILE);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        sendJson(res, 200, getStatus());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/template") {
        serveTemplate(res);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/diagnose") {
        const body = await readJson(req);
        sendJson(res, 200, await runDiagnostics(body.values || exampleValues()));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/photopea-session") {
        const body = await readJson(req);
        sendJson(res, 200, makePhotopeaSession(body.values || {}));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/photopea-output") {
        await savePhotopeaOutput(req, res, url.searchParams.get("file"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/download") {
        serveDownload(res, url.searchParams.get("file"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/script") {
        serveAutomationDownload(res, url.searchParams.get("file"));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/create") {
        const body = await readJson(req);
        const created = await createCard(body.values || {});
        sendJson(res, 200, {
          fileName: created.fileName,
          outputPath: created.outputPath,
          downloadUrl: `/api/download?file=${encodeURIComponent(created.fileName)}`,
          manualAction: Boolean(created.manualAction),
          scriptFileName: created.scriptFileName,
          scriptPath: created.scriptPath,
          scriptDownloadUrl: created.scriptFileName ? `/api/script?file=${encodeURIComponent(created.scriptFileName)}` : "",
          automationError: created.automationError,
          warnings: created.warnings,
          changed: created.changed,
          mapping: created.mapping,
          engine: created.engine,
          verify: created.verify
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/import-font") {
        const body = await readJson(req);
        const name = path.basename(String(body.name || ""));
        if (!/\.(ttf|otf|ttc)$/i.test(name)) throw new Error("Use a .ttf, .otf, or .ttc font file.");
        fs.mkdirSync(FONT_DIR, { recursive: true });
        fs.writeFileSync(path.join(FONT_DIR, name), Buffer.from(String(body.base64 || ""), "base64"));
        sendJson(res, 200, { message: `Imported ${name}. Install it in Windows or Photoshop if the PSD still reports it missing.` });
        return;
      }
      sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Company card PSD editor is running at http://127.0.0.1:${PORT}`);
    console.log(`Template: ${TEMPLATE}`);
  });
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage:");
    console.log("  node card-psd-editor.js");
    console.log("  node card-psd-editor.js --json data.json");
    console.log("  node card-psd-editor.js --diagnose");
    return;
  }

  if (args.includes("--diagnose")) {
    const report = await runDiagnostics(exampleValues());
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const jsonIndex = args.indexOf("--json");
  if (jsonIndex >= 0) {
    const input = args[jsonIndex + 1];
    if (!input) throw new Error("Missing JSON file path.");
    const values = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
    const result = await createCard(values);
    if (result.manualAction) {
      console.log(`Photoshop script created: ${result.scriptPath}`);
      console.log(`Run it in Photoshop with File > Scripts > Browse to create: ${result.outputPath}`);
    } else {
      console.log(`Created ${result.outputPath}`);
    }
    if (result.warnings.length) console.log(`Warnings: ${result.warnings.join(" ")}`);
    return;
  }

  startServer();
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parsePsd,
  createCard,
  getStatus,
  runDiagnostics,
  normalizeValues,
  validateValues,
  validateTextRuns
};
