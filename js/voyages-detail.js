/*
 * 航次档案数据 ZH_DETAIL（docs/SPEC.md §4.1）
 * 规则：n 只写史料中的数字；原文写"余"的 approx: true；史料未载的 n: null，界面显示"史料未载"。
 * results[].ev 引用 js/data.js 中 ZH.events 的 id。
 */
window.ZH_DETAIL = (function () {
  var UNKNOWN = { n: null, text: '史料未载', src: null };
  return {
    1: {
      personnel: {
        total: { n: 27800, approx: true, text: '将士卒二万七千八百余人', src: '《明史·郑和传》' },
        categories: null
      },
      officials: [
        { name: '郑和', title: '正使太监', role: '统领舟师', src: '《明史·郑和传》' },
        { name: '王景弘', title: '正使太监', role: '与郑和同领舟师', src: '《明史·郑和传》"和及其侪王景弘等"' }
      ],
      fleet: {
        total: { n: null, text: '总船数史无明载，今人估计在二百艘上下', src: null },
        large: { n: 62, text: '造大舶，修四十四丈、广十八丈者六十二', src: '《明史·郑和传》' },
        note: '"修四十四丈"的尺度历来有争议，见舰队复原页。'
      },
      results: [
        { kind: 'battle', text: '归途在旧港剿灭海盗陈祖义集团，生擒陈祖义，押回南京处斩', ev: 'chenzuyi', src: '《明太宗实录》' },
        { kind: 'conferral', text: '设旧港宣慰司，以当地华人首领施进卿为宣慰使', src: '《明史·三佛齐传》' },
        { kind: 'envoy', text: '古里等国使臣随船来朝', src: '《明太宗实录》' },
        { kind: 'other', text: '爪哇东西王内战中，船队官兵一百七十人被西王军队误杀，郑和未兴兵报复', ev: 'java', src: '《明史·爪哇传》' }
      ],
      sources: [
        { t: '永乐三年，统领舟师，往古里等国。时海寇陈祖义聚众三佛齐国，劫掠番商，亦来犯我舟师，即有神兵阴助，一鼓而殄灭之。至五年回。', s: '长乐《天妃灵应之记》碑' },
        { t: '自苏州刘家河泛海至福建，复自福建五虎门扬帆，首达占城，以次遍历诸番国，宣天子诏，因给赐其君长，不服则以武慑之。', s: '《明史·郑和传》' }
      ]
    },
    2: {
      personnel: { total: UNKNOWN, categories: null },
      officials: [
        { name: '郑和', title: '正使太监', role: '长乐碑列为郑和亲统；是否亲往，学界有不同看法', src: '长乐《天妃灵应之记》碑' },
        { name: '王景弘', title: '正使太监', role: '同领舟师', src: '长乐《天妃灵应之记》碑' }
      ],
      fleet: {
        total: { n: 249, text: '命都指挥汪浩改造海运船二百四十九艘，备使西洋诸国', src: '《明太宗实录》永乐五年九月', note: '为改造数，未必即出航数' },
        large: { n: null, text: '史料未载', src: null },
        note: ''
      },
      results: [
        { kind: 'conferral', text: '颁赐古里国王诰命银印，给赐头目冠带，建碑亭立石', ev: 'gulistele', src: '马欢《瀛涯胜览·古里国》' },
        { kind: 'tribute', text: '爪哇西王献黄金一万两谢罪，明成祖免除其余五万两', ev: 'javagold', src: '《明史·爪哇传》' },
        { kind: 'envoy', text: '分䑸赴暹罗，劝谕其与邻国和睦', src: '长乐《天妃灵应之记》碑列暹罗为本次所到之国' },
        { kind: 'other', text: '同期：1408 年浡泥国王麻那惹加那乃访华，病逝于南京', ev: 'boni', src: '《明史·浡泥传》' }
      ],
      sources: [
        { t: '永乐五年，统领舟师，往爪哇、古里、柯枝、暹罗等国，王各以珍宝、珍禽异兽贡献，至七年回还。', s: '长乐《天妃灵应之记》碑' },
        { t: '其国去中国十万余里，民物咸若，熙皞同风，刻石于兹，永示万世。', s: '古里碑文，见马欢《瀛涯胜览》' }
      ]
    },
    3: {
      personnel: {
        total: { n: 27000, approx: true, text: '统领官兵二万七千余人', src: '费信《星槎胜览》' },
        categories: null
      },
      officials: [
        { name: '郑和', title: '正使太监', role: '统领舟师', src: '费信《星槎胜览》' },
        { name: '王景弘', title: '正使太监', role: '同领舟师', src: '费信《星槎胜览》' },
        { name: '费信', title: '通事', role: '太仓卫军士，首次随行，后著《星槎胜览》', src: '费信《星槎胜览》自序' }
      ],
      fleet: {
        total: { n: 48, text: '驾驶海舶四十八号', src: '费信《星槎胜览》', note: '"号"指编号的大船，不含小型随行船只' },
        large: { n: 48, text: '海舶四十八号', src: '费信《星槎胜览》' },
        note: ''
      },
      results: [
        { kind: 'conferral', text: '册封满剌加首领拜里迷苏剌为王，建碑封城，满剌加从此摆脱暹罗控制', ev: 'malacca', src: '马欢《瀛涯胜览·满剌加国》' },
        { kind: 'stele', text: '在锡兰山佛寺布施，立汉文、泰米尔文、波斯文三语碑', ev: 'galle', src: '加勒《布施锡兰山佛寺碑》' },
        { kind: 'battle', text: '锡兰山之战：以两千余人奇袭王城，生擒国王亚烈苦奈儿及其家属', ev: 'ceylon', src: '《明史·锡兰山传》' },
        { kind: 'envoy', text: '满剌加国王拜里迷苏剌率妻子陪臣五百四十余人随船访华', ev: 'parameswara', src: '《明史·满剌加传》' }
      ],
      sources: [
        { t: '永乐七年，统领舟师，往前各国，道经锡兰山国，其王亚烈苦奈儿负固不恭，谋害舟师……遂生擒其王，至九年归献。寻蒙恩宥，俾归本国。', s: '长乐《天妃灵应之记》碑' },
        { t: '统领官兵二万七千余人，驾驶海舶四十八号，往诸番国开读赏赐。', s: '费信《星槎胜览》' }
      ]
    },
    4: {
      personnel: { total: UNKNOWN, categories: null },
      officials: [
        { name: '郑和', title: '正使太监', role: '统领舟师', src: '长乐《天妃灵应之记》碑' },
        { name: '王景弘', title: '正使太监', role: '同领舟师', src: '长乐《天妃灵应之记》碑' },
        { name: '马欢', title: '通事', role: '通晓阿拉伯语，首次随行，后著《瀛涯胜览》', src: '马欢《瀛涯胜览》自序' }
      ],
      fleet: { total: UNKNOWN, large: UNKNOWN, note: '' },
      results: [
        { kind: 'envoy', text: '首次越过印度，抵达波斯湾口的忽鲁谟斯', ev: 'hormuz', src: '马欢《瀛涯胜览》' },
        { kind: 'battle', text: '在苏门答剌击败并生擒作乱的苏干剌，押回京城处斩', ev: 'sekandar', src: '《明史·苏门答剌传》' },
        { kind: 'tribute', text: '榜葛剌使臣进献"麒麟"（长颈鹿）', ev: 'bengalqilin', src: '《明太宗实录》' },
        { kind: 'tribute', text: '麻林国遣使进献麒麟，明成祖亲临奉天门接受', ev: 'malindiqilin', src: '《明太宗实录》' },
        { kind: 'envoy', text: '满剌加国王亲率妻子朝贡', src: '长乐《天妃灵应之记》碑' }
      ],
      sources: [
        { t: '永乐十一年，统领舟师，往忽鲁谟斯等国。其苏门答剌国有伪王苏干剌寇侵本国，其王宰奴里阿比丁遣使赴阙陈诉，就率官兵剿捕……生擒伪王，至十三年归献。是年满剌加国王亲率妻子朝贡。', s: '长乐《天妃灵应之记》碑' }
      ]
    },
    5: {
      personnel: { total: UNKNOWN, categories: null },
      officials: [
        { name: '郑和', title: '钦差总兵太监', role: '统领舟师；途经泉州行香', src: '泉州"郑和行香碑"' },
        { name: '王景弘', title: '正使太监', role: '同领舟师', src: '长乐《天妃灵应之记》碑' }
      ],
      fleet: { total: UNKNOWN, large: UNKNOWN, note: '' },
      results: [
        { kind: 'envoy', text: '护送古里、爪哇、满剌加、占城、锡兰山、木骨都束、溜山、阿丹、忽鲁谟斯等十九国使臣回国', src: '《明太宗实录》永乐十四年十二月' },
        { kind: 'envoy', text: '分䑸船队横渡印度洋，抵达木骨都束、卜剌哇、麻林等东非城邦', ev: 'africa', src: '长乐《天妃灵应之记》碑' },
        { kind: 'conferral', text: '册封柯枝国王，封其国中之山为"镇国之山"，明成祖亲撰碑文', src: '《明史·柯枝传》' },
        { kind: 'tribute', text: '忽鲁谟斯、阿丹、木骨都束、卜剌哇等国进献狮子、金钱豹、麒麟、花福禄（斑马）、驼鸡（鸵鸟）等', ev: 'beasts', src: '长乐《天妃灵应之记》碑' },
        { kind: 'stele', text: '途经泉州，至灵山圣墓行香，立碑为记', ev: 'quanzhou', src: '泉州"郑和行香碑"' }
      ],
      sources: [
        { t: '永乐十五年，统领舟师，往西域。其忽鲁谟斯国进狮子、金钱豹、大西马；阿丹国进麒麟，番名祖剌法，并长角马哈兽；木骨都束国进花福禄，并狮子；卜剌哇国进千里骆驼，并驼鸡。', s: '长乐《天妃灵应之记》碑' }
      ]
    },
    6: {
      personnel: { total: UNKNOWN, categories: null },
      officials: [
        { name: '郑和', title: '正使太监', role: '统领舟师；本人具体行程史载不详', src: '长乐《天妃灵应之记》碑' },
        { name: '周满', title: '太监', role: '率分䑸赴阿丹等国（《明史》称"中官周姓者"）', src: '《明史·阿丹传》' },
        { name: '马欢', title: '通事', role: '第二次随行', src: '马欢《瀛涯胜览》' }
      ],
      fleet: { total: UNKNOWN, large: UNKNOWN, note: '船队在苏门答剌等地分为多支䑸队。' },
      results: [
        { kind: 'envoy', text: '护送忽鲁谟斯等十六国使臣回国', src: '《明太宗实录》永乐十九年正月' },
        { kind: 'trade', text: '分䑸至阿丹，买得猫睛石、珊瑚、珍珠等宝货，以及麒麟、狮子、花福禄、金钱豹、驼鸡等', src: '马欢《瀛涯胜览·阿丹国》' },
        { kind: 'envoy', text: '暹罗、苏门答剌、阿丹等国使臣随船来朝', src: '《明太宗实录》永乐二十年八月' },
        { kind: 'other', text: '同期：北京正式成为京师；三殿火灾后明成祖下诏暂停下西洋等事务', ev: 'beijing', src: '《明太宗实录》' }
      ],
      sources: [
        { t: '永乐十九年，统领舟师，遣忽鲁谟斯等国使臣久侍京师者悉还本国。其各国王贡献方物，视前益加。', s: '长乐《天妃灵应之记》碑' }
      ]
    },
    7: {
      personnel: {
        total: { n: 27550, approx: false, text: '共二万七千五百五十员名', src: '祝允明《前闻记》' },
        categories: ['官校', '旗军', '火长', '舵工', '班碇手', '通事', '办事', '书算手', '医士', '铁锚匠', '木艌匠', '搭材匠', '水手', '民稍人']
      },
      officials: [
        { name: '郑和', title: '正使太监', role: '统领舟师；归途病逝于古里一带', src: '长乐《天妃灵应之记》碑落款' },
        { name: '王景弘', title: '正使太监', role: '郑和去世后率船队返航（一般认为）', src: '长乐《天妃灵应之记》碑落款' },
        { name: '李兴、朱良、周满、洪保、杨真、张达、吴忠', title: '副使太监', role: '分领䑸队；洪保分䑸至古里，遣通事七人赴天方', src: '长乐《天妃灵应之记》碑落款；马欢《瀛涯胜览·天方国》' },
        { name: '朱真、王衡', title: '都指挥', role: '统领官军', src: '长乐《天妃灵应之记》碑落款' },
        { name: '马欢、费信、巩珍', title: '通事、幕僚', role: '随行记录，分别著《瀛涯胜览》《星槎胜览》《西洋番国志》', src: '各书自序' }
      ],
      fleet: {
        total: UNKNOWN,
        large: { n: null, text: '船名有"清和""惠康""长宁""安济""清远"等，又以一、二等编号', src: '祝允明《前闻记》' },
        note: ''
      },
      results: [
        { kind: 'stele', text: '在刘家港天妃宫立《通番事迹记》碑，在长乐南山立《天妃灵应之记》碑，追记七次航程', ev: 'changlestele', src: '两碑碑文' },
        { kind: 'envoy', text: '抵达忽鲁谟斯；分䑸船队到达榜葛剌、阿拉伯半岛和东非', src: '祝允明《前闻记》；《明史·郑和传》' },
        { kind: 'envoy', text: '太监洪保在古里遣通事等七人附当地船只赴天方（麦加），往回一年', ev: 'mecca', src: '马欢《瀛涯胜览·天方国》' },
        { kind: 'envoy', text: '古里、苏门答剌、天方等多国使臣随船来朝', src: '《明宣宗实录》宣德八年' },
        { kind: 'other', text: '郑和于归途中病逝于古里一带', ev: 'death', src: '一般认为；另有回国后去世之说' }
      ],
      // 《前闻记》逐日记录：arr 到港，dep 开船（公历，儒略历）
      log: [
        { p: 'nanjing', dep: '1431-01-19' },
        { p: 'liujiagang', arr: '1431-02-03' },
        { p: 'changle', arr: '1431-04-08', dep: '1432-01-12', note: '在长乐驻泊候风；十二月初九出五虎门' },
        { p: 'zhancheng', arr: '1432-01-27', dep: '1432-02-12' },
        { p: 'zhaowa', arr: '1432-03-07', dep: '1432-07-13' },
        { p: 'jiugang', arr: '1432-07-24', dep: '1432-07-27' },
        { p: 'manlajia', arr: '1432-08-03', dep: '1432-09-02' },
        { p: 'sumendala', arr: '1432-09-12', dep: '1432-11-02' },
        { p: 'xilanshan', arr: '1432-11-28', dep: '1432-12-02' },
        { p: 'guli', arr: '1432-12-10', dep: '1432-12-14' },
        { p: 'huluomosi', arr: '1433-01-17', dep: '1433-03-09' },
        { p: 'guli', arr: '1433-03-31', dep: '1433-04-09' },
        { p: 'sumendala', arr: '1433-04-25', dep: '1433-05-01' },
        { p: 'manlajia', arr: '1433-05-09', dep: '1433-05-28' },
        { p: 'zhancheng', arr: '1433-06-17', dep: '1433-06-19' },
        { p: 'liujiagang', arr: '1433-07-07' },
        { p: 'nanjing', arr: '1433-07-22' }
      ],
      sources: [
        { t: '帝以践阼岁久，而诸番国远者犹未朝贡，于是和、景弘复奉命历忽鲁谟斯等十七国而还。', s: '《明史·郑和传》' },
        { t: '官校、旗军、火长、舵工、班碇手、通事、办事、书算手、医士、铁锚、木艌、搭材等匠，水手、民稍人等，共二万七千五百五十员名。', s: '祝允明《前闻记》' }
      ]
    }
  };
})();
