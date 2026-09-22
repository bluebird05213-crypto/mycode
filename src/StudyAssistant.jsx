import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{BookOpen,Clipboard,MessageCircle,Send,X}from'lucide-react';
import'./study-assistant.css';

function currentContext(){
 const card=document.querySelector('.question-card');
 if(!card)return null;
 const stem=card.querySelector('h2')?.textContent?.trim()||'';
 const category=card.querySelector('.pill')?.textContent?.trim()||'';
 const options=[...card.querySelectorAll('.options .option')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
 const feedback=[...card.querySelectorAll('.feedback p,.figure-analysis p')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
 return{category,stem,options,feedback};
}

function replyFor(prompt,context){
 const text=prompt.replace(/\s+/g,'');
 if(!context)return'请先进入一道具体题目，我才能把当前题干和选项带入分析。';
 if(/技巧|快速|怎么做|方法/.test(text))return context.feedback.find(x=>/技巧|形成条件反射/.test(x))||'先判断题型，再定位题干条件，最后逐项验证选项。你也可以问我“为什么选这个”或“错在哪里”。';
 if(/答案|选项|为什么选|为什么是/.test(text))return context.feedback.find(x=>/解析|答案|正确/.test(x))||'请先选择一个选项，提交后我会根据页面中的解析继续说明。';
 if(/总结|复盘|错在哪|错误/.test(text))return context.feedback.join('；')||'目前还没有作答记录。先完成选择，我再帮你按题干、方法和选项三层复盘。';
 return`当前是「${context.category}」：${context.stem}。你可以继续追问“为什么选这个”“这题有什么技巧”或“帮我复盘错因”。如果需要结合原图/原材料深挖，请点击“复制到 Codex”。`;
}

function StudyAssistant(){
 const[open,setOpen]=useState(false),[input,setInput]=useState(''),[messages,setMessages]=useState([{role:'assistant',text:'我是本机学习助手。可以先问“为什么选这个”或“这题有什么技巧”。'}]);
 const defaultSize={width:420,height:560};
 const[size,setSize]=useState(()=>{try{return JSON.parse(localStorage.getItem('beisen-assistant-size-v1'))||defaultSize}catch{return defaultSize}}),dragging=useRef(false);
 useEffect(()=>localStorage.setItem('beisen-assistant-size-v1',JSON.stringify(size)),[size]);
 const onResizeStart=e=>{e.preventDefault();const start={x:e.clientX,y:e.clientY,width:size.width,height:size.height},maxWidth=Math.min(960,window.innerWidth-24),maxHeight=Math.min(860,window.innerHeight-44);const move=event=>setSize({width:Math.min(maxWidth,Math.max(340,start.width+start.x-event.clientX)),height:Math.min(maxHeight,Math.max(420,start.height+start.y-event.clientY))});const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);dragging.current=false};dragging.current=true;window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)};
 const scale=Math.min(1.55,Math.max(1,Math.sqrt((size.width*size.height)/(420*560))));
 const ask=text=>{const clean=text.trim();if(!clean)return;const context=currentContext();setMessages(old=>[...old,{role:'user',text:clean},{role:'assistant',text:replyFor(clean,context)}]);setInput('')};
 const send=()=>ask(input);
 const copy=async()=>{const c=currentContext();if(!c)return;const feedback=c.feedback.length?`\n页面已显示的解析/反馈：\n${c.feedback.join('\n')}`:'\n当前尚未显示作答反馈，请先独立作答后再复盘。';const text=`请帮我分析当前题目。题型：${c.category}\n题干：${c.stem}\n选项：${c.options.join('；')}${feedback}\n请重点说明正确答案、解题步骤、易错点和答题技巧。`;try{await navigator.clipboard.writeText(text);setMessages(old=>[...old,{role:'assistant',text:'当前题目、选项和页面解析已复制。回到 Codex 对话粘贴后，可以继续让我做更深入的分析。'}])}catch{setMessages(old=>[...old,{role:'assistant',text:'浏览器没有开放复制权限，请手动选中题干后粘贴到 Codex。'}])}};
 return open?<aside className="study-assistant-panel" style={{width:size.width,height:size.height,'--assistant-scale':scale}}><div className="assistant-resize-handle" role="button" tabIndex="0" aria-label="拖动左上角调整助手大小" onPointerDown={onResizeStart} title="拖动左上角调整大小"/><header><div><b><BookOpen/>题目助手</b><small>本机快速追问 · 拖动左上角调整大小</small></div><button onClick={()=>setOpen(false)} aria-label="关闭题目助手"><X/></button></header><div className="assistant-messages">{messages.map((m,i)=><div className={`assistant-message ${m.role}`} key={`${m.role}-${i}`}>{m.text}</div>)}</div><div className="assistant-actions"><button onClick={()=>ask('为什么选这个？')}>为什么选这个</button><button onClick={()=>ask('这题有什么技巧？')}>答题技巧</button><button onClick={copy}><Clipboard/>复制到 Codex</button></div><div className="assistant-compose"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="继续追问当前题…"/><button onClick={send} aria-label="发送问题"><Send/></button></div></aside>:<button className="study-assistant-launcher" onClick={()=>setOpen(true)}><MessageCircle/>题目助手</button>;
}

export function mountStudyAssistant(){if(document.getElementById('study-assistant-root'))return;const host=document.createElement('div');host.id='study-assistant-root';document.body.appendChild(host);createRoot(host).render(<StudyAssistant/>)}
