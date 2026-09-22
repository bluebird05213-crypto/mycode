import{generateAutoAnalysis}from'./analysis.js';
const CJK=/[\u3400-\u9fff\uf900-\ufaff]/;
const QUESTION=/^\s*(?:第\s*)?(\d{1,3})\s*[、.．:：)]\s*(.*)$/;
const OPTION=/^\s*([A-E])\s*[、.．:：)]?\s*(.*)$/i;
const ANSWER=/(?:(?:正\s*确|参\s*考)?\s*答\s*案)\s*[：:]?\s*([A-E])/i;
const ANSWER_LABEL=/(?:正\s*确\s*答\s*案|参\s*考\s*答\s*案|答\s*案)\s*(?:[：:]|$)/i;

function joinTokens(tokens){
 let out='';
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],prev=tokens[i-1];if(!prev){out=t.str;continue}
  const gap=t.x-(prev.x+prev.width),left=prev.str.slice(-1),right=t.str[0];
  const naturalSpace=gap>Math.max(4,(prev.height||10)*.42)&&!CJK.test(left+right);
  out+=(naturalSpace?' ':'')+t.str;
 }
 return out.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff，。；：！？、“”‘’（）])/g,'$1').replace(/\s+([，。；：！？、）])/g,'$1').replace(/（\s+/g,'（').trim();
}

function pageItemsToLineObjects(items){
 const tokens=items.filter(i=>i.str?.trim()).map(i=>({str:i.str,x:i.transform?.[4]||0,y:i.transform?.[5]||0,width:i.width||0,height:Math.abs(i.transform?.[3])||i.height||10})).sort((a,b)=>b.y-a.y||a.x-b.x);
 const lines=[];
 for(const token of tokens){let line=lines.find(l=>Math.abs(l.y-token.y)<=Math.max(2.4,token.height*.3));if(!line){line={y:token.y,tokens:[]};lines.push(line)}line.tokens.push(token)}
 return lines.sort((a,b)=>b.y-a.y).map(l=>({text:joinTokens(l.tokens.sort((a,b)=>a.x-b.x)),y:l.y})).filter(l=>l.text);
}
export function pageItemsToLines(items){return pageItemsToLineObjects(items).map(l=>l.text)}

function categoryFrom(text,current='unknown'){
 const compact=text.replace(/\s+/g,'');
 if(/图形推理|图形规律|九宫格|折纸|空间规律/.test(compact))return'figure';
 if(/材料分析|资料分析|根据下列资料|统计图|增长率|同比|环比|比重/.test(compact))return'material';
 if(/数字推理|数学推理|数量关系|数列/.test(compact))return'number';
 if(/性格|心理测评|行为倾向/.test(compact))return'personality';
 if(/文字推理|言语理解|逻辑判断|定义判断|阅读理解/.test(compact))return'verbal';
 return current;
}

function inferQuestionCategory(raw,options,current){
 const compact=raw.replace(/\s+/g,'');
 if(/数列|下一项数字|数字规律|计算结果|方程/.test(compact))return'number';
 if(/根据(?:材料|资料|图表)|下表|上表|统计图|增长率|同比|环比|比重|百分比|%|报告显示|万人|亿元/.test(compact))return'material';
 if(/非常符合|比较符合|非常同意|工作中我|我通常|我倾向于/.test(compact))return'personality';
 if(/图形|九宫格|问号处的图片|折叠|展开图/.test(compact)||(options.length<2&&ANSWER.test(raw)))return'figure';
 if(/定义|以下哪项|主要观点|主旨|最能支持|最能削弱|根据上述|这段文字/.test(compact))return'verbal';
 return'verbal';
}

function clamp01(value){return Math.max(0,Math.min(1,value))}
function cleanStem(value){return value.replace(/\s*(?:正确答案|参考答案|答案)\s*[：:]?\s*[A-E]?[\s\S]*$/i,'').replace(/\s+\d{1,3}\s*$/,'').replace(/\s{2,}/g,' ').trim()}
function answerOrLabel(text){return ANSWER.test(text)||ANSWER_LABEL.test(text)}
function optionLine(text){return OPTION.test(text)&&!/正\s*确\s*答\s*案|参\s*考\s*答\s*案|答\s*案/i.test(text)}
function explanationLine(text){return /^\s*解析\s*[：:]/.test(text)}
function pageFooter(text){return /^\s*\d{1,3}\s*$/.test(text)}
function displayPartsFor(segment,category){
 const records=segment.records||[];if(!records.length)return[];
 const groups=[];for(const record of records){let group=groups.find(x=>x.pageNumber===record.pageNumber);if(!group){group={pageNumber:record.pageNumber,height:record.height,records:[]};groups.push(group)}group.records.push(record)}
 return groups.map((group,index)=>{
  const first=group.records[0];
  const cutoff=group.records.find((record,recordIndex)=>{
   if(recordIndex===0)return false;
   if(answerOrLabel(record.text)||explanationLine(record.text)||pageFooter(record.text))return true;
   return category==='material'&&optionLine(record.text);
  });
  let top=index===0?clamp01((group.height-first.y-24)/group.height):0;
  let bottom=1;
  if(cutoff)bottom=clamp01((group.height-cutoff.y-18)/group.height);
  if(segment.nextBoundary?.pageNumber===group.pageNumber)bottom=Math.min(bottom,clamp01((group.height-segment.nextBoundary.y-18)/group.height));
  if(bottom<=top+.025)bottom=Math.min(1,top+.12);
  return{pageNumber:group.pageNumber,top,bottom};
 }).filter(x=>x.bottom>x.top+.02);
}

function buildQuestion(segment,source,fileName,index){
 const raw=segment.lines.join('\n'),options=[];let answer=null,answerLine=-1,explain='';
 segment.lines.forEach((line,i)=>{const m=line.match(OPTION);if(m&&!/正确答案|参考答案|答案/.test(line)&&m[2].trim())options.push(m[2].trim());const a=line.match(ANSWER);if(a&&answerLine<0){answer=a[1].toUpperCase().charCodeAt(0)-65;answerLine=i}});
 const explanationAt=segment.lines.findIndex(l=>/^\s*解析\s*[：:]/.test(l));if(explanationAt>=0)explain=segment.lines.slice(explanationAt).join(' ').replace(/^\s*解析\s*[：:]\s*/, '').trim();
 const stopAt=[segment.lines.findIndex(l=>OPTION.test(l)&&!/(正确答案|参考答案|答案)/.test(l)),answerLine,explanationAt].filter(x=>x>=0).concat(segment.lines.length);const stem=cleanStem(segment.lines.slice(0,Math.min(...stopAt)).join(' ').replace(QUESTION,'$2'));
 const confidence=Math.min(.98,.42+(options.length>=4?.25:options.length>=2?.12:0)+(answer!==null?.2:0)+(explanationAt>=0?.08:0));
 const category=inferQuestionCategory(raw,options,segment.category);
 const displayOptions=options.length>=2?options:category==='figure'?['图形选项 A（见上方图形）','图形选项 B（见上方图形）','图形选项 C（见上方图形）','图形选项 D（见上方图形）','图形选项 E（见上方图形）']:['请结合原页查看选项','选项未能结构化'];
 const autoAnalysis=generateAutoAnalysis({category,stem:stem||cleanStem(segment.lines[0]),options:displayOptions,answer});const figureGuide=category==='figure'?figureAnalysis(explain||raw):{};const displayParts=displayPartsFor(segment,category);const visualParts=['figure','material'].includes(category)?displayParts:[];const sourcePages=[...new Set((segment.records||[]).map(x=>x.pageNumber))];const finalExplain=category==='figure'?(explain||figureGuide.rule||'原文件未识别到独立解析，请结合本题图形与原页核对。'):(explain?`${explain} 补充方法：${autoAnalysis.method}`:autoAnalysis.summary);const finalTip=figureGuide.tip||autoAnalysis.tip;
 return{id:`upload-${Date.now()}-${index}`,source,category,type:'导入题',stem:stem||cleanStem(segment.lines[0]),options:displayOptions,answer,explain:finalExplain,tip:finalTip,analysis:category==='figure'?{...figureGuide,label:'图形规律',source:explain?'原题解析 + 自动分层':'自动分层'}:autoAnalysis,confidence,reason:`根据第 ${segment.pageNumber} 页章节和题目特征分类`,fileName,pageNumber:segment.pageNumber,sourcePages,backupParts:displayParts,cropTop:displayParts[0]?.top??segment.cropTop,cropBottom:displayParts[0]?.bottom??segment.cropBottom,visualParts,visualCropVersion:3,answerSafeVersion:1,needsVisual:['figure','material'].includes(category),needsReview:confidence<.72||answer===null||(options.length<2&&category!=='figure'),rawText:raw.slice(0,4000),...figureGuide};
}

function figureAnalysis(text){const t=text.replace(/\s+/g,'');let kind='结构/位置变化',visual='主体轮廓基本不变，变化集中在元素的位置、方向或填充属性。',rule='先按对应位置逐格比较，再用连续两步验证同一规律。';if(/旋转|顺时针|逆时针|角度|转动/.test(t)){kind='旋转类';visual='图形主体相同，但标记的朝向或所在扇区发生规律性转动。';rule='检查每一步的旋转方向和角度；若角度一致，就将上一幅整体旋转同样角度。'}else if(/叠加|相同.*消|异或|求同|求异|相加|相减/.test(t)){kind='叠加运算类';visual='多个图形的对应位置可以一一对齐，变化来自重合、消除或保留。';rule='把对应位置逐点比较，检查求同、求异、相同消除或颜色叠加，不要把整幅图凭感觉比较。'}else if(/平移|移动|挪|向左|向右|向上|向下/.test(t)){kind='平移类';visual='相同元素没有明显增减，主要是沿横向、纵向或固定路径换了位置。';rule='记录每个元素移动的方向、格数和循环周期；不同元素可能分别沿不同方向移动。'}else if(/对称|轴对称|中心对称/.test(t)){kind='对称类';visual='图形两侧或绕中心呈镜像关系，重点是对称轴与元素相对位置。';rule='先确定对称轴或中心，再检查翻转后的位置是否完全对应。'}else if(/数量|递增|递减|个数|几个/.test(t)){kind='数量类';visual='轮廓变化不明显，但点、线、角、封闭空间或黑块数量在变化。';rule='分别统计关键元素，再检查等差、周期、奇偶或前后运算关系。'}else if(/内外|里外|封闭|空间/.test(t)){kind='空间/内外关系类';visual='变化发生在内外层、封闭区域或图形嵌套关系中。';rule='先拆外框、内框和内部标记三层，再比较元素是在层内移动还是层间交换。'}return{visual:`第一眼先归入“${kind}”：${visual}`,rule,check:'先用前两幅图提出规律，再用下一幅独立验证；若不能同时解释全部图形，立即换规律。',tip:'一次只检查一个维度：位置 → 样式 → 属性 → 数量 → 空间；解析文字出现“移动/旋转/叠加”等词时，优先验证对应类别。'} }

export function parsePages(pages,source,fileName){
 const segments=[];let currentCategory='unknown',active=null;
 for(const page of pages){
  for(const entry of page.lineObjects){const line=entry.text;currentCategory=categoryFrom(line,currentCategory);const m=line.match(QUESTION);if(m){if(active){active.nextBoundary={pageNumber:page.pageNumber,y:entry.y,height:page.height};if(active.pageNumber===page.pageNumber)active.cropBottom=Math.min(1,(page.height-entry.y-16)/page.height);segments.push(active)}active={pageNumber:page.pageNumber,category:currentCategory,lines:[line],records:[{...entry,pageNumber:page.pageNumber,height:page.height}],cropTop:Math.max(0,(page.height-entry.y-22)/page.height),cropBottom:1}}else if(active){active.lines.push(line);active.records.push({...entry,pageNumber:page.pageNumber,height:page.height})}}
 }
 if(active)segments.push(active);
 const questions=segments.filter(s=>s.lines.some(l=>OPTION.test(l))||s.lines.some(l=>ANSWER.test(l))).map((s,i)=>buildQuestion(s,source,fileName,i));
 const answerAnchors=pages.reduce((n,p)=>n+p.lines.filter(l=>ANSWER.test(l)).length,0),questionAnchors=segments.length;
 const expected=Math.max(answerAnchors,questionAnchors),coverage=expected?questions.length/expected:0;
 const warnings=[];if(pages.length>=10&&questions.length<Math.max(10,pages.length*.5))warnings.push(`文件有 ${pages.length} 页，但只形成 ${questions.length} 道题，识别结果异常偏少。`);if(expected>=10&&coverage<.6)warnings.push(`检测到约 ${expected} 个题目/答案锚点，仅成功结构化 ${questions.length} 道。`);
 return{questions,diagnostics:{pages:pages.length,totalLines:pages.reduce((n,p)=>n+p.lines.length,0),questionAnchors,answerAnchors,coverage,warnings,blocked:warnings.length>0&&questions.length<10}};
}

export async function extractPdf(pdf){
 const pages=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent(),viewport=page.getViewport({scale:1}),lineObjects=pageItemsToLineObjects(content.items);pages.push({pageNumber:n,height:viewport.height,lines:lineObjects.map(l=>l.text),lineObjects})}return pages;
}
