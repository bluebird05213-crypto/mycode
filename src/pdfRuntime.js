import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

let runtimePromise;

export function getPdfRuntime(){
  if(!runtimePromise){
    runtimePromise=import('pdfjs-dist/legacy/build/pdf.mjs').then(runtime=>{
      runtime.GlobalWorkerOptions.workerSrc=import.meta.env.DEV?'/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs':workerUrl;
      return runtime;
    });
  }
  return runtimePromise;
}
