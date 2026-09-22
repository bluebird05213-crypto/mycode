import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{BookOpen,Clipboard,FileArchive,MessageCircle,Send,X}from'lucide-react';
import'./study-assistant.css';

const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const blobToDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});

function currentContext(){
 const card=document.querySelector('.question-card');
 if(!card)return null;
 const stem=card.querySelector('h2')?.textContent?.trim()||'';
 const category=card.querySelector('.pill')?.textContent?.trim()||'';
 const options=[...card.querySelectorAll('.options .option')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
 const feedback=[...card.querySelectorAll('.feedback p,.figure-analysis p')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
 const imageSources=[...card.querySelectorAll('.original-page img.zoomable')].map(x=>x.src).filter(Boolean).slice(0,6);
 return{category,stem,options,feedback,imageSources};
}

async function loadContextImages(context){return Promise.all((context?.imageSources||[]).map(async src=>{try{return await blobToDataUrl(await fetch(src).then(response=>response.blob()))}catch{return null}})).then(items=>items.filter(Boolean))}

function replyFor(prompt,context){
 const text=prompt.replace(/\s+/g,'');
 if(!context)return'请先进入一道具体题目，我才能把当前题干和选项带入分析。';
 if(/技巧|快速|怎么做|方法/.test(text))return context.feedback.find(x=>/技巧|形成条件反射/.test(x))||'先判断题型，再定位题干条件，最后逐项验证选项。你也可以问我“为什么选这个”或“错在哪里”。';
 if(/答案|选项|为什么选|为什么是/.test(text))return context.feedback.find(x=>/解析|答案|正确/.test(x))||'请先选择一个选项，提交后我会根据页面中的解析继续说明。';
 if(/总结|复盘|错在哪|错误/.test(text))return context.feedback.join('；')||'目前还没有作答记录。先完成选择，我再帮你按题干、方法和选项三层复盘。';
 return`当前是「${context.category}」：${context.stem}。你可以继续追问“为什么选这个”“这题有什么技巧”或“帮我复盘错因”。如果需要结合原图/原材料深挖，请点击“复制到 Codex”。`;
}

async function askDeepSeek(prompt,context,model){
 const images=await loadContextImages(context);const response=await fetch('http://127.0.0.1:3001/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,context,images,model})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.message||'AI 服务暂时不可用');
 return data.answer;
}

function StudyAssistant(){
 const[open,setOpen]=useState(false),[input,setInput]=useState(''),[model,setModel]=useState(()=>localStorage.getItem('beisen-assistant-model-v1')||'deepseek-chat'),[models,setModels]=useState(['local-rules','deepseek-chat','deepseek-reasoner']),[messages,setMessages]=useState([{role:'assistant',text:'我是本机学习助手。可以先问“为什么选这个”或“这题有什么技巧”。'}]);
 const defaultSize={width:420,height:560};
 const[size,setSize]=useState(()=>{try{return JSON.parse(localStorage.getItem('beisen-assistant-size-v1'))||defaultSize}catch{return defaultSize}}),dragging=useRef(false);
 useEffect(()=>localStorage.setItem('beisen-assistant-size-v1',JSON.stringify(size)),[size]);
 useEffect(()=>localStorage.setItem('beisen-assistant-model-v1',model),[model]);
 useEffect(()=>{if(!open)return;fetch('http://127.0.0.1:3001/api/models').then(response=>response.ok?response.json():null).then(data=>{if(Array.isArray(data?.models)&&data.models.length){setModels(['local-rules',...data.models.filter(item=>item!=='local-rules')]);if(model!=='local-rules'&&!data.models.includes(model))setModel(data.models[0])}}).catch(()=>{})},[open]);
 const onResizeStart=e=>{e.preventDefault();const start={x:e.clientX,y:e.clientY,width:size.width,height:size.height},maxWidth=Math.min(960,window.innerWidth-24),maxHeight=Math.min(860,window.innerHeight-44);const move=event=>setSize({width:Math.min(maxWidth,Math.max(340,start.width+start.x-event.clientX)),height:Math.min(maxHeight,Math.max(420,start.height+start.y-event.clientY))});const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);dragging.current=false};dragging.current=true;window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)};
 const scale=Math.min(1.55,Math.max(1,Math.sqrt((size.width*size.height)/(420*560))));
 const ask=async text=>{const clean=text.trim();if(!clean)return;const context=currentContext();const localMode=model==='local-rules';setMessages(old=>[...old,{role:'user',text:clean},{role:'assistant',text:localMode?'正在使用本地模式分析…':`正在使用 ${model} 分析…`,pending:true}]);setInput('');try{const answer=localMode?replyFor(clean,context):await askDeepSeek(clean,context,model);setMessages(old=>{const next=[...old];next[next.length-1]={role:'assistant',text:answer};return next})}catch(error){setMessages(old=>{const next=[...old];next[next.length-1]={role:'assistant',text:`DeepSeek 暂时不可用：${error.message}\n\n已切换本地提示：${replyFor(clean,context)}`};return next})}};
 const disableDeepSeek=()=>{setModel('local-rules');setMessages(old=>[...old,{role:'assistant',text:'已关闭 DeepSeek。现在只使用本地题目解析和答题技巧，不会调用 API。'}])};
 const send=()=>ask(input);
 const copy=async()=>{const c=currentContext();if(!c)return;const feedback=c.feedback.length?`\n页面已显示的解析/反馈：\n${c.feedback.join('\n')}`:'\n当前尚未显示作答反馈，请先独立作答后再复盘。';const text=`请帮我分析当前题目。题型：${c.category}\n题干：${c.stem}\n选项：${c.options.join('；')}${feedback}\n当前题目包含 ${c.imageSources.length} 张图形图片，请结合图片分析。\n请重点说明正确答案、解题步骤、易错点和答题技巧。`;try{await navigator.clipboard.writeText(text);setMessages(old=>[...old,{role:'assistant',text:`文字上下文已复制，检测到 ${c.imageSources.length} 张题图。若要把图片一起带给 Codex，请点击“导出题目包”。`}])}catch{setMessages(old=>[...old,{role:'assistant',text:'浏览器没有开放复制权限，请手动选中题干后粘贴到 Codex。'}])}};
 const copyPackage=async()=>{const c=currentContext();if(!c)return;const images=await loadContextImages(c);const feedback=c.feedback.length?c.feedback.join('\n\n'):'暂无页面解析';const text=`请帮我分析当前题目。\n题型：${c.category}\n题干：${c.stem}\n选项：${c.options.join('；')}\n解析/反馈：${feedback}\n当前题图数量：${images.length}\n请结合随消息附带的图片，说明正确答案、解题步骤、易错点和答题技巧。`;const html=`<article><h2>${escapeHtml(c.category)}题目</h2><p>${escapeHtml(c.stem)}</p><ol>${c.options.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol><p>${escapeHtml(feedback).replace(/\n/g,'<br>')}</p>${images.map(src=>`<img src="${src}" style="max-width:100%">`).join('')}</article>`;try{if(navigator.clipboard?.write&&window.ClipboardItem&&images.length){await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);setMessages(old=>[...old,{role:'assistant',text:`完整题目包已复制，可直接在 Codex 聊天框按 Ctrl+V 粘贴（包含 ${images.length} 张题图）。`}])}else{await navigator.clipboard.writeText(text);setMessages(old=>[...old,{role:'assistant',text:'已复制完整文字上下文。当前浏览器不允许直接复制图片，请使用“导出题目包”后拖入 Codex。'}])}}catch{setMessages(old=>[...old,{role:'assistant',text:'复制权限被浏览器拦截，请先点击页面后重试；也可以使用“导出题目包”。'}])}};
 const exportPackage=async()=>{const c=currentContext();if(!c)return;const images=await loadContextImages(c);const feedback=c.feedback.length?c.feedback.join('\n\n'):'暂无页面解析';const html=`<!doctype html><meta charset="utf-8"><title>题目资料包 - ${escapeHtml(c.category)}</title><style>body{font:16px/1.8 system-ui;max-width:900px;margin:32px auto;padding:0 20px;color:#253858}img{display:block;max-width:100%;margin:18px 0;border:1px solid #ddd}</style><h1>${escapeHtml(c.category)} 题目资料包</h1><h2>${escapeHtml(c.stem)}</h2><h3>选项</h3><ol>${c.options.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol><h3>解析/反馈</h3><p>${escapeHtml(feedback).replace(/\n/g,'<br>')}</p><h3>题目图片</h3>${images.map((src,i)=>`<figure><figcaption>图形区域 ${i+1}</figcaption><img src="${src}" alt="题目图形区域 ${i+1}"></figure>`).join('')||'<p>当前没有可导出的题图。</p>'}`;const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`题目资料包-${c.category||'当前题目'}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessages(old=>[...old,{role:'assistant',text:`已导出题目资料包，包含题干、选项、解析和 ${images.length} 张题图。可以把这个 HTML 文件上传到 Codex。`}])};
 return open?<aside className="study-assistant-panel" style={{width:size.width,height:size.height,'--assistant-scale':scale}}><div className="assistant-resize-handle" role="button" tabIndex="0" aria-label="拖动左上角调整助手大小" onPointerDown={onResizeStart} title="拖动左上角调整大小"/><header><div><b><BookOpen/>题目助手</b><small>{model==='local-rules'?'本地模式，不调用 DeepSeek API':'本机代理 DeepSeek'} · 拖动左上角调整大小</small></div><button onClick={()=>setOpen(false)} aria-label="关闭题目助手"><X/></button></header><div className="assistant-model"><label htmlFor="assistant-model-select">模型</label><select id="assistant-model-select" value={model} onChange={e=>setModel(e.target.value)}><option value="local-rules">本地模式（不调用 DeepSeek）</option>{models.filter(item=>item!=='local-rules').map(item=><option value={item} key={item}>{item}</option>)}</select><button type="button" onClick={disableDeepSeek} title="立即关闭 DeepSeek，切换到本地模式">关闭 DeepSeek</button></div><div className="assistant-messages">{messages.map((m,i)=><div className={`assistant-message ${m.role}`} key={`${m.role}-${i}`}>{m.text}</div>)}</div><div className="assistant-actions"><button onClick={()=>ask('为什么选这个？')}>为什么选这个</button><button onClick={()=>ask('这题有什么技巧？')}>答题技巧</button><button onClick={copy}><Clipboard/>复制文字</button><button onClick={copyPackage}><Clipboard/>复制完整题目包</button><button onClick={exportPackage}><FileArchive/>导出题目包</button></div><div className="assistant-compose"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="继续追问当前题…"/><button onClick={send} aria-label="发送问题"><Send/></button></div></aside>:<button className="study-assistant-launcher" onClick={()=>setOpen(true)}><MessageCircle/>题目助手</button>;
}

export function mountStudyAssistant(){if(document.getElementById('study-assistant-root'))return;const host=document.createElement('div');host.id='study-assistant-root';document.body.appendChild(host);createRoot(host).render(<StudyAssistant/>)}
