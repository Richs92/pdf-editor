// Native sharing passes the file to the phone, never to a document hosting service.
export function supportsPDFSharing(nav=navigator){
 try{return typeof nav.share==='function'&&typeof nav.canShare==='function'&&nav.canShare({files:[new File(['%PDF-1.4\n%%EOF\n'],'documento.pdf',{type:'application/pdf'})]});}catch{return false;}
}
export function sharePDF(file,nav=navigator){
 if(!supportsPDFSharing(nav)||!nav.canShare({files:[file]}))throw Error('Este navegador no permite compartir archivos. Descarga el PDF y adjúntalo en WhatsApp.');
 // Keep this synchronous: Safari requires share() directly in the click gesture.
 return nav.share({files:[file],title:'Documento TERMINAVIT'});
}
