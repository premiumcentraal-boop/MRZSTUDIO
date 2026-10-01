const http = require("http");
const { dryRunBadgePng } = require("./png");

const photo = dryRunBadgePng({ side: "FRONT" });
const payload = {
  template: "EmployeeID.psd",
  company_name: "Acme Corporation",
  issuer_code: "NLD",
  department: "Engineering",
  first_name: "Vries",
  last_name: "Mila",
  doc_number: "AB12C34D5",
  personal_number: "123456789",
  valid_from: "2020-06-14",
  expires: "2030-06-14",
  birth_date: "1990-06-14",
  birth_year: "1990",
  gender: "F",
  height: "1,72 m",
  country_of_birth: "Nederlandse",
  city_of_birth: "Zoetermeer",
  company_location: "Burg. van Zoetermeer",
  country: "NL",
  doc_type: "id_card",
  nationality_code: "NLD",
  export_format: "png",
  generate_mockups: false,
  meta: { created_from: "verify", intended_use: "internal_company_badge" },
};

const boundary = "----mrz" + Date.now();
const chunks = [];
function field(name, value) {
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ),
  );
}
function file(name, filename, data, mime) {
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
  );
  chunks.push(data);
  chunks.push(Buffer.from("\r\n"));
}
field("payload", JSON.stringify(payload));
file("employee_photo", "photo.png", photo, "image/png");
chunks.push(Buffer.from(`--${boundary}--\r\n`));
const body = Buffer.concat(chunks);

function request(method, path, headers, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: 8787, path, method, headers },
      (res) => {
        const bufs = [];
        res.on("data", (c) => bufs.push(c));
        res.on("end", () => {
          const text = Buffer.concat(bufs).toString("utf8");
          resolve({ status: res.statusCode, text, headers: res.headers });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const created = await request("POST", "/api/jobs", {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  }, body);
  console.log("create", created.status, created.text);
  const job = JSON.parse(created.text);
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const got = await request("GET", `/api/jobs/${job.id}`);
    const row = JSON.parse(got.text);
    console.log("poll", row.status, row.error_message || "");
    if (row.status === "complete" || row.status === "failed") {
      const fileRes = await request("GET", `/api/jobs/${job.id}/files/result.png`);
      console.log("file", fileRes.status, "bytes", fileRes.text.length, "type", fileRes.headers["content-type"]);
      process.exit(row.status === "complete" && fileRes.status === 200 ? 0 : 1);
    }
  }
  console.error("timeout waiting for job");
  process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
