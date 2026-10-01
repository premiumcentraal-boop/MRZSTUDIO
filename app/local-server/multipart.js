/**
 * Minimal multipart/form-data parser (no extra npm deps).
 */
function parseContentDisposition(header) {
  const result = { name: null, filename: null };
  const nameMatch = /name="([^"]*)"/i.exec(header);
  if (nameMatch) result.name = nameMatch[1];
  const fileMatch = /filename="([^"]*)"/i.exec(header);
  if (fileMatch) result.filename = fileMatch[1];
  return result;
}

function parseMultipart(buffer, contentType) {
  const ct = String(contentType || "");
  const boundaryMatch = /boundary=([^;]+)/i.exec(ct);
  if (!boundaryMatch) {
    throw new Error("multipart/form-data is missing a boundary");
  }
  let boundary = boundaryMatch[1].trim();
  if (boundary.startsWith('"') && boundary.endsWith('"')) {
    boundary = boundary.slice(1, -1);
  }

  const sep = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};

  let cursor = buffer.indexOf(sep);
  while (cursor !== -1) {
    let partStart = cursor + sep.length;
    if (buffer[partStart] === 0x2d && buffer[partStart + 1] === 0x2d) break;
    if (buffer[partStart] === 0x0d && buffer[partStart + 1] === 0x0a) partStart += 2;

    const next = buffer.indexOf(sep, partStart);
    if (next === -1) break;

    let part = buffer.slice(partStart, next);
    if (part.length >= 2 && part[part.length - 2] === 0x0d && part[part.length - 1] === 0x0a) {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) {
      cursor = next;
      continue;
    }

    const header = part.slice(0, headerEnd).toString("utf8");
    const body = part.slice(headerEnd + 4);
    const disp = parseContentDisposition(header);
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(header);
    const mime = typeMatch ? typeMatch[1].trim() : "application/octet-stream";

    if (disp.filename != null && disp.name) {
      files[disp.name] = {
        filename: disp.filename,
        mime,
        data: body,
      };
    } else if (disp.name) {
      fields[disp.name] = body.toString("utf8");
    }

    cursor = next;
  }

  return { fields, files };
}

function readRequestBody(req, limitBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error(`Request body exceeds ${limitBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = { parseMultipart, readRequestBody };
