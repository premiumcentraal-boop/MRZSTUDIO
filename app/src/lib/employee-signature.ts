import { SIGNATURE_FONTS } from './signature-options';
import { ensureBundledFontsLoaded, waitForFontReady } from './signature-fonts';
import { sizeSignatureCanvas, drawSignature, canvasToSignaturePng } from './signature-raster';
export async function createEmployeeSignature(text:string,settings:{font:string;scale:number;x:number;y:number}){
  const font=SIGNATURE_FONTS.slice(0,9).find(f=>f.id===settings.font);if(!font)throw Error('Choose a bundled signature font.');
  const family=font.family.split(',')[0].replace(/['"]/g,'').trim();
  await ensureBundledFontsLoaded();await waitForFontReady(family,font.size);
  if(!document.fonts.check(`${font.size}px "${family}"`))throw Error('Signature font failed to load.');
  const canvas=document.createElement('canvas');sizeSignatureCanvas(canvas);
  drawSignature(canvas.getContext('2d')!,{text,fontFamily:font.family,fontBaseSize:font.size,scale:settings.scale,offsetX:settings.x,offsetY:settings.y});
  return canvasToSignaturePng(canvas,text);
}
