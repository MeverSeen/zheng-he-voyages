/*
 * 人物复原数据 ZH_PEOPLE（docs/SPEC.md §6；需求与核查清单见 docs/PEOPLE-PLAN.md）
 * 草稿：服饰出处尚待对照原文核实（PEOPLE-PLAN §6）。
 * 每个角色的服饰写成一组部件（figure），2D 立绘与 3D 人物都由它生成；costume 是给读者看的说明与出处。
 * 这里还原的是"职官与身份的典型服饰"，不是具体人物的相貌：郑和没有同时代的画像传世。颜色为示意。
 *
 * figure 字段：
 *   hat    quji 描金曲脚帽 | wusha 乌纱帽（展角） | sifang 四方平定巾 | wangjin 网巾 | helmet 铁盔 | douli 斗笠
 *   robe   round 圆领长袍 | cross 交领长衫（直身） | jacket 短衣 | pangao 胖袄（及膝）
 *   sleeve narrow 窄袖 | wide 宽袖
 *   badge  null | 'lion' 狮子补（武官一二品） | 'flower' 胸背花（内使）
 *   belt   horn 乌角带 | rhino 花犀带 | sash 布带 | cord 绦
 *   feet   boots 皂靴 | cloth 布鞋 | straw 草鞋 | bare 赤足
 *   legs   null（长袍遮住）| trousers 长裤 | rolled 卷起的裤腿 | wraps 裹腿
 *   beard  是否蓄须（宦官不蓄须）
 * palette 颜色：robe trim hat belt boots skin item，可选 bootFace（靴面）
 *   items  edict 诏敕 | sword 腰刀 | spear 长枪 | gun 手铳 | compass 水罗盘 | book 簿册 | medbox 药箱 | rope 缆绳
 */
window.ZH_PEOPLE = (function () {
  var SRC = {
    yufu: '《明史·舆服志》',
    huidian: '万历《大明会典》·冠服',
    zhuozhong: '刘若愚《酌中志》卷十九《内臣佩服纪略》',
    sancai: '王圻、王思义《三才图会·衣服》',
    qianwen: '祝允明《前闻记》（第七次下西洋人员名目）',
    luhuang: '山东邹城鲁荒王朱檀墓出土冠服（1389 年下葬）'
  };
  var roles = [
    {
      id: 'eunuch-envoy', name: '正使太监', example: '郑和、王景弘', rank: '内官监太监（正四品）',
      duty: '统领全军，宣读诏敕，主持册封、赏赐与贸易。',
      figure: { hat: 'quji', robe: 'round', sleeve: 'narrow', badge: 'flower', belt: 'horn', feet: 'boots', legs: null, beard: false, items: ['edict'] },
      palette: { robe: '#8a2a22', trim: '#c9a54a', hat: '#1f1d1a', belt: '#1a1714', boots: '#1f1b18', bootFace: '#a8322a', skin: '#e6c3a0', item: '#d9b44a' },
      costume: [
        { part: 'hat', name: '乌纱描金曲脚帽', note: '明初内使所戴，帽后两脚向上曲折，描金装饰。', src: SRC.yufu },
        { part: 'robe', name: '盘领窄袖衫', note: '圆领、窄袖的长衫，便于行动，是内使的常服。', src: SRC.yufu },
        { part: 'badge', name: '胸背花', note: '胸前、背后织绣花样。品级高的宦官可蒙赐蟒衣，郑和是否获赐不见记载，这里不画。', src: SRC.yufu },
        { part: 'belt', name: '乌角带', note: '黑色角质带銙的腰带，宽松地挂在腰间。', src: SRC.yufu },
        { part: 'boots', name: '红扇面黑下桩靴', note: '《明史·舆服志》记内使"靴用红扇面黑下桩"：靴面红色，靴筒黑色。', src: SRC.yufu },
        { part: 'item', name: '诏敕', note: '出使时宣读的皇帝诏书和敕书，以黄绢包裹、匣盛。', src: '巩珍《西洋番国志》录有出使敕书' }
      ],
      caution: '郑和没有同时代的画像传世，后世画像都是想象；这里只表现内官监太监的典型服饰，不表现相貌。宦官不蓄须。'
    },
    {
      id: 'eunuch-deputy', name: '副使太监', example: '朱良、周满、洪保、杨真、张达、吴忠', rank: '太监、少监',
      duty: '分领分䑸，率船前往各国；第七次下西洋时，太监洪保在古里派通事等七人随当地船只往天方（今麦加）。',
      figure: { hat: 'quji', robe: 'round', sleeve: 'narrow', badge: 'flower', belt: 'horn', feet: 'boots', legs: null, beard: false, items: [] },
      palette: { robe: '#23506e', trim: '#c9a54a', hat: '#1f1d1a', belt: '#1a1714', boots: '#1f1b18', bootFace: '#a8322a', skin: '#e6c3a0', item: '#d9b44a' },
      costume: [
        { part: 'hat', name: '乌纱描金曲脚帽', note: '与正使相同的内使冠帽。', src: SRC.yufu },
        { part: 'robe', name: '盘领窄袖衫', note: '常服颜色因人而异，这里用青色与正使区别。', src: SRC.yufu },
        { part: 'belt', name: '乌角带', note: '', src: SRC.yufu },
        { part: 'boots', name: '红扇面黑下桩靴', note: '与正使相同。', src: SRC.yufu }
      ],
      caution: '颜色为示意，史料没有规定副使与正使服色的区别。名单见长乐《天妃灵应之记》碑。'
    },
    {
      id: 'commander', name: '都指挥', example: '朱真、王衡', rank: '都指挥使（正二品）、都指挥同知等',
      duty: '统领随行官军，负责护航、警戒与作战。',
      figure: { hat: 'wusha', robe: 'round', sleeve: 'wide', badge: 'lion', belt: 'rhino', feet: 'boots', legs: null, beard: true, items: ['sword'] },
      palette: { robe: '#a3352a', trim: '#d8b45a', hat: '#1f1d1a', belt: '#5a3b22', boots: '#1f1b18', skin: '#dcb48f', item: '#8a8f94' },
      costume: [
        { part: 'hat', name: '乌纱帽', note: '文武官员常服所戴，帽后两侧伸出平直的展角。', src: SRC.yufu },
        { part: 'robe', name: '团领衫', note: '圆领宽袖的常服，一至四品多用绯色。', src: SRC.yufu },
        { part: 'badge', name: '狮子补', note: '洪武二十四年（1391）定官员补子：武官一、二品用狮子。', src: SRC.huidian },
        { part: 'belt', name: '花犀带', note: '官员腰带以材质分品级：一品玉，二品花犀。', src: SRC.yufu },
        { part: 'boots', name: '皂靴', note: '', src: SRC.yufu },
        { part: 'weapon', name: '腰刀', note: '佩刀示其武职；临阵时换穿甲胄。', src: '示意' }
      ],
      caution: '这里画的是常服；作战时穿戴盔甲。'
    },
    {
      id: 'soldier', name: '旗军', example: '随船官军两万余人的主体', rank: '卫所军士',
      duty: '守船、警戒、登岸护卫与作战；锡兰山之战即以两千余官军奇袭王城。',
      figure: { hat: 'helmet', robe: 'pangao', sleeve: 'narrow', badge: null, belt: 'sash', feet: 'cloth', legs: 'wraps', beard: true, items: ['spear', 'gun'] },
      palette: { robe: '#b23a2b', trim: '#2c4a6a', hat: '#4b4f55', belt: '#2a2622', boots: '#3a3029', skin: '#d4a882', item: '#6d6f73' },
      costume: [
        { part: 'hat', name: '铁盔', note: '圆顶铁盔，盔顶有缨枪，后垂护颈。', src: '示意，参照明代盔甲实物' },
        { part: 'robe', name: '红胖袄', note: '"长齐膝，窄袖，内实以棉花"；明初军士多着红色，洪武时有以表里异色区分卫所的"鸳鸯战袄"。', src: SRC.yufu },
        { part: 'belt', name: '束腰布带', note: '', src: '示意' },
        { part: 'boots', name: '裹腿与布鞋', note: '', src: '示意' },
        { part: 'weapon', name: '长枪、手铳', note: '明初已普遍装备铜铁手铳；船上作战兼用冷兵器与火器。', src: '明代出土洪武、永乐年款手铳' }
      ],
      caution: '随船官军的具体装备没有专门记载，这里按明初卫所军士的一般形制示意。'
    },
    {
      id: 'pilot', name: '火长', example: '掌罗盘、针路的领航员', rank: '无品级',
      duty: '掌管罗盘、针路簿和更漏，决定航向，是船上最关键的技术人员。',
      figure: { hat: 'wangjin', robe: 'jacket', sleeve: 'narrow', badge: null, belt: 'sash', feet: 'cloth', legs: 'trousers', beard: true, items: ['compass', 'book'] },
      palette: { robe: '#4d5a52', trim: '#2f3a34', hat: '#1f1d1a', belt: '#2a2622', boots: '#3a3029', skin: '#c99b74', item: '#b8894a' },
      costume: [
        { part: 'hat', name: '网巾', note: '明代成年男子束发所用的网罩，洪武年间推行全国。', src: SRC.sancai },
        { part: 'robe', name: '短衣、长裤', note: '便于在甲板上行动的短衣。', src: '示意' },
        { part: 'item', name: '水罗盘、针簿', note: '水罗盘以磁针浮于水面指向；针簿记录各段航向与更数。', src: '《郑和航海图》针路' }
      ],
      caution: '《前闻记》列"火长"为船上人员名目之一；服饰为一般民间男子装束示意。'
    },
    {
      id: 'interpreter', name: '通事', example: '马欢、郭崇礼', rank: '无品级（一说马欢后任鸿胪寺序班）',
      duty: '翻译与交涉，记录各国风土。马欢通晓阿拉伯语，著《瀛涯胜览》。',
      figure: { hat: 'sifang', robe: 'cross', sleeve: 'wide', badge: null, belt: 'cord', feet: 'cloth', legs: null, beard: true, items: ['book'] },
      palette: { robe: '#2f5d6a', trim: '#1e3b44', hat: '#1f1d1a', belt: '#c9b48a', boots: '#2a2622', skin: '#dcb48f', item: '#d8c79a' },
      costume: [
        { part: 'hat', name: '四方平定巾', note: '洪武三年定为士人、庶民所戴的方巾。', src: SRC.yufu },
        { part: 'robe', name: '直身', note: '交领、宽袖的长衫，读书人的日常服装。', src: SRC.sancai },
        { part: 'belt', name: '丝绦', note: '腰间系绦。', src: SRC.sancai },
        { part: 'item', name: '簿册', note: '记录沿途见闻，后来写成《瀛涯胜览》《星槎胜览》等书。', src: '马欢《瀛涯胜览》自序' }
      ],
      caution: '马欢是浙江会稽的回族穆斯林；这里只画通事的一般士人装束。'
    },
    {
      id: 'physician', name: '医官', example: '随船医官、医士约一百八十人（一说）', rank: '医官、医士',
      duty: '为全军治病防疫；远洋航行中疾病是最大的威胁之一。',
      figure: { hat: 'sifang', robe: 'cross', sleeve: 'wide', badge: null, belt: 'cord', feet: 'cloth', legs: null, beard: true, items: ['medbox'] },
      palette: { robe: '#5d6b45', trim: '#3c4630', hat: '#1f1d1a', belt: '#c9b48a', boots: '#2a2622', skin: '#dcb48f', item: '#7a4f2a' },
      costume: [
        { part: 'hat', name: '四方平定巾', note: '', src: SRC.yufu },
        { part: 'robe', name: '直身', note: '', src: SRC.sancai },
        { part: 'item', name: '药箱', note: '盛放药材与针灸用具。', src: '示意' }
      ],
      caution: '"一百八十人"见于《郑和家谱》所列随行人员，其史源晚出，仅作参考；《前闻记》人员名目中列有"医士"。'
    },
    {
      id: 'sailor', name: '水手', example: '水手、舵工、班碇手等', rank: '无品级',
      duty: '操帆、掌舵、起落锚、缆绳与日常船务；《前闻记》分列舵工、班碇手、水手等名目。',
      figure: { hat: 'douli', robe: 'jacket', sleeve: 'narrow', badge: null, belt: 'sash', feet: 'bare', legs: 'rolled', beard: true, items: ['rope'] },
      palette: { robe: '#7a6a52', trim: '#5a4c39', hat: '#b89a5e', belt: '#3a3029', boots: '#3a3029', skin: '#b98a63', item: '#a4875a' },
      costume: [
        { part: 'hat', name: '斗笠', note: '竹编的宽檐笠，遮阳挡雨。', src: '示意' },
        { part: 'robe', name: '短褐', note: '粗布短衣，便于攀爬劳作。', src: '示意' },
        { part: 'boots', name: '卷起的裤腿、赤足', note: '甲板上赤足更稳。', src: '示意' },
        { part: 'item', name: '缆绳', note: '', src: '示意' }
      ],
      caution: '水手装束史无专门记载，按明代劳动者的一般形象示意。'
    }
  ];
  return { sources: SRC, roles: roles,
    note: '还原的是职官与身份的典型服饰，不是具体人物的相貌；颜色、纹样细节为示意。' };
})();
