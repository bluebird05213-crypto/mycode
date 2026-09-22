import{getPdfRuntime}from'./pdfRuntime.js';
import{extractPdf,parsePages}from'./pdfParser.js';
import{loadPdfBytes}from'./pdfStore.js';

export async function repairLibraryAnswerSafe(library){
 const pending=(library.questions||[]).some(q=>q.fileId&&!q.answerSafeVersion);
 if(!pending)return null;
 const questions=[...(library.questions||[])];let changed=false;
 for(const file of library.files||[]){
 const indexes=questions.map((q,i)=>q.fileId===file.id?i:-1).filter(i=>i>=0);
  if(!/\.pdf$/i.test(file.name)||!indexes.length||indexes.every(i=>questions[i].answerSafeVersion))continue;
  try{
   const bytes=await loadPdfBytes(file.id);if(!bytes)continue;
   const{getDocument}=await getPdfRuntime();const pdf=await getDocument({data:new Uint8Array(bytes)}).promise;
   const parsed=parsePages(await extractPdf(pdf),file.source,file.name).questions;await pdf.destroy?.();
   if(parsed.length!==indexes.length)continue;
   indexes.forEach((target,i)=>{const safe=parsed[i],old=questions[target];questions[target]={...old,backupParts:safe.backupParts,visualParts:safe.visualParts,cropTop:safe.cropTop,cropBottom:safe.cropBottom,sourcePages:safe.sourcePages,visualCropVersion:safe.visualCropVersion,answerSafeVersion:safe.answerSafeVersion,analysis:old.analysis||safe.analysis,explain:old.explain||safe.explain,tip:old.tip||safe.tip};});
   changed=true;
  }catch(error){console.warn('题目原图安全裁切迁移失败',file.name,error)}
 }
 return changed?{...library,schemaVersion:5,questions}:null;
}
