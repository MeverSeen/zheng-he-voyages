/* 舰队复原参数。史载/研究尺度与几何假设分别保存，勿把模型当作考古测绘。 */
window.ZH_FLEET = (function () {
  var sources = {
    ming: { title: '《明史》卷三百四·郑和传', url: 'https://zh.wikisource.org/wiki/明史/卷304', note: '大舶尺度与第一次数量；清代编纂的历史记载，尺度存在争论。' },
    study: { title: '金国平《缅怀历史，展望未来：纪念郑和下西洋600周年》', url: 'https://www.safp.gov.mo/static/2023/09/16/WCM_003280.pdf', note: '《行政》2005年第68期，第557页（全文549—562页）；文中介绍二千料船61.2×13.8米的尺度解释，不是定论。' },
    museum: { title: '中国机械工程数字博物馆·郑和航船', url: 'https://museum.cmes.org/machinery/search/detail/c5eb6f090e9a48cbb5b68221cece11c0', note: '五类船的传统模型体系与尺度争议。五至九桅方案采用这一展示体系，不视为同时代实测。' },
    bulkhead: { title: 'UNESCO·中国水密隔舱福船制造技艺', url: 'https://ich.unesco.org/en/RL/00321', note: '支持隔舱、木板连接及填缝技术；不提供郑和某艘船的隔舱数量与位置。' }
  };
  function variant(L, B, label, evidence, src) { return { L:L, B:B, label:label, evidence:evidence, src:src }; }
  function type(name, role, L, B, masts, decks, compartments, cargo) {
    return { name:name, role:role, variants:{ estimated:variant(L,B,'用途比例示意','建模假设','museum') },
      model:{ masts:masts, decks:decks, compartments:compartments, cargo:cargo, draft:L*.045, freeboard:L*.055,
        basis:'福船式尖底轮廓为本次展示选择；桅位、帆型、船楼、吃水、隔舱数及舱内布置均为建模假设，不代表唯一复原。' },
      src:'museum' };
  }
  var types = {
    baochuan:type('宝船','使团座船与礼物、货物运输',61.2,13.8,9,3,12,'chests'),
    machuan:type('马船','马匹及物资运输用途示意',49,11.5,8,2,10,'stalls'),
    liangchuan:type('粮船','粮食与补给运输用途示意',43,11.8,7,1,11,'sacks'),
    zuochuan:type('坐船','人员乘坐与生活空间示意',37,8.8,6,2,9,'quarters'),
    zhanchuan:type('战船','护卫与战斗用途示意',30,6.8,5,1,8,'weapons')
  };
  types.baochuan.variants = {
    estimated:variant(61.2,13.8,'二千料尺度解释','研究解释','study'),
    recorded:variant(44*10*.311,18*10*.311,'《明史》尺度折算','史载尺度（有争议）','ming')
  };
  var parts = [
    {id:'hull',name:'船体与龙骨',text:'纵向龙骨与弯曲横剖面支承船壳。模型采用尖底、首尾抬升的福船式轮廓；郑和宝船的具体船型仍有不同解释。',src:'museum'},
    {id:'sails',name:'桅杆与硬帆',text:'帆面以横向帆骨支撑，索具连接桅顶、帆与甲板。模型的桅数沿用传统五类船展示体系，具体帆装和桅位属于示意。',src:'museum'},
    {id:'bulkheads',name:'水密隔舱',text:'横向舱壁将船内空间分隔，局部进水时可限制水的扩散。剖视显示舱壁、舱底与肋骨；舱数与配置是建模假设。',src:'bulkhead'},
    {id:'rudder',name:'艉舵',text:'艉部舵杆连接水下舵叶，改变水流方向以操纵航向。舵的大小、外形和悬挂方式仅作构造示意。',src:'museum'},
    {id:'anchor',name:'锚与绞盘',text:'船首配置锚、锚索与绞盘，便于理解停泊和收放过程。当前造型及数量是示意，不是出土锚的复制品。',src:'museum'},
    {id:'cabins',name:'甲板与船楼',text:'船楼、舱口和通道表现生活与作业空间；按船型用途配置的马栏、粮袋及货箱均为推定布局。',src:'museum'}
  ];
  var voyages = {};
  for(var n=1;n<=7;n++) {
    var det=window.ZH_DETAIL[n].fleet;
    var record=n===1 ? det.large : n===2||n===3 ? det.total : {n:null,text:'船数史料未载',src:null};
    voyages[n]={ recorded:{n:record.n,text:record.text,src:record.src,
      scope:n===1?'记载中的大舶':n===2?'改造海运船数，不等于实际出航数':n===3?'记载中的海舶':'未载'},
      model:{baochuan:10,machuan:40,liangchuan:80,zuochuan:80,zhanchuan:40},estimate:true,
      basis:'统一250艘教学编成（10/40/80/80/40），仅便于观察船型分工，不推断各次实际数量。七次共用相同假设，不能据此比较真实规模。'};
  }
  return {chiToM:.311, sources:sources, types:types, parts:parts, voyages:voyages,
    caution:'示意复原：尺度方案与船体细节的证据不同。船楼、帆装和内部布局未有完整原船图纸，勿作精确历史模型。'};
})();
