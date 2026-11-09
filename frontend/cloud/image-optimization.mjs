// Browser-side optimization for private artwork uploads. Never modifies the user's source file.
export const IMAGE_POLICY = Object.freeze({maxInputBytes: 30*1024*1024, maxPixels: 60_000_000, maxEdge: 2048, jpegQuality: .84, webpQuality: .84});
export function planImage(width,height,policy=IMAGE_POLICY){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1) throw new Error('Invalid image dimensions');
  if(width*height>policy.maxPixels) throw new Error('Image is too large to process safely');
  const scale=Math.min(1,policy.maxEdge/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),resized:scale<1};
}
export function chooseOutputType(sourceType,hasTransparency){
  if(!['image/jpeg','image/png','image/webp'].includes(sourceType)) throw new Error('Unsupported image format');
  // Preserve transparent edges for round badge art and decorative assets.
  return hasTransparency?'image/png':'image/jpeg';
}
export function shouldKeepOriginal(originalBytes,convertedBytes){
  return convertedBytes >= originalBytes;
}
function canvasToBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode image')),type,quality));}
function hasAlpha(ctx,width,height){
  // Sample every pixel only after downscaling; alpha checks are skipped for JPEG.
  const data=ctx.getImageData(0,0,width,height).data;
  for(let i=3;i<data.length;i+=4) if(data[i]!==255) return true;
  return false;
}
export async function optimizeImage(file,options={}){
  const policy={...IMAGE_POLICY,...options};
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP image');
  if(file.size>policy.maxInputBytes) throw new Error('Image exceeds the 30 MB input limit');
  if(typeof createImageBitmap!=='function' || typeof document==='undefined') throw new Error('Image optimization requires a supported browser');
  let bitmap;
  try {
    bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    const dims=planImage(bitmap.width,bitmap.height,policy);
    const canvas=document.createElement('canvas');canvas.width=dims.width;canvas.height=dims.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) throw new Error('Image processing is unavailable');
    ctx.drawImage(bitmap,0,0,dims.width,dims.height);
    const alpha=file.type==='image/jpeg'?false:hasAlpha(ctx,dims.width,dims.height);
    const mime=chooseOutputType(file.type,alpha);
    const converted=await canvasToBlob(canvas,mime,policy.jpegQuality);
    // If no resize was needed and conversion grew the file, preserve the source.
    const useOriginal=!dims.resized && shouldKeepOriginal(file.size,converted.size);
    const blob=useOriginal?file:converted;
    return {blob,mime:useOriginal?file.type:mime,originalBytes:file.size,optimizedBytes:blob.size,width:dims.width,height:dims.height,optimized:!useOriginal};
  } finally {bitmap?.close?.();}
}
