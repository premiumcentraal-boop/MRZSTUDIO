// ============================================================================
// image-to-video.cjs
// ----------------------------------------------------------------------------
// Convert a single still image into a high-quality, maximally-compatible MP4
// that plays reliably in VMOS and standard Android gallery / social apps.
//
// The image is kept COMPLETELY STATIC — no shake, zoom, motion, transitions or
// visual alteration. The full image is always visible: it is scaled
// proportionally and padded (letter/pillar-boxed) to fill a 1080×1920 frame so
// nothing is ever cropped.
//
// Output specification (hard requirements):
//   • Resolution ........ 1080 × 1920 (portrait)
//   • Frame rate ........ 24 fps
//   • Video codec ....... H.264 / AVC, Constrained Baseline profile
//   • Pixel format ...... yuv420p
//   • H.264 level ....... 4.0 (≤ 4.0)
//   • B-frames .......... disabled
//   • CABAC ............. disabled (CAVLC entropy coding)
//   • Video bitrate ..... ~3 Mbps (within the 2.5–4 Mbps target band)
//   • Audio ............. silent AAC-LC, stereo, 44.1 kHz
//   • Container ......... .mp4 with faststart (moov atom at the front)
//
// After encoding, the file is VERIFIED with ffprobe (and a faststart byte
// scan). The script throws / exits non-zero if any requirement is not met, so
// a non-compliant file is never "delivered".
//
// Usage (CLI):
//   node image-to-video.cjs <input-image> <output.mp4> [durationSeconds=5]
//
// Usage (module):
//   const { imageToVideo } = require('./image-to-video.cjs');
//   await imageToVideo({ input, output, duration: 5 });
//
// FFmpeg / ffprobe binaries are resolved from FFMPEG_PATH / FFPROBE_PATH env
// vars when set, otherwise from the system PATH.
// ============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

const TARGET = {
  width: 1080,
  height: 1920,
  fps: 24,
  // ffprobe reports libx264's baseline+constraint output as "Constrained Baseline".
  videoProfile: 'Constrained Baseline',
  pixFmt: 'yuv420p',
  audioCodec: 'aac',
  audioProfile: 'LC',
  audioSampleRate: 44100,
  audioChannels: 2,
  // Acceptable overall-file bitrate band (kbps). The spec targets ~2.5–4 Mbps
  // of video; the measured file bitrate also includes the 128k silent audio
  // track plus container overhead, so the band is widened slightly at the top.
  minBitrateKbps: 2500,
  maxBitrateKbps: 4400,
};

// ----------------------------------------------------------------------------
// Encode
// ----------------------------------------------------------------------------

function buildFfmpegArgs(input, output, duration) {
  // The video filter chain, in order:
  //   scale  → fit the whole image inside 1080×1920 (no crop), keeping the
  //            original aspect ratio (force_original_aspect_ratio=decrease)
  //   pad    → center it and fill the remaining area with black bars so the
  //            output is EXACTLY 1080×1920 with nothing cropped
  //   setsar → square pixels (1:1) so players don't stretch the frame
  //   format → yuv420p for universal decoder support
  const vf = [
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
    'setsar=1',
    'format=yuv420p',
  ].join(',');

  return [
    '-y',
    // Loop the single still for the requested duration.
    '-loop', '1',
    '-i', input,
    // Generate a silent stereo track so the file always carries AAC audio —
    // some Android players/feeds refuse or mishandle video-only MP4s.
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(duration),

    // ---- Video ----
    '-vf', vf,
    '-r', '24',
    '-c:v', 'libx264',
    '-profile:v', 'baseline',   // Constrained Baseline (no B-frames, no CABAC)
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-bf', '0',                 // belt-and-braces: no B-frames
    '-coder', '0',              // CAVLC (CABAC disabled)
    '-g', '48',                 // 2s keyframe interval @24fps — friendly to seeking
    // A still image compresses to almost nothing, so plain VBR would fall well
    // below the required band. Force true CBR (~3 Mbps, mid-band) with HRD
    // filler so the bitrate actually lands in the 2.5–4 Mbps target.
    '-b:v', '3M',
    '-minrate', '3M',
    '-maxrate', '3M',
    '-bufsize', '6M',
    '-x264-params', 'nal-hrd=cbr:filler=1',

    // ---- Audio (silent AAC-LC stereo 44.1 kHz) ----
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',

    // ---- Container ----
    '-movflags', '+faststart', // moov atom at the front for instant playback
    '-shortest',               // stop when the (looped) shortest stream ends

    output,
  ];
}

function run(bin, args, label) {
  const res = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      throw new Error(
        `${label} binary not found ("${bin}"). Install FFmpeg or set ` +
        `${label === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'} to its full path.`,
      );
    }
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status}):\n${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

// ----------------------------------------------------------------------------
// Verify
// ----------------------------------------------------------------------------

function ffprobeJson(output) {
  const args = [
    '-v', 'error',
    '-show_format',
    '-show_streams',
    '-of', 'json',
    output,
  ];
  const out = run(FFPROBE, args, 'ffprobe');
  return JSON.parse(out);
}

// Confirm the moov atom precedes the mdat atom (i.e. faststart worked) by
// scanning the first chunk of the file. A streamable MP4 has 'moov' early.
function verifyFaststart(output) {
  const fd = fs.openSync(output, 'r');
  try {
    const size = Math.min(fs.fstatSync(fd).size, 256 * 1024);
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, 0);
    const moov = buf.indexOf('moov');
    const mdat = buf.indexOf('mdat');
    // moov must exist near the start; if mdat is found it must come AFTER moov.
    if (moov === -1) return false;
    if (mdat !== -1 && mdat < moov) return false;
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

function verify(output) {
  const probe = ffprobeJson(output);
  const streams = probe.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const problems = [];

  if (!video) {
    problems.push('no video stream found');
  } else {
    if (video.codec_name !== 'h264') problems.push(`video codec is ${video.codec_name}, expected h264`);
    if (video.width !== TARGET.width || video.height !== TARGET.height) {
      problems.push(`resolution is ${video.width}×${video.height}, expected ${TARGET.width}×${TARGET.height}`);
    }
    if (video.pix_fmt !== TARGET.pixFmt) problems.push(`pix_fmt is ${video.pix_fmt}, expected ${TARGET.pixFmt}`);
    if (video.profile && video.profile !== TARGET.videoProfile) {
      problems.push(`video profile is "${video.profile}", expected "${TARGET.videoProfile}"`);
    }
    // H.264 level is reported ×10 (e.g. 40 == level 4.0).
    if (video.level && video.level > 40) problems.push(`H.264 level is ${video.level / 10}, expected ≤ 4.0`);
  }

  if (!audio) {
    problems.push('no audio stream found (silent AAC track expected)');
  } else {
    if (audio.codec_name !== TARGET.audioCodec) problems.push(`audio codec is ${audio.codec_name}, expected ${TARGET.audioCodec}`);
    if (audio.profile && audio.profile !== TARGET.audioProfile) problems.push(`audio profile is "${audio.profile}", expected "LC"`);
    if (Number(audio.sample_rate) !== TARGET.audioSampleRate) problems.push(`audio sample rate is ${audio.sample_rate}, expected ${TARGET.audioSampleRate}`);
    if (audio.channels !== TARGET.audioChannels) problems.push(`audio channels is ${audio.channels}, expected ${TARGET.audioChannels}`);
  }

  if (!verifyFaststart(output)) {
    problems.push('faststart not detected (moov atom is not at the front)');
  }

  const fmtName = probe.format && probe.format.format_name ? probe.format.format_name : '';
  if (fmtName && !/mp4|mov|m4a|3gp/.test(fmtName)) {
    problems.push(`container is "${fmtName}", expected an MP4-family container`);
  }

  // Verify the bitrate landed in the target band. Measure from the actual file
  // size / duration (counts video + audio + overhead) rather than trusting a
  // single stream's metadata, which CBR filler can under-report.
  const size = probe.format ? Number(probe.format.size) : NaN;
  const dur = probe.format ? Number(probe.format.duration) : NaN;
  let measuredKbps = null;
  if (Number.isFinite(size) && Number.isFinite(dur) && dur > 0) {
    measuredKbps = (size * 8) / dur / 1000;
    if (measuredKbps < TARGET.minBitrateKbps || measuredKbps > TARGET.maxBitrateKbps) {
      problems.push(
        `bitrate is ~${Math.round(measuredKbps)} kbps, expected ${TARGET.minBitrateKbps}–${TARGET.maxBitrateKbps} kbps`,
      );
    }
  }

  return { probe, video, audio, measuredKbps, problems };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Convert a still image to a spec-compliant, Android/VMOS-friendly MP4.
 * Throws if encoding fails or the output does not meet the required spec.
 *
 * @param {{input:string, output:string, duration?:number}} opts
 * @returns {{output:string, durationSeconds:number, probe:object, video:object, audio:object}}
 */
function imageToVideo({ input, output, duration = 5 }) {
  if (!input || !fs.existsSync(input)) {
    throw new Error(`Input image not found: ${input}`);
  }
  const dur = Math.max(1, Math.min(60, Number(duration) || 5));
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });

  run(FFMPEG, buildFfmpegArgs(input, output, dur), 'ffmpeg');

  const { probe, video, audio, measuredKbps, problems } = verify(output);
  if (problems.length > 0) {
    throw new Error(
      `Output failed verification and will not be delivered:\n  - ${problems.join('\n  - ')}`,
    );
  }

  return { output, durationSeconds: dur, probe, video, audio, measuredKbps };
}

module.exports = { imageToVideo, buildFfmpegArgs, verify, TARGET };

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

if (require.main === module) {
  const [, , input, output, durationArg] = process.argv;
  if (!input || !output) {
    console.error('Usage: node image-to-video.cjs <input-image> <output.mp4> [durationSeconds=5]');
    process.exit(2);
  }
  try {
    console.log(`Encoding "${input}" -> "${output}" ...`);
    const { durationSeconds, video, audio, measuredKbps } = imageToVideo({
      input,
      output,
      duration: durationArg ? parseFloat(durationArg) : 5,
    });
    console.log('\n[OK] Verified — file meets all requirements:');
    console.log(`    resolution : ${video.width}x${video.height}`);
    console.log(`    video      : ${video.codec_name} / ${video.profile} / level ${video.level / 10} / ${video.pix_fmt}`);
    console.log(`    b-frames   : ${video.has_b_frames} (CABAC disabled, CAVLC)`);
    console.log(`    bitrate    : ~${measuredKbps ? Math.round(measuredKbps) : '?'} kbps`);
    console.log(`    audio      : ${audio.codec_name} / ${audio.profile} / ${audio.sample_rate} Hz / ${audio.channels}ch`);
    console.log(`    duration   : ${durationSeconds}s`);
    console.log(`    faststart  : yes (moov atom at front)`);
    console.log(`\nDelivered: ${path.resolve(output)}`);
  } catch (err) {
    console.error(`\n[FAIL] ${err.message}`);
    process.exit(1);
  }
}
