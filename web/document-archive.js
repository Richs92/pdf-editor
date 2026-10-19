// Copies are private; only the administrator can retrieve them from the API.
export async function archivePDF(blob,module,{documentId,format='pdf'}={}){
 if(blob.size>3*1024*1024)throw Error('El PDF supera 3 MB. Reduce el tamaño de las fotos antes de descargar.');
 const query=new URLSearchParams({module,format});if(documentId)query.set('documentId',documentId);
 const response=await fetch('/.netlify/functions/api/documents/archive?'+query,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/pdf'},body:blob,signal:AbortSignal.timeout(45000)});
 let data;try{data=await response.json();}catch{throw Error('No se pudo guardar la copia privada. Intenta descargar de nuevo.');}
 if(!response.ok)throw Error(data.error||'No se pudo guardar la copia privada.');return data;
}
