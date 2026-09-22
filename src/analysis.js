const LABELS={verbal:'文字推理',number:'数字推理',figure:'图形推理',material:'材料分析',personality:'性格解读',unknown:'综合题'};
const letter=i=>Number.isInteger(i)?String.fromCharCode(65+i):'待核对';

function verbalMode(text){
 if(/主旨|中心|概括|主要内容|标题/.test(text))return['主旨概括','先找反复出现的对象和结论，再排除只描述局部细节的选项。'];
 if(/定义|属于|符合.*定义|不属于/.test(text))return['定义判断','先提炼定义中的必要条件，再逐项核对选项是否同时满足，不能只凭关键词相似。'];
 if(/支持|加强|最能说明|最能证明/.test(text))return['加强支持','先找题干的结论和论据，再判断哪个选项能补足因果链或排除其他解释。'];
 if(/削弱|质疑|反驳|不能支持/.test(text))return['削弱反驳','先确认题干结论，再优先寻找直接否定因果、反例或替代原因的选项。'];
 if(/推断|可以得出|必然|可能推出/.test(text))return['逻辑推断','只使用题干明确给出的条件，先做确定推理，不能把生活常识或题外信息当成前提。'];
 return['言语理解','先圈出题干的对象、关系和问法，再用排除法比较选项是否完整回应题干。'];
}

function buildAnalysis({category='unknown',stem='',options=[],answer=null}){
 const text=`${stem} ${options.join(' ')}`.replace(/\s+/g,'');
 const answerText=Number.isInteger(answer)?`标准答案为 ${letter(answer)}，做完后要回到题干核对它是否真正满足题目要求。`:'当前未能确认标准答案，先完成推理，再结合原题答案核对。';
 if(category==='verbal'){
  const[type,method]=verbalMode(text);
  return{label:type,summary:`这道题属于${type}。${method}${answerText}`,method,check:'做完后反向验证：把选项代回题干，确认没有偷换对象、范围或因果关系。',tip:'先读问题再读材料；把选项分成“完全符合、部分符合、无关或过度推断”，优先排除后两类。',source:'自动分析'};
 }
 if(category==='number')return{label:'数字规律',summary:`这道题先按“差值 → 二阶差值 → 倍数/比例 → 交替分组”的顺序检查。${answerText}`,method:'把相邻项写成运算关系，先看最简单的差分和倍数；若规律交替出现，再拆奇数项与偶数项。',check:'用至少两组连续关系复核，避免只用一组数字凑规律。',tip:'不要一开始就尝试复杂公式，先做差、看倍数、看奇偶和分组。',source:'自动分析'};
 if(category==='material')return{label:'资料分析',summary:`这道题先定位材料中的对象、时间和单位，再判断是总量、增长率、比重还是平均量。${answerText}`,method:'先写“现期/基期/差额/比重”的对应关系，再代入数据；涉及增长率时使用（现期-基期）÷基期。',check:'检查计算口径、单位和分母，尤其确认题目问的是增长量、增长率还是增长后的数量。',tip:'材料题先定位关键词和数据，不要通读所有数字；估算时保留数量级，最后再核对选项。',source:'自动分析'};
 if(category==='personality')return{label:'性格测评',summary:`这道题重点不是寻找“看起来最完美”的选项，而是判断选项描述的行为倾向是否符合题干情境。${answerText}`,method:'先识别题目考察的是稳定习惯、压力反应、合作方式还是规则意识，再选择与自己长期表现一致的程度。',check:'检查前后题的一致性，避免为了选“好答案”而在相近题目中自相矛盾。',tip:'保持真实、稳定、一致；不要把偶尔发生的行为误选成长期特征。',source:'自动分析'};
 return{label:LABELS[category]||LABELS.unknown,summary:`这道题需要先确认题型、题干条件和选项关系，再逐项验证。${answerText}`,method:'先提炼题目要求，再把每个选项与题干条件逐一对照。',check:'如果一个选项需要额外假设才能成立，就暂时排除并回到题干找明确依据。',tip:'先独立作答，再用解析检查自己是题意理解、条件定位还是计算环节出错。',source:'自动分析'};
}

export function generateAutoAnalysis(input){const analysis=buildAnalysis(input||{});return{...analysis,summary:`${analysis.summary} 快速验证：${analysis.check}`}}
