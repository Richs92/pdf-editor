// Convert the filled Word's paragraphs, runs, tables and attached images to a
// paginated, searchable PDF. The .docx itself retains the original Word layout.
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const children=(node,name)=>[...node.children].filter(n=>n.namespaceURI===W&&n.localName===name);
const child=(node,name)=>node&&children(node,name)[0];
const val=(node,name='val')=>node?.getAttributeNS(W,name);
function xml(text){return new DOMParser().parseFromString(text,'application/xml');}
function enabled(node){return node && !['0','false','off'].includes(val(node));}
function properties(node){
 const result={};if(!node)return result;
 const sz=val(child(node,'sz'));if(sz)result.fontSize=Number(sz)/2;
 for(const [word,pdf] of [['b','bold'],['i','italics']]){const setting=child(node,word);if(setting)result[pdf]=Boolean(enabled(setting));}
 const underline=child(node,'u');if(underline&&val(underline)!=='none')result.decoration='underline';
 const family=child(node,'rFonts');if(family){const name=val(family,'ascii')||val(family,'hAnsi')||'';result.font=/Arial|Calibri|Sans/i.test(name)?'ContractSans':'ContractSerif';}
 const color=val(child(node,'color'));if(color&&/^[0-9a-f]{6}$/i.test(color))result.color='#'+color;
 return result;
}
function fontURLs(family){const base=new URL('./fonts/Liberation'+family+'-',location.href).href;return{normal:base+'Regular.ttf',bold:base+'Bold.ttf',italics:base+'Italic.ttf',bolditalics:base+'BoldItalic.ttf'};}
export async function generateContractPDF(bytes){
 const zip=new window.PizZip(bytes),doc=xml(zip.file('word/document.xml').asText());
 const stylesDoc=xml(zip.file('word/styles.xml').asText());
 const styles=new Map([...stylesDoc.getElementsByTagNameNS(W,'style')].map(s=>[val(s,'styleId'),s]));
 function getStyle(id,seen=new Set()){
  if(!id||seen.has(id)||!styles.has(id))return{};seen.add(id);const style=styles.get(id);
  return{...getStyle(val(child(style,'basedOn')),seen),...properties(child(style,'rPr'))};
 }
 const defaults=properties(stylesDoc.getElementsByTagNameNS(W,'rPrDefault')[0]?.getElementsByTagNameNS(W,'rPr')[0]);
 const relationships=xml(zip.file('word/_rels/document.xml.rels').asText());
 const rels=new Map([...relationships.documentElement.children].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const body=doc.getElementsByTagNameNS(W,'body')[0];const sections=doc.getElementsByTagNameNS(W,'sectPr');const section=sections[sections.length-1];
 const pageSize=child(section,'pgSz'),pageMargin=child(section,'pgMar');
 const width=Number(val(pageSize,'w')||12240)/20,height=Number(val(pageSize,'h')||15840)/20;
 const margins=['left','top','right','bottom'].map(name=>Number(val(pageMargin,name)||1440)/20);
 const contentWidth=width-margins[0]-margins[2];
 let pendingBreak=false;
 function paragraph(p,inCell=false){
  const props=child(p,'pPr');const style=getStyle(val(child(props,'pStyle')));
  const runs=[];const images=[];let pageBreak=false;
  for(const run of p.getElementsByTagNameNS(W,'r')){
   const format={...style,...properties(child(run,'rPr'))};let text='';
   for(const item of run.children){
    if(item.localName==='t'&&item.namespaceURI===W)text+=item.textContent;
    if(item.localName==='tab'&&item.namespaceURI===W)text+='    ';
    if(item.localName==='br'&&item.namespaceURI===W){if(val(item,'type')==='page')pageBreak=true;else text+='\n';}
   }
   if(text)runs.push({text,...format});
   for(const blip of run.getElementsByTagNameNS(A,'blip')){
    const target=rels.get(blip.getAttributeNS(R,'embed'));if(!target)continue;
    const path=target.startsWith('/')?target.slice(1):'word/'+target.replace(/^\.\//,'');const image=zip.file(path);if(!image)continue;
    const ext=run.getElementsByTagNameNS(WP,'extent')[0];
    const iw=Number(ext?.getAttribute('cx')||5000000)/12700,ih=Number(ext?.getAttribute('cy')||3000000)/12700;
    const mime=/\.png$/i.test(path)?'image/png':'image/jpeg';
    images.push({alignment:val(child(props,'jc'))==='center'?'center':'left',image:`data:${mime};base64,${btoa(image.asBinary())}`,fit:[Math.min(iw,contentWidth),Math.min(ih,height-margins[1]-margins[3]-70)],margin:[0,8,0,10]});
   }
  }
  const result=[];
  if(runs.length){
   const align=val(child(props,'jc'))||'left';const spacing=child(props,'spacing');
   const before=Number(val(spacing,'before')||0)/20,after=Number(val(spacing,'after')??120)/20;
   const indent=child(props,'ind');const left=Number(val(indent,'left')||0)/20;
   const item={text:runs,alignment:align==='both'?'justify':['left','right','center','justify'].includes(align)?align:'left',margin:[Math.min(left,100),before,0,after],...style};
   if(!inCell&&(pendingBreak||pageBreak||enabled(child(props,'pageBreakBefore')))){item.pageBreak='before';pendingBreak=false;}
   result.push(item);
  }else if(pageBreak&&!inCell)pendingBreak=true;
  for(const image of images){if(pendingBreak&&!inCell){image.pageBreak='before';pendingBreak=false;}result.push(image);}
  return result;
 }
 function table(tableNode){
  const sourceRows=children(tableNode,'tr');
  const rows=sourceRows.map(tr=>{
   const row=[];
   for(const cell of children(tr,'tc')){
    const content=[];
    for(const node of cell.children){if(node.localName==='p')content.push(...paragraph(node,true));if(node.localName==='tbl')content.push(table(node));}
    const tcPr=child(cell,'tcPr');const fill=val(child(tcPr,'shd'),'fill');
    const span=Math.max(1,Number(val(child(tcPr,'gridSpan'))||1));
    row.push({stack:content.length?content:[{text:''}],...(span>1?{colSpan:span}:{}),...(fill&&/^[0-9a-f]{6}$/i.test(fill)?{fillColor:'#'+fill}:{})});
    for(let i=1;i<span;i++)row.push({text:''});
   }
   return row;
  });
  if(!rows.length)return{text:''};
  const columns=Math.max(...rows.map(row=>row.length));for(const row of rows)while(row.length<columns)row.push({text:''});
  const grid=child(tableNode,'tblGrid');let sizes=grid?children(grid,'gridCol').map(col=>Number(val(col,'w')||1)):[];
  if(sizes.length!==columns)sizes=Array(columns).fill(1);const total=sizes.reduce((a,b)=>a+b,0);
  const item={table:{headerRows:sourceRows.findIndex(tr=>!enabled(child(child(tr,'trPr'),'tblHeader'))) < 0 ? sourceRows.length : sourceRows.findIndex(tr=>!enabled(child(child(tr,'trPr'),'tblHeader'))),widths:sizes.map(n=>(contentWidth-columns*10)*n/total),body:rows,dontBreakRows:false},layout:{hLineWidth:()=>.5,vLineWidth:()=>.5,hLineColor:()=> '#9ca9af',vLineColor:()=> '#9ca9af',paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>4,paddingBottom:()=>4},margin:[0,4,0,8]};
  if(val(child(child(tableNode,'tblPr'),'tblCaption'))==='TerminavitINE'){item.layout={hLineWidth:()=>0,vLineWidth:()=>0,paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>4,paddingBottom:()=>4};item.table.widths=[contentWidth];item.table.dontBreakRows=true;}
  if(pendingBreak){item.pageBreak='before';pendingBreak=false;}return item;
 }
 const content=[];
 for(const node of body.children){if(node.namespaceURI!==W)continue;if(node.localName==='p')content.push(...paragraph(node));else if(node.localName==='tbl')content.push(table(node));}
 if(content[0]?.pageBreak)delete content[0].pageBreak;
 const definition={pageSize:{width,height},pageMargins:margins,defaultStyle:{font:'ContractSerif',fontSize:11,...defaults},content,footer:(page,total)=>({text:'Página '+page+' de '+total,alignment:'center',font:'ContractSans',fontSize:9,margin:[0,12,0,0]}),info:{title:'Documento TERMINAVIT',creator:'Documento · TERMINAVIT'}};
 const fonts={ContractSerif:fontURLs('Serif'),ContractSans:fontURLs('Sans')};
 return new Promise((resolve,reject)=>{
  try{window.pdfMake.createPdf(definition,undefined,fonts).getBlob(resolve);}catch(error){reject(error);}
 });
}
