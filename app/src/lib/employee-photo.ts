import { EXPORT_W, EXPORT_H } from './image-export-sizes';

export async function loadPhoto(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(Error('Photo could not be decoded.')); image.src = source; });
  if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000) throw Error('Photo exceeds the 40 megapixel limit.');
  return image;
}

/** Same model as the photo editor, local assets, CPU delegate, soft person mask.
 * Mask dimensions are independent of the input image; scale before compositing.
 */
export async function removeEmployeeBackground(image: HTMLImageElement): Promise<HTMLImageElement> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/id-generator-assets/wasm');
  const segmenter = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/id-generator-assets/selfie_segmenter.tflite', delegate: 'CPU' },
    runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
  });
  let result: ReturnType<typeof segmenter.segment> | undefined;
  try {
    result = segmenter.segment(image);
    const mask = result.confidenceMasks?.[0];
    if (!mask) throw Error('Person segmentation returned no confidence mask.');
    const data = mask.getAsFloat32Array();
    if (!data.some(value => value > 0.1)) throw Error('No person was found in the photo. Use a clear employee portrait or turn off background removal.');
    const small = document.createElement('canvas'); small.width = mask.width; small.height = mask.height;
    const mctx = small.getContext('2d')!; const pixels = mctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < data.length; i++) { pixels.data[i*4] = pixels.data[i*4+1] = pixels.data[i*4+2] = 255; pixels.data[i*4+3] = Math.round(Math.max(0,Math.min(1,(data[i] - 0.1) / 0.8))*255); }
    mctx.putImageData(pixels,0,0);
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image,0,0); ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small,0,0,canvas.width,canvas.height);
    return await loadPhoto(canvas.toDataURL('image/png'));
  } finally { result?.close(); segmenter.close(); }
}

/** Cover fit, normalized placement, high quality transparent PNG, matching the employee editor. */
export function drawEmployeePhoto(image: HTMLImageElement, opts: { zoom: number; x: number; y: number }) {
  const canvas = document.createElement('canvas'); canvas.width = EXPORT_W; canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(EXPORT_W/image.naturalWidth, EXPORT_H/image.naturalHeight)*opts.zoom;
  const w = image.naturalWidth*scale, h = image.naturalHeight*scale;
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, -(w-EXPORT_W)*opts.x, -(h-EXPORT_H)*opts.y,w,h);
  const pixels = ctx.getImageData(0,0,EXPORT_W,EXPORT_H).data;
  let visible = false;
  for (let i=3;i<pixels.length;i+=4) if(pixels[i]>0){visible=true;break;}
  if(!visible)throw Error('Photo crop is empty. Use a clear employee portrait or turn off background removal.');
  return canvas;
}
