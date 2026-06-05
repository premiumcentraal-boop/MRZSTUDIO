Update the Internal Badge Studio website so PSD downloads support multipart Supabase Storage outputs.

Context:
The Windows worker now uploads large PSD exports in parts because Supabase may reject a single ~94 MB PSD even when the bucket says 250 MB. For PSD jobs, `badge_jobs.output_psd_path` may now point to a manifest file instead of a direct PSD:

Example:
output_psd_path = "JOB_ID/result.psd.manifest.json"

The manifest is stored in the private `badge-outputs` bucket and looks like:

{
  "type": "multipart-psd",
  "version": 1,
  "fileName": "result.psd",
  "contentType": "application/octet-stream",
  "totalBytes": 98555789,
  "partSize": 45000000,
  "parts": [
    { "index": 0, "path": "JOB_ID/result.psd.part001", "size": 45000000, "start": 0, "end": 45000000 },
    { "index": 1, "path": "JOB_ID/result.psd.part002", "size": 45000000, "start": 45000000, "end": 90000000 },
    { "index": 2, "path": "JOB_ID/result.psd.part003", "size": 8555789, "start": 90000000, "end": 98555789 }
  ],
  "createdAt": "..."
}

Task:
Update the website download logic so:

1. Existing direct downloads still work.
   If output path does NOT end with ".manifest.json", keep the current behavior:
   - create signed URL from `badge-outputs`
   - open it in a new tab/window

2. Multipart PSD downloads work.
   If output path ends with ".manifest.json":
   - Download the manifest from Supabase Storage bucket `badge-outputs`
   - Parse the JSON
   - Validate `manifest.type === "multipart-psd"`
   - Sort `manifest.parts` by `index`
   - Download each part from `badge-outputs` using `part.path`
   - Convert each part Blob to `Uint8Array`
   - Combine all chunks into one browser Blob
   - Use `manifest.contentType || "application/octet-stream"`
   - Trigger a browser download using `manifest.fileName || "result.psd"`
   - Do NOT open part URLs in new tabs

3. Add user-friendly status while downloading.
   Large PSD downloads may take time. Add state such as:
   - `downloadingPath`
   - `downloadProgressText`
   Show text like:
   - "Preparing PSD download..."
   - "Downloading PSD part 1 of 3..."
   - "Building PSD file..."
   Disable the PSD download button while it is working.

4. Add safe error handling.
   If any manifest or part download fails:
   - show a clear alert: "Failed to download PSD parts. Please refresh and try again."
   - reset the download state

5. Keep this browser-only.
   No backend.
   No server function.
   Use only the existing Supabase browser client.

Implementation sketch:

```ts
const downloadResult = async (path: string) => {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    if (path.endsWith(".manifest.json")) {
      await downloadMultipartPsd(path);
      return;
    }

    const { data, error } = await supabase.storage
      .from("badge-outputs")
      .createSignedUrl(path, 60);

    if (error) throw error;
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  } catch (error) {
    console.error(error);
    alert("Failed to download result");
  }
};

const downloadMultipartPsd = async (manifestPath: string) => {
  setDownloadingPath(manifestPath);
  setDownloadProgressText("Preparing PSD download...");

  try {
    const { data: manifestBlob, error: manifestError } = await supabase.storage
      .from("badge-outputs")
      .download(manifestPath);

    if (manifestError) throw manifestError;
    if (!manifestBlob) throw new Error("Manifest was empty");

    const manifest = JSON.parse(await manifestBlob.text());

    if (manifest.type !== "multipart-psd" || !Array.isArray(manifest.parts)) {
      throw new Error("Invalid PSD manifest");
    }

    const parts = [...manifest.parts].sort((a, b) => a.index - b.index);
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < parts.length; i++) {
      setDownloadProgressText(`Downloading PSD part ${i + 1} of ${parts.length}...`);

      const { data: partBlob, error: partError } = await supabase.storage
        .from("badge-outputs")
        .download(parts[i].path);

      if (partError) throw partError;
      if (!partBlob) throw new Error(`Part was empty: ${parts[i].path}`);

      chunks.push(new Uint8Array(await partBlob.arrayBuffer()));
    }

    setDownloadProgressText("Building PSD file...");

    const blob = new Blob(chunks.map((chunk) => chunk.slice()), {
      type: manifest.contentType || "application/octet-stream",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = manifest.fileName || "result.psd";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error(error);
    alert("Failed to download PSD parts. Please refresh and try again.");
  } finally {
    setDownloadingPath(null);
    setDownloadProgressText("");
  }
};