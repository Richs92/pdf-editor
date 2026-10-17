import {prepareINEImage} from './ine-image.js';
import {extractINEFields} from './ine-fields.js';
// Images, recognized text and workers remain local. All engine assets are same-origin.
let queue=Promise.resolve();
export function recognizeINE(image,{signal,onProgress=()=>{},face='front'}={}) {
 const run=()=>read(image,{signal,onProgress,face});
 const job=queue.then(run,run);queue=job.catch(()=>{});return job;
}
async function read(image,{signal,onProgress,face}){
 if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
 const preparedImage=face==='back'?image:await prepareINEImage(image);
 if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
 const {default:Tesseract}=await import('/vendor/ocr/tesseract.esm.min.js');
 let worker,timer,rejectAbort;let cancelled=false;
 const interrupted=new Promise((_,reject)=>{rejectAbort=reject;});
 const abort=()=>{cancelled=true;rejectAbort(new DOMException('Lectura cancelada','AbortError'));};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const initialization=Tesseract.createWorker('spa',1,{
   workerPath:new URL('/vendor/ocr/worker.min.js',location.origin).href,
   corePath:new URL('/vendor/ocr/tesseract-core-lstm.wasm.js',location.origin).href,
   langPath:new URL('/vendor/ocr/',location.origin).href,
   workerBlobURL:false,cacheMethod:'none',gzip:true,
   errorHandler:()=>rejectAbort(new Error('No se pudo cargar el lector de INE. Puedes seguir llenando el formulario manualmente.')),
   logger:message=>onProgress(message.status==='recognizing text'?'Leyendo INE: '+Math.round(message.progress*100)+'%':'Cargando lector de INE…'),
  }).then(created=>{if(cancelled){created.terminate();throw new DOMException('Lectura cancelada','AbortError');}worker=created;return created;});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La lectura tardó demasiado. Prueba una foto más nítida.')),90000);});
  await Promise.race([initialization,timeout,interrupted]);
  if(cancelled||signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  let result=await Promise.race([worker.recognize(preparedImage,{rotateAuto:face!=='back'},{text:true}),timeout,interrupted]);
  const quality=data=>Object.values(extractINEFields(data.text,{face})).filter(Boolean).length*40+data.confidence;
  if(result.data.confidence<70||!Object.values(extractINEFields(result.data.text,{face})).some(Boolean)){
   await worker.setParameters({tessedit_pageseg_mode:'6'});
   const alternative=await Promise.race([worker.recognize(preparedImage,{rotateAuto:face!=='back'},{text:true}),timeout,interrupted]);
   if(quality(alternative.data)>quality(result.data))result=alternative;
  }
  if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
  return {text:result.data.text,confidence:result.data.confidence};
 }finally{cancelled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker)await worker.terminate();}
}
