import React,{useRef,useState}from'react';
import{AlertCircle,CheckCircle2,FileArchive,FileText,Image,LoaderCircle,Pencil,Trash2,UploadCloud,X}from'lucide-react';
import{getPdfRuntime}from'./pdfRuntime.js';
import{extractPdf,parsePages}from'./pdfParser.js';
import{generateAutoAnalysis}from'./analysis.js';
import{deletePdf,savePdf}from'./pdfStore.js';
import'./library.css';
import'./diagnostics.css';

export const SOURCES=['北森','智鼎','牛客'];
export const CATEGORY_NAMES={verbal:'文字推理',number:'数字推理',figure:'图形推理',material:'材料分析',personality:'性格解读',unknown:'待确认'};
const hints=[
 ['figure',/(图形推理|图形规律|九宫格|折纸|展开图|旋转|平移|叠加|对称轴|封闭空间)/i],
 ['material',/(材料分析|资料分析|根据下列资料|统计图|表格|增长率|同比|环比|占比|比重)/i],
 ['number',/(数字推理|数量关系|数列|问号处应填|下一个数字|计算结果)/i],
 ['personality',/(性格|心理测评|最符合|比较符合|非常同意|行为倾向|工作情境)/i],
 ['verbal',/(文字推理|言语理解|逻辑判断|定义判断|阅读理解|以下哪项|根据上述)/i]
];

export function detectCategory(text,current='unknown'){
 const normalized=text.replace(/\s+/g,' ');
 for(const[id,re]of hints){const match=normalized.match(re);if(match)return{id,confidence:/推理|分析|性格/.test(match[0]) ? .92 : .78,reason:`识别到“${match[0]}”提示`}}
 if(/[①②③④]|[A-D][.、．]/.test(normalized)&&/\d/.test(normalized))return{id:current==='unknown'?'verbal':current,confidence:.58,reason:'根据题目结构延续当前章节'};
 return{id:current,confidence:current==='unknown'?.35:.62,reason:current==='unknown'?'未找到明确题型提示':'沿用最近的章节分类'};
}

function splitQuestions(text,source,fileName){
 const clean=text.replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
 const parts=clean.split(/(?=\n\s*(?:第?\s*\d{1,3}\s*[题\.、．]|\d{1,3}[\.、．]\s*))/).filter(x=>x.trim().length>18);
 let current='unknown';
 return parts.map((raw,i)=>{
   const found=detectCategory(raw,current);if(found.confidence>=.75)current=found.id;
   const options=[...raw.matchAll(/(?:^|\n)\s*([A-D])[.、．\s]+([^\n]+)/gm)].map(m=>m[2].trim());
   const answerMatch=raw.match(/(?:答案|正确答案)\s*[:：]?\s*([A-D])/i);
   const answer=answerMatch?answerMatch[1].charCodeAt(0)-65:null;
   const stem=raw.replace(/(?:^|\n)\s*[A-D][.、．\s]+[^\n]+/gm,'').replace(/(?:答案|正确答案|解析)\s*[:：][\s\S]*/i,'').trim().slice(0,800),displayOptions=options.length>=2?options:['待补充选项 A','待补充选项 B'],analysis=generateAutoAnalysis({category:found.id,stem:stem||`来自 ${fileName} 的第 ${i+1} 题`,options:displayOptions,answer}),originalExplain=(raw.match(/解析\s*[:：]\s*([\s\S]+)/i)?.[1]||'').slice(0,1000);
   return{id:`upload-${Date.now()}-${i}`,source,category:found.id,type:'导入题',stem:stem||`来自 ${fileName} 的第 ${i+1} 题`,options:displayOptions,answer,analysis,explain:originalExplain?`${originalExplain} 补充方法：${analysis.method}`:analysis.summary,tip:analysis.tip,confidence:found.confidence,reason:found.reason,fileName,needsReview:found.confidence<.7||answer===null||options.length<2};
 });
}

async function readFile(file){
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='txt'||ext==='md')return await file.text();
 if(ext==='json'){const data=JSON.parse(await file.text());return{json:Array.isArray(data)?data:data.questions||[]}}
 if(ext==='pdf'){const{getDocument}=await getPdfRuntime(),doc=await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;return{pdfPages:await extractPdf(doc),blob:file}}
 throw new Error('MVP 暂时支持 PDF、TXT、Markdown 和 JSON；图片 OCR 将在下一阶段加入。');
}

export function LibraryPage({library,setLibrary}){
 const input=useRef(null);const[source,setSource]=useState('北森'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(null);
 async function pick(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const result=await readFile(file);let qs,diagnostics=null;if(result?.json){qs=result.json.map((q,i)=>{const found=detectCategory(`${q.category||''} ${q.stem||q.question||''}`),category=q.category&&CATEGORY_NAMES[q.category]?q.category:found.id,stem=q.stem||q.question||`第 ${i+1} 题`,options=q.options||[],answer=Number.isInteger(q.answer)?q.answer:null,analysis=q.analysis||generateAutoAnalysis({category,stem,options,answer});return{...q,id:q.id||`upload-${Date.now()}-${i}`,source,category,stem,options,answer,analysis,explain:q.explain||q.explanation||analysis.summary,tip:q.tip||analysis.tip,confidence:.9,reason:'来自结构化 JSON',fileName:file.name,needsReview:!Number.isInteger(q.answer)}})}else if(result?.pdfPages){const parsed=parsePages(result.pdfPages,source,file.name);qs=parsed.questions;diagnostics=parsed.diagnostics}else qs=splitQuestions(result,source,file.name);if(!qs.length)throw new Error('没有识别到完整题目。请确认文件包含题号和选项，或改用 JSON 格式。');setPreview({file:{id:`file-${Date.now()}`,name:file.name,source,size:file.size,createdAt:new Date().toISOString()},questions:qs,diagnostics,blob:result?.blob})}catch(err){setError(err.message)}finally{setBusy(false);e.target.value=''}}
 const updateCat=(id,category)=>setPreview(p=>({...p,questions:p.questions.map(q=>q.id===id?{...q,category,confidence:1,reason:'由你手动确认',needsReview:q.answer===null}:q)}));
 const confirm=async()=>{if(preview.diagnostics?.blocked)return;if(preview.blob)await savePdf(preview.file.id,preview.blob);setLibrary(old=>({schemaVersion:5,files:[preview.file,...old.files],questions:[...preview.questions.map(q=>({...q,fileId:preview.file.id})),...old.questions]}));setPreview(null)};
 const remove=async id=>{await deletePdf(id);setLibrary(old=>({...old,files:old.files.filter(f=>f.id!==id),questions:old.questions.filter(q=>q.fileId!==id)}))};
 return <div className="content library"><div className="library-hero card"><div><span className="pill">本地题库</span><h2>上传文件，自动拆题与分类</h2><p>文件只在当前浏览器处理。你选择题库来源，系统根据章节标题和题目特征判断题型。</p></div><FileArchive/></div><div className="upload-card card"><div className="source-pick"><b>1. 选择题库标签</b><div>{SOURCES.map(s=><button className={source===s?'selected':''} onClick={()=>setSource(s)} key={s}>{s}</button>)}</div></div><div className="upload-zone" onClick={()=>!busy&&input.current?.click()}><input ref={input} type="file" accept=".pdf,.txt,.md,.json" onChange={pick}/>{busy?<LoaderCircle className="spin"/>:<UploadCloud/>}<b>{busy?'正在本地解析…':'2. 选择 PDF 或其他题目文件'}</b><span>支持 PDF、TXT、Markdown、JSON · 当前标签：{source}</span></div>{error&&<div className="import-error"><AlertCircle/>{error}</div>}</div>{preview&&<ImportPreview data={preview} updateCat={updateCat} close={()=>setPreview(null)} confirm={confirm}/>}<div className="section-title"><h2>已导入文件</h2><span>{library.files.length} 份文件 · {library.questions.length} 道题</span></div>{library.files.length?<div className="file-list">{library.files.map(f=>{const qs=library.questions.filter(q=>q.fileName===f.name);return <div className="file-row card" key={f.id}><FileText/><div><b>{f.name}</b><span>{f.source}题库 · {qs.length} 道题 · {new Date(f.createdAt).toLocaleDateString()}</span></div><button title="删除文件" onClick={()=>remove(f.id)}><Trash2/></button></div>})}</div>:<div className="empty-library"><FileArchive/><b>还没有导入文件</b><span>先上传一份带题号与选项的文字型 PDF 试试。</span></div>}</div>
}

function ImportPreview({data,updateCat,close,confirm}){const review=data.questions.filter(q=>q.needsReview).length,d=data.diagnostics;return <div className="preview-modal"><div className="preview-panel card"><header><div><span className="pill">导入前确认</span><h2>{data.file.name}</h2><p>识别 {data.questions.length} 道题，其中 {review} 道需要重点核对。{d&&` ${d.pages} 页 · ${d.answerAnchors} 个答案锚点 · 覆盖率 ${Math.round(d.coverage*100)}%`}</p></div><button onClick={close}><X/></button></header>{d?.warnings?.length>0&&<div className="diagnostic-warning"><AlertCircle/><div>{d.warnings.map(x=><p key={x}>{x}</p>)}{d.blocked&&<b>识别结果已被保护机制拦截，不能直接导入。</b>}</div></div>}<div className="summary-row">{Object.entries(CATEGORY_NAMES).map(([id,name])=>{const n=data.questions.filter(q=>q.category===id).length;return n?<span key={id}>{name}<b>{n}</b></span>:null})}</div><div className="preview-list">{data.questions.map((q,i)=><div className={q.needsReview?'needs-review':''} key={q.id}><span className="qno">{i+1}</span><section><p>{q.stem.slice(0,120)}</p><small>第 {q.pageNumber||'-'} 页 · {q.reason} · 置信度 {Math.round(q.confidence*100)}% {q.answer===null?'· 未识别答案':''}</small></section><select value={q.category} onChange={e=>updateCat(q.id,e.target.value)}>{Object.entries(CATEGORY_NAMES).map(([id,n])=><option value={id} key={id}>{n}</option>)}</select></div>)}</div><footer><span><AlertCircle/>图形与材料题会保留原 PDF 页作为视觉上下文。</span><button className="primary" disabled={d?.blocked} onClick={confirm}><CheckCircle2/>{d?.blocked?'已阻止导入':'确认导入'}</button></footer></div></div>}
