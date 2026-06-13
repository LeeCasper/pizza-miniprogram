// 忌口选项
const dietaryRestrictions = [
  { key: 'no_spicy', label: '不吃辣' },
  { key: 'no_garlic', label: '不吃蒜' },
  { key: 'no_onion', label: '不吃洋葱' },
  { key: 'no_cilantro', label: '不吃香菜' },
  { key: 'vegetarian', label: '素食' },
  { key: 'peanut_allergy', label: '花生过敏' },
  { key: 'dairy_allergy', label: '牛奶过敏' },
  { key: 'seafood_allergy', label: '海鲜过敏' },
  { key: 'gluten_allergy', label: '麸质过敏' }
];

// 商品数据
const products = [
  {
    id: 1,
    name: '经典玛格丽特',
    desc: '意式经典风味',
    detailDesc: '源自意大利那不勒斯的经典披萨，以圣马扎诺番茄酱为底，铺满新鲜莫扎瑞拉芝士与罗勒叶，淋上特级初榨橄榄油，简单纯粹却回味无穷。',
    price: 68,
    category: 'pizza',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv',
    tag: '经典',
    size: '9寸 / 12寸',
    ingredients: ['圣马扎诺番茄', '莫扎瑞拉芝士', '新鲜罗勒', '特级橄榄油', '手工面团']
  },
  {
    id: 2,
    name: '招牌榴莲饼',
    desc: '纯正榴莲果肉爆浆',
    detailDesc: '选用泰国金枕头榴莲，果肉饱满绵密，搭配酥脆手工饼皮，一口咬下榴莲果肉如熔岩般涌出，榴莲控的终极幸福。',
    price: 32,
    category: 'durian',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI',
    tag: '爆款',
    size: '标准',
    ingredients: ['泰国金枕头榴莲', '黄油酥皮', '芝士', '鸡蛋', '小麦粉']
  },
  {
    id: 3,
    name: '手工凤梨酥',
    desc: '台式经典 酥香不腻',
    detailDesc: '传承台湾古法工艺，以新鲜凤梨慢火熬制内馅，包裹在黄金比例的酥皮中，外层酥脆内里酸甜，每一口都是匠心手作的温度。',
    price: 28,
    category: 'pineapple',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0',
    tag: '招牌',
    size: '4枚装 / 8枚装',
    ingredients: ['新鲜凤梨', '黄油', '低筋面粉', '鸡蛋', '麦芽糖']
  },
  {
    id: 4,
    name: '至尊牛肉披萨',
    desc: '精选牛脊肉 搭配芝士',
    detailDesc: '精选安格斯牛脊肉，经慢火炖煮后切片铺满饼面，搭配三种芝士熔岩交融，佐以焦糖洋葱与黑松露油，肉食爱好者的终极盛宴。',
    price: 88,
    category: 'pizza',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH',
    tag: '新品',
    size: '9寸 / 12寸',
    ingredients: ['安格斯牛脊肉', '莫扎瑞拉芝士', '切达芝士', '帕玛森芝士', '焦糖洋葱', '黑松露油']
  },
  {
    id: 5,
    name: '夏威夷风情披萨',
    desc: '菠萝配火腿 酸甜可口',
    detailDesc: '帕尔玛火腿薄如蝉翼，搭配菲律宾金菠萝的天然酸甜，芝士的奶香与果香交织，热带风情在口腔绽放，清爽不腻的夏日首选。',
    price: 72,
    category: 'pizza',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv',
    size: '9寸 / 12寸',
    ingredients: ['帕尔玛火腿', '菲律宾菠萝', '莫扎瑞拉芝士', '番茄酱', '手工面团']
  },
  {
    id: 6,
    name: '猫山王榴莲饼',
    desc: '马来西亚猫山王 浓郁加倍',
    detailDesc: '马来西亚直供猫山王榴莲，果肉金黄绵密，苦甜层次分明，搭配千层酥皮与马士卡彭奶酪，将榴莲的浓郁推向极致，限定季节臻品。',
    price: 48,
    category: 'durian',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI',
    tag: '限定',
    size: '标准',
    ingredients: ['猫山王榴莲', '马士卡彭奶酪', '千层酥皮', '鸡蛋', '小麦粉']
  },
  {
    id: 7,
    name: '抹茶凤梨酥',
    desc: '日式抹茶风味 清新回甘',
    detailDesc: '日本宇治抹茶融入酥皮，翠绿色泽与清新茶香相得益彰，搭配手工熬制的酸甜凤梨馅，茶香果酸的完美平衡，一口入魂的东方美学。',
    price: 32,
    category: 'pineapple',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0',
    size: '4枚装 / 8枚装',
    ingredients: ['宇治抹茶', '新鲜凤梨', '黄油', '低筋面粉', '麦芽糖']
  }
];

// 商品分类配置
const categories = [
  { key: 'all', name: '全部商品', icon: '/images/all-products.png' },
  { key: 'pizza', name: '披萨', icon: '/images/pizza.png' },
  { key: 'durian', name: '榴莲饼', icon: '/images/durian-cake.png' },
  { key: 'pineapple', name: '凤梨酥', icon: '/images/pineapple-cake.png' }
];

// 模拟订单数据
const orders = [
  {
    id: '20240612001',
    status: 'completed',
    statusText: '已完成',
    items: [
      { name: '经典玛格丽特', qty: 1, price: 68 },
      { name: '招牌榴莲饼', qty: 2, price: 32 }
    ],
    total: 132,
    time: '2024-06-12 18:30',
    store: '爱家店',
    pickupCode: '3829'
  },
  {
    id: '20240612002',
    status: 'preparing',
    statusText: '制作中',
    items: [{ name: '至尊牛肉披萨', qty: 1, price: 88 }],
    total: 88,
    time: '2024-06-12 19:15',
    store: '爱家店',
    pickupCode: '5614'
  },
  {
    id: '20240612003',
    status: 'waiting',
    statusText: '待取餐',
    items: [
      { name: '夏威夷风情披萨', qty: 1, price: 72 },
      { name: '抹茶凤梨酥', qty: 1, price: 32 }
    ],
    total: 104,
    time: '2024-06-12 19:45',
    store: '爱家店',
    pickupCode: '7190'
  },
  {
    id: '20240611001',
    status: 'completed',
    statusText: '已完成',
    items: [
      { name: '手工凤梨酥', qty: 2, price: 28 },
      { name: '猫山王榴莲饼', qty: 1, price: 48 }
    ],
    total: 104,
    time: '2024-06-11 12:00',
    store: '爱家店',
    pickupCode: '2047'
  }
];

// 积分商城商品
const pointsProducts = [
  {
    id: 101,
    name: '经典玛格丽特兑换券',
    desc: '免费兑换一张经典玛格丽特披萨',
    detailDesc: '凭此兑换券可到门店免费领取一张经典玛格丽特披萨。源自意大利那不勒斯的经典风味，圣马扎诺番茄酱、莫扎瑞拉芝士与新鲜罗勒的完美组合，简单纯粹却回味无穷。',
    points: 500,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv',
    stock: 50,
    tag: '热门',
    highlights: ['价值 ¥68', '经典玛格丽特披萨 ×1', '到店兑换', '有效期 30 天']
  },
  {
    id: 102,
    name: '买一赠一券',
    desc: '任意披萨买一赠一',
    detailDesc: '购买任意一款披萨即可免费获赠同款或更低价格披萨一份。无论是经典玛格丽特还是至尊牛肉披萨，与好友分享双倍美味，聚会必备神券。',
    points: 800,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH',
    stock: 20,
    tag: '超值',
    highlights: ['任意披萨适用', '赠送同等或更低价格披萨', '到店兑换', '有效期 60 天']
  },
  {
    id: 103,
    name: '榴莲饼半价券',
    desc: '招牌榴莲饼享半价优惠',
    detailDesc: '使用此券可享受招牌榴莲饼半价优惠。选用泰国金枕头榴莲，果肉饱满绵密，搭配酥脆手工饼皮，一口咬下榴莲果肉如熔岩般涌出，榴莲控不可错过的福利。',
    points: 300,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI',
    stock: 100,
    tag: '划算',
    highlights: ['招牌榴莲饼半价', '原价 ¥32，立省 ¥16', '到店兑换', '有效期 30 天']
  },
  {
    id: 104,
    name: '专属马克杯',
    desc: '王姐手工披萨定制马克杯',
    detailDesc: '王姐手工披萨品牌定制马克杯，高品质陶瓷材质，容量 380ml。杯身印有品牌经典logo与手绘披萨图案，简约不失趣味。办公室、居家必备，让每一口咖啡都想起披萨的香气。',
    points: 1200,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0',
    stock: 15,
    tag: '实物',
    highlights: ['陶瓷材质', '容量 380ml', '品牌定制图案', '到店领取']
  },
  {
    id: 105,
    name: '免配送费券',
    desc: '免费配送一次',
    detailDesc: '使用此券可免除一次外卖配送费用。无论是恶劣天气还是深夜馋虫，我们都免费为您送达。适用于所有配送范围内的订单，让美味零距离。',
    points: 200,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH',
    stock: 200,
    tag: '实用',
    highlights: ['免除配送费', '所有配送订单适用', '自动抵扣', '有效期 90 天']
  },
  {
    id: 106,
    name: '季度限定礼盒',
    desc: '手工披萨主题礼品盒 含3款经典口味',
    detailDesc: '每季度限定的手工披萨主题礼品盒，内含3款经典口味披萨半成品套装，附赠独家配方卡与品牌定制烤盘。精选当季新鲜食材，在家也能烤出店铺级美味，送礼自用两相宜。',
    points: 2000,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv',
    stock: 10,
    tag: '限量',
    highlights: ['3款经典口味半成品套装', '附赠配方卡 + 定制烤盘', '季度限定款式', '到店领取或快递配送']
  }
];

// 用户兑换券 & 优惠券数据
const coupons = [
  // ---- 兑换券 ----
  {
    id: 201,
    name: '经典玛格丽特兑换券',
    desc: '免费兑换一张经典玛格丽特披萨',
    detailDesc: '凭此兑换券可到门店免费领取一张经典玛格丽特披萨。源自意大利那不勒斯的经典风味，圣马扎诺番茄酱、莫扎瑞拉芝士与新鲜罗勒的完美组合。',
    category: 'redeem',        // 兑换券
    categoryLabel: '兑换券',
    typeIcon: '🎫',
    value: '免费兑换',
    source: '积分商城兑换',
    validFrom: '2024-06-01',
    validTo: '2024-07-01',
    status: 'available',
    usedAt: null,
    code: 'MK2024D101',
    color: '#D32F2F',
    // 兑换券专属：兑换商品信息
    redeemProduct: {
      name: '经典玛格丽特披萨',
      price: 68,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv'
    },
    useTip: '到店出示券码即可兑换，制作约需 15-20 分钟'
  },
  {
    id: 206,
    name: '季度限定礼盒券',
    desc: '手工披萨主题礼品盒 含3款经典口味',
    detailDesc: '手工披萨主题礼品盒，内含3款经典口味披萨半成品套装，附赠独家配方卡与品牌定制烤盘。每季度限量发售，送礼自用两相宜。',
    category: 'redeem',
    categoryLabel: '兑换券',
    typeIcon: '🎁',
    value: '免费兑换',
    source: '积分商城兑换',
    validFrom: '2024-04-01',
    validTo: '2024-05-01',
    status: 'expired',
    usedAt: null,
    code: 'GX2024Q106',
    color: '#B71C1C',
    redeemProduct: {
      name: '季度限定礼盒',
      price: 199,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv'
    },
    useTip: '到店出示券码即可领取'
  },

  // ---- 优惠券 ----
  {
    id: 202,
    name: '买一赠一券',
    desc: '任意披萨买一赠一',
    detailDesc: '购买任意一款披萨即可免费获赠同款或更低价格披萨一份。无论是经典玛格丽特还是至尊牛肉披萨，与好友分享双倍美味，聚会必备神券。',
    category: 'discount',       // 优惠券
    categoryLabel: '优惠券',
    typeIcon: '🏷️',
    value: '买一赠一',
    discountType: 'buy_one_get_one',
    discountValue: '赠同款或低价披萨 ×1',
    minSpend: 68,
    source: '积分商城兑换',
    validFrom: '2024-06-10',
    validTo: '2024-08-10',
    status: 'available',
    usedAt: null,
    code: 'BO2024G102',
    color: '#E67E22',
    useTip: '下单时勾选此券即可享受优惠，不可与其他优惠叠加'
  },
  {
    id: 203,
    name: '免配送费券',
    desc: '免费配送一次',
    detailDesc: '使用此券可免除一次外卖配送费用。无论是恶劣天气还是深夜馋虫，我们都免费为您送达。适用于所有配送范围内的订单，让美味零距离。',
    category: 'discount',
    categoryLabel: '优惠券',
    typeIcon: '🚚',
    value: '免配送费',
    discountType: 'free_delivery',
    discountValue: '配送费全免',
    minSpend: 0,
    source: '积分商城兑换',
    validFrom: '2024-06-15',
    validTo: '2024-09-15',
    status: 'available',
    usedAt: null,
    code: 'FD2024G105',
    color: '#2E7D32',
    useTip: '下单时自动抵扣配送费用，全场订单通用'
  },
  {
    id: 204,
    name: '榴莲饼半价券',
    desc: '招牌榴莲饼享半价优惠',
    detailDesc: '招牌榴莲饼半价优惠。选用泰国金枕头榴莲，果肉饱满绵密，一口咬下如熔岩般涌出，榴莲控不可错过的福利。',
    category: 'discount',
    categoryLabel: '优惠券',
    typeIcon: '🏷️',
    value: '半价',
    discountType: 'half_price',
    discountValue: '招牌榴莲饼 5 折',
    minSpend: 0,
    source: '积分商城兑换',
    validFrom: '2024-05-20',
    validTo: '2024-06-20',
    status: 'used',
    usedAt: '2024-06-08 14:30',
    code: 'HP2024D103',
    color: '#8E24AA',
    useTip: '仅限招牌榴莲饼使用'
  },
  {
    id: 205,
    name: '新人专享券',
    desc: '首单立减 ¥15',
    detailDesc: '新用户首次下单专享优惠，满 ¥50 立减 ¥15。欢迎加入王姐手工披萨大家庭！',
    category: 'discount',
    categoryLabel: '优惠券',
    typeIcon: '🎉',
    value: '¥15',
    discountType: 'fixed_amount',
    discountValue: '立减 ¥15',
    minSpend: 50,
    source: '新用户注册赠送',
    validFrom: '2024-01-01',
    validTo: '2024-02-01',
    status: 'expired',
    usedAt: null,
    code: 'NEW20240115',
    color: '#757575',
    useTip: '新用户首单专享，满 ¥50 可用'
  }
];

// 收货地址
const addresses = [
  {
    id: 'addr_1',
    name: '乔丹·泰勒',
    phone: '13888888888',
    region: ['北京市', '北京市', '朝阳区'],
    detail: '建国路88号SOHO现代城A座1208室',
    isDefault: true,
    tag: '公司'
  },
  {
    id: 'addr_2',
    name: '乔丹',
    phone: '13999999999',
    region: ['上海市', '上海市', '浦东新区'],
    detail: '世纪大道100号环球金融中心32层',
    isDefault: false,
    tag: '家'
  },
  {
    id: 'addr_3',
    name: '小王',
    phone: '13777777777',
    region: ['广东省', '广州市', '天河区'],
    detail: '体育西路191号中石化大厦B座15层',
    isDefault: false,
    tag: '学校'
  }
];

module.exports = {
  products,
  categories,
  orders,
  pointsProducts,
  dietaryRestrictions,
  coupons,
  addresses
};
