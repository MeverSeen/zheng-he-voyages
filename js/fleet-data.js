/* 舰队复原参数。史载/研究尺度与几何假设分别保存，勿把模型当作考古测绘。 */
window.ZH_FLEET = (function () {
  var sources = {
    ming: { title: '《明史》卷三百四·郑和传', url: 'https://zh.wikisource.org/wiki/明史/卷304', note: '大舶尺度与第一次数量；清代编纂的历史记载，尺度存在争论。' },
    study: { title: '金国平《缅怀历史，展望未来：纪念郑和下西洋600周年》', url: 'https://www.safp.gov.mo/static/2023/09/16/WCM_003280.pdf', note: '《行政》2005年第68期，第557页（全文549—562页）；文中介绍二千料船61.2×13.8米的尺度解释，不是定论。' },
    museum: { title: '中国机械工程数字博物馆·郑和航船', url: 'https://museum.cmes.org/machinery/search/detail/c5eb6f090e9a48cbb5b68221cece11c0', note: '五类船的传统模型体系与尺度争议。五至九桅方案采用这一展示体系，不视为同时代实测。' },
    craft: { title: 'Royal Museums Greenwich · Pechili trading junk', url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-6901', note: '后世中国商船模型的舱口、绞盘与桅座构件比较资料，不能直接证明明代郑和船的布局。' },
    rig: { title: '长荣海事博物馆·郑和宝船', url: 'https://www.evergreenmuseum.org.tw/collection/79', note: '馆藏为现代研究推论模型，采用九桅十二帆；不能据此确认二千料尺度的帆装。本项目目前为九桅九帆示意，未复制该馆模型。' },
    fuchuan: {title:'《古今图书集成·戎政典》大福船图说',url:'https://www.shidianguji.com/zh/mid-page/7597182380151406602',note:'清代汇编中的大福船比较材料：艉楼、露台、梯道与栏护。所述为二桅福船，不能直接证明永宣宝船的楼层和帆装。'},
    tiangong: {title:'宋应星《天工开物·漕舫》',url:'https://zh.wikisource.org/zh-hant/天工開物/漕舫',note:'晚明漕船资料，记带竹条的分片篷、升降与减帆、桅顶穿索及麻索。用于构件原理比较，不照搬漕船桅数、材料和尺寸到宝船。'},
    shantung: {title:'Science Museum Group · 山东五桅商船模型（1933-670）',url:'https://collection.sciencemuseumgroup.org.uk/objects/co41902/model-of-a-5-masted-shantung-trading-junk',note:'1931—1933年后世船模，记密帆骨、多支控帆索。仅用于索具构件比较，不据此认定郑和宝船的支索方式。'},
    foochow: {title:'Science Museum Group · 福州海船模型（1936-347）',url:'https://collection.sciencemuseumgroup.org.uk/objects/co41975/rigged-model-of-a-foochow-junk',note:'1936年制作、表现20世纪初福州海船的模型；主帆、首帆和艉帆分别编目。用于大小帆差异的比较，不作为郑和宝船帆装的直接证据。'},
    songHull: {title:'泉州市文旅局 · 泉州湾宋代海船残体',url:'https://www.quanzhou.gov.cn/zfb/xxgk/zfxxgkzl/qzdt/qzyw/202402/t20240204_3002556.htm',note:'馆藏遗存的介绍记尖头方尾、尖底与多层船板。只作船体构造类型参照；不能据其残体恢复宝船的船楼和帆装。'},
    novel: {title:'《三宝太监西洋记》第十五回（小说）',url:'https://zh.wikisource.org/zh-hant/三寶太監西洋記/015',note:'九桅与华丽殿宇见于小说叙述，不能作为实船测绘依据。本项目九桅九帆继续作为展示假设。'},
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
    {id:'sails',name:'桅杆与硬帆',text:'主桅帆较高，首尾帆较小，桅座延伸入舱，帆骨接引帆索。五至九桅为展示假设，不随研究尺度自动获得历史依据；宝船目前为九桅九帆，与长荣馆九桅十二帆复原不同。',src:'museum'},
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
    hull:{text:'精修样板拓宽既有方艉封板，衔接船板与护舷材，并补出船壳的实际厚度。宋代遗存仅作类型参照；本模型160毫米船壳厚度、具体线型和艉部尺寸仍是建模假设。',src:'songHull'},
    cabins:{text:'三层艉楼的前部逐层退让，下层围壁较封闭，上层设较轻的浅拱遮蔽顶，保留两处真实梯口。卧铺、工作室、瞭望位及层高均是布局假设。梁端设斜撑、柱脚设承托；舱口盖分片后靠舷堆放，为通行留出空间。',src:'fuchuan'},
    sails:{text:'精修样板区分主帆、首帆和艉帆的比例、上帆杆斜度与5—9幅分段，主桅移至中线，每幅帆骨尾端连接控帆索。前部辅帆可查看展开、半收与收拢三种状态。九桅九帆、桅位与帆形仍是假设；收帆示范只表现构件位置，不计算风载、绳长约束或操纵力。',src:'tiangong'},
    bulkheads:{text:'剖视保留肋骨、梁、纵向承托与货物位置，并为原来的薄片隔舱补出120毫米厚度。厚度是本模型选择；宋代遗存和传统技艺不提供郑和某艘船的确切舱数、板厚或布局。',src:'songHull'},
    rudder:{text:'舵杆上端延至艉部平台，短舵柄与舵承之间留出操作位置。舵叶比例、悬挂方式和平台均为构造示意；尚未验证转舵所需机械增益、升降机构或受力。',src:'craft'},
    anchor:{text:'绞盘前移，避开前部舱口，锚缆经舷侧导缆点引向绞盘。操作位与主甲板通路已用人体尺度做局部净空检查；这不替代完整的作业流程或船舶工程验证。',src:'craft'}
  };
  var fleetRefinedCommon={
    hull:{text:'独立精修模型采用分带船板、护舷材与有厚度的船壳，保留尖底和方艉的类型示意。各船尺度、板厚和具体线型为建模选择，不能据此认定原船实制。',src:'songHull'},
    sails:{text:'按主帆、首帆、艉帆区分比例、斜顶、帆肚与5—8幅分段，帆骨尾端连接控帆支索。前部一面辅帆提供展开、半收与收拢示范，只表现构件位置。五至八桅的船型体系和具体索路仍为假设，未计算受力或绳长守恒。',src:'tiangong'},
    bulkheads:{text:'剖视显示有厚度的隔舱、肋骨、甲板梁、支柱和架高舱底板。隔舱取120毫米厚是本模型选择；货物和床位在完整与剖视中保持原位，布局不代表原船测绘。',src:'bulkhead'},
    rudder:{text:'舵杆延至艉部操作平台，配短舵柄和支承。平台、舵叶比例和悬挂仍为示意，未核算机械增益、升降方式或操舵载荷。',src:'craft'},
    anchor:{text:'船首锚索经舷侧导缆点接入绞盘，绞盘避开前舱口；舱口盖分片叠放，战船窄处将盖板转向后放在开口后方。主甲板通路与绞盘操作位进行局部净空检查，不等同于完整作业流程验证。',src:'craft'}
  };
  var fleetCabins={
    machuan:'马船采用两层艉楼与退让露台，舱内配置空马栏、侧栏和饲槽，表示马匹运输的用途分配。马栏尺寸、饲喂方式、通风与载运能力未获原船资料证实；模型未模拟装卸马匹或动物活动。',
    liangchuan:'粮船采用一层低艉楼，舱内设置架高垫板与分组粮袋，留出舱口和甲板通路。储粮分配、包装和防潮构造均为用途示意，未核算载重量、含水率或粮储管理。',
    zuochuan:'坐船采用两层艉楼，舱内以独立卧铺、床脚与储物箱表现起居空间。楼高和床铺按人体尺度设置，人数、床位分配与通风安排仍是建模假设。',
    zhanchuan:'战船采用一层紧凑艉楼，保留开敞甲板与侧部盾板，舱内配置器械柜和长杆器械。武备形式、数量与作战岗位为展示选择，不推定存在后世舷侧炮列。'
  };
  var refinedPartsByType={baochuan:refinedParts};
  Object.keys(fleetCabins).forEach(id=>refinedPartsByType[id]={...fleetRefinedCommon,cabins:{text:fleetCabins[id],src:'museum'}});
  return {refinedParts:refinedParts,refinedPartsByType:refinedPartsByType,chiToM:.311, sources:sources, types:types, parts:parts, voyages:voyages,
    caution:'示意复原：尺度方案与船体细节的证据不同。船楼、帆装和内部布局未有完整原船图纸，勿作精确历史模型。'};
})();
