import { loadPhoto, removeEmployeeBackground, drawEmployeePhoto } from './employee-photo';
import { createEmployeeSignature } from './employee-signature';

(window as any).renderEmployeeAssets = async (input: any) => {
  let photo = await loadPhoto(`data:${input.mime};base64,${input.photo}`);
  if (input.photoSettings.remove_background) photo = await removeEmployeeBackground(photo);
  const photoCanvas = drawEmployeePhoto(photo, input.photoSettings);
  const signature = await createEmployeeSignature(input.signatureText, input.signature);
  return { photo: photoCanvas.toDataURL('image/png').split(',')[1], signature: signature.dataUrl.split(',')[1] };
};
