/* 舰队复原参数。史载/研究尺度与几何假设分别保存，勿把模型当作考古测绘。 */
window.ZH_FLEET = (function () {
  var sources = {
    ming: { title: '《明史》卷三百四·郑和传', url: 'https://zh.wikisource.org/wiki/明史/卷304', note: '大舶尺度与第一次数量；清代编纂的历史记载，尺度存在争论。' },
    study: { title: '金国平《缅怀历史，展望未来：纪念郑和下西洋600周年》', url: 'https://www.safp.gov.mo/static/2023/09/16/WCM_003280.pdf', note: '《行政》2005年第68期，第557页（全文549—562页）；文中介绍二千料船61.2×13.8米的尺度解释，不是定论。' },
    museum: { title: '中国机械工程数字博物馆·郑和航船', url: 'https://museum.cmes.org/machinery/search/detail/c5eb6f090e9a48cbb5b68221cece11c0', note: '五类船的传统模型体系与尺度争议。五至九桅方案采用这一展示体系，不视为同时代实测。' },
    craft: { title: 'Royal Museums Greenwich · Pechili trading junk', url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-6901', note: '后世中国商船模型的舱口、绞盘与桅座构件比较资料，不能直接证明明代郑和船的布局。' },
    rig: { title: '长荣海事博物馆·郑和宝船', url: 'https://www.evergreenmuseum.org.tw/collection/79', note: '馆藏为现代研究推论模型，采用九桅十二帆；不能据此确认二千料尺度的帆装。本项目目前为九桅九主帆示意，未复制该馆模型。' },
    fuchuan: {title:'《古今图书集成·戎政典》大福船图说',url:'https://www.shidianguji.com/zh/mid-page/7597182380151406602',note:'清代汇编中的大福船比较材料：艉楼、露台、梯道与栏护。所述为二桅福船，不能直接证明永宣宝船的楼层和帆装。'},
    tiangong: {title:'宋应星《天工开物·漕舫》',url:'https://zh.wikisource.org/zh-hant/天工開物/漕舫',note:'晚明漕船资料，记带竹条的分片篷、升降与减帆、桅顶穿索及麻索。用于构件原理比较，不照搬漕船桅数、材料和尺寸到宝船。'},
    shantung: {title:'Science Museum Group · 山东五桅商船模型（1933-670）',url:'https://collection.sciencemuseumgroup.org.uk/objects/co41902/model-of-a-5-masted-shantung-trading-junk',note:'1931—1933年后世船模，记密帆骨、多支控帆索。仅用于索具构件比较，不据此认定郑和宝船的支索方式。'},
    novel: {title:'《三宝太监西洋记》第十五回（小说）',url:'https://zh.wikisource.org/zh-hant/三寶太監西洋記/015',note:'九桅与华丽殿宇见于小说叙述，不能作为实船测绘依据。本项目九桅九主帆继续作为展示假设。'},
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
  // Unequal mast stations [length fraction, beam fraction, height/L, sail width/L].
  // A separate hypothesis from the dimensional evidence; retained across scales for comparison.
  const rigStations=[[-.47,0,.26,.065],[-.23,-.24,.25,.09],[-.16,.24,.30,.12],[-.045,-.24,.37,.14],[.035,.24,.40,.145],[.15,-.24,.36,.12],[.225,.24,.30,.10],[.33,-.20,.24,.08],[.405,.12,.18,.055]];
  const indices={baochuan:[0,1,2,3,4,5,6,7,8],machuan:[0,1,2,3,4,5,6,8],liangchuan:[0,1,3,4,5,6,8],zuochuan:[0,1,3,4,6,8],zhanchuan:[0,1,4,6,8]};
  Object.entries(types).forEach(([id,s])=>s.model.rig=indices[id].map(i=>rigStations[i]));
  types.baochuan.variants.recorded.draft=8;
  types.baochuan.variants.recorded.freeboard=4;
  types.baochuan.variants.recorded.sectionNote='吃水8米、干舷4米借用现代展示模型的深度解释，与本页尺制折算并非同一套完整测绘，属于组合示意。';
  var parts = [
    {id:'hull',name:'船体与龙骨',text:'纵向龙骨与弯曲横剖面支承船壳。模型采用尖底、首尾抬升的福船式轮廓；郑和宝船的具体船型仍有不同解释。',src:'museum'},
    {id:'sails',name:'桅杆与硬帆',text:'主桅帆较高，首尾帆较小，桅座延伸入舱，帆骨接引帆索。五至九桅为展示假设，不随研究尺度自动获得历史依据；宝船目前为九桅九主帆，与长荣馆九桅十二帆复原不同。',src:'museum'},
    {id:'bulkheads',name:'水密隔舱',text:'横向舱壁将船内空间分隔，局部进水时可限制水的扩散。剖视显示连续龙骨材、肋骨、横梁、支柱和架高舱底板。货物在完整与剖视模式保持同一位置；舱数与配置是建模假设。',src:'bulkhead'},
    {id:'rudder',name:'艉舵',text:'艉部舵杆连接水下舵叶，改变水流方向以操纵航向。舵的大小、外形和悬挂方式仅作构造示意。',src:'museum'},
    {id:'anchor',name:'锚与绞盘',text:'船首配置锚、锚索与绞盘，便于理解停泊和收放过程。当前造型及数量是示意，不是出土锚的复制品。',src:'museum'},
    {id:'cabins',name:'甲板与船楼',text:'船楼设独立楼板、窗洞、前门、外梯与床桌，甲板舱口实际开孔并设围板、盖板和下舱梯。楼层净高按约2.25米的展示假设控制；按船型用途配置的马栏、粮袋及货箱均为推定布局。',src:'museum'}
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
  var refinedParts={
    cabins:{text:'精修样板将三层艉楼拆为柱梁、围壁、真实窗洞与局部开启的木窗板，增加屋面露台、栏护、登楼梯及实际开孔的上层梯口。大福船图说只提供类型比较；三层、2.25米层高及窗格布置仍是建模假设，船内四层不等于甲板上四层楼。',src:'fuchuan'},
    sails:{text:'精修样板显示分幅帆面、帆骨、上下帆杆、桅旁升帆滑轮与引向系缆点的多支控帆索。晚明漕船和后世船模仅提供构件比较；九桅九主帆、每帆八幅、帆材和索路尺寸均为展示选择，未完成航行工程验证。',src:'tiangong'}
  };
  return {refinedParts:refinedParts,chiToM:.311, sources:sources, types:types, parts:parts, voyages:voyages,
    caution:'示意复原：尺度方案与船体细节的证据不同。船楼、帆装和内部布局未有完整原船图纸，勿作精确历史模型。'};
})();
