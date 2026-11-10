/* Plain-script data rendering survives a missing WebGL context or module loader. */
(function () {
  const F = window.ZH_FLEET,
    $ = (id) => document.getElementById(id);
  const NUM = ['', '一', '二', '三', '四', '五', '六', '七'];
  function esc(s) {
    return String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }
  function link(id) {
    const s = F.sources[id];
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>';
  }
  $('caution').textContent = F.caution;
  $('source-list').innerHTML = Object.entries(F.sources)
    .map(([id, s]) => '<article>' + link(id) + '<p>' + esc(s.note) + '</p></article>')
    .join('');
  Object.entries(F.types).forEach(([id, s]) => {
    for (const key of ['ship-type', 'ship-filter']) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = s.name;
      $(key).appendChild(o);
    }
  });
  for (let n = 1; n <= 7; n++) {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = '第' + NUM[n] + '次';
    $('voyage').appendChild(o);
  }
  $('part-list').innerHTML = F.parts
    .map(
      (p, index) =>
        '<button data-part="' +
        p.id +
        '"><span class="part-number" aria-hidden="true">' +
        (index + 1) +
        '</span>' +
        p.name +
        '</button>',
    )
    .join('');
  let refined = false,
    selectedPart = 'hull',
    selectedShip = 'baochuan',
    selectedVariant = 'estimated';
  function part(id) {
    selectedPart = id;
    const base = F.parts.find((p) => p.id === id) || F.parts[0],
      p = { ...base, ...(refined ? F.refinedPartsByType?.[selectedShip]?.[base.id] : {}) };
    let text = p.text;
    if (base.id === 'rudder') {
      const ship = F.types[selectedShip],
        variant = ship.variants[selectedVariant] || ship.variants.estimated,
        draft = variant.draft ?? ship.model.draft,
        freeboard = variant.freeboard ?? ship.model.freeboard,
        stock = freeboard + variant.L * 0.045 + 1.05 + draft * 1.42;
      text += ' 当前所选模型的舵杆长度为 ' + stock.toFixed(2) + ' 米。';
      if (!text.includes('11.07'))
        text += ' 1957年南京宝船厂遗址出土铁力木舵杆长11.07米；与本页两套尺度的对应关系未定，不能据此反推船长。';
    }
    $('part-detail').innerHTML =
      '<h4>' + p.name + '</h4><p>' + text + '</p><p class="source-link">依据：' + link(p.src) + '</p>';
    document
      .querySelectorAll('[data-part]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.part === p.id)));
  }
  function ship(id, variant, options = {}) {
    refined = !!options.refined;
    selectedShip = id;
    selectedVariant = variant;
    part(selectedPart);
    const s = F.types[id],
      v = s.variants[variant] || s.variants.estimated;
    $('info-title').textContent = s.name;
    $('model-name').textContent = s.name;
    $('model-dimensions').textContent = v.L.toFixed(1) + ' × ' + v.B.toFixed(1) + ' 米 · ' + v.label;
    $('ship-facts').innerHTML =
      '<span class="badge">' +
      v.evidence +
      '</span><p>' +
      s.role +
      '</p><dl class="facts"><div><dt>船体长</dt><dd>' +
      v.L.toFixed(1) +
      ' m</dd></div><div><dt>最大船宽</dt><dd>' +
      v.B.toFixed(1) +
      ' m</dd></div><div><dt>长宽比</dt><dd>' +
      (v.L / v.B).toFixed(2) +
      ' : 1</dd></div><div><dt>展示桅数</dt><dd>' +
      s.model.masts +
      '</dd></div><div><dt>示意隔舱</dt><dd>' +
      s.model.compartments +
      '</dd></div></dl><p>' +
      s.model.basis +
      '</p><p>帆装：非等距桅位与大小主帆为展示假设，尚无证据确认与所选尺度配套。</p><p>示意吃水 ' +
      (v.draft ?? s.model.draft).toFixed(2) +
      ' m · 舷中干舷 ' +
      (v.freeboard ?? s.model.freeboard).toFixed(2) +
      ' m。' +
      (v.sectionNote || '横剖面深度为建模假设。') +
      '</p><p>尺度依据：' +
      link(v.src) +
      '</p>' +
      (id === 'baochuan' && variant === 'recorded'
        ? '<p>44 丈 × 18 丈；本项目按 1 尺 = 0.311 米折算。不同尺制会改变结果，此处并非实船测量。</p>'
        : '');
  }
  function fleet(n, mode, count) {
    refined = false;
    part(selectedPart);
    const v = F.voyages[n];
    $('info-title').textContent = '第' + NUM[n] + '次船队';
    $('model-name').textContent = '第' + NUM[n] + '次船队';
    $('model-dimensions').textContent =
      mode === 'recorded' && !v.recorded.n
        ? '船数史料未载'
        : count + ' 艘展示模型 · ' + (mode === 'recorded' ? '记载数量' : '假设编成');
    $('fleet-facts').innerHTML =
      '<span class="badge">' +
      (mode === 'recorded' ? (v.recorded.n ? '数量有据 · 船形示意' : '船数史料未载') : '假设编成') +
      '</span><p>' +
      esc(v.recorded.text) +
      '</p><p>' +
      esc(v.recorded.scope) +
      '</p><p>' +
      esc(v.recorded.src || '船数史料未载') +
      '</p><p>' +
      (mode === 'recorded'
        ? '重复船形只作为计数符号，不能据此认定这些船均为同一宝船型号。未记载的其他船只不补数。'
        : esc(v.basis)) +
      '</p>' +
      (mode === 'estimated' ? '<p>宝船 10 · 马船 40 · 粮船 80 · 坐船 80 · 战船 40</p>' : '') +
      '<p>' +
      (mode === 'recorded' && !v.recorded.n
        ? '不以零艘代替未知船数。'
        : '当前筛选显示 ' + count + ' 艘。船列为观察布局，不是历史阵法。') +
      '</p><p><a href="voyages.html#v' +
      n +
      '">阅读该次航行档案 →</a></p>';
  }
  $('part-list').addEventListener('click', (e) => {
    const button = e.target.closest?.('button[data-part]');
    if (button) {
      part(button.dataset.part);
      window.dispatchEvent(new CustomEvent('fleet:part', { detail: button.dataset.part }));
    }
  });
  $('ship-type').addEventListener('change', () => {
    if (!window.ZHFleetReady) ship($('ship-type').value, $('variant').value);
  });
  $('variant').addEventListener('change', () => {
    if (!window.ZHFleetReady) ship($('ship-type').value, $('variant').value);
  });
  window.ZHFleetInfo = { ship, part, fleet };
  ship('baochuan', 'estimated');
  part('hull');
  setTimeout(() => {
    if (!window.ZHFleetReady)
      $('scene-message').textContent =
        '三维模块未能启动。请通过本地服务打开，或使用 dist/fleet.html 离线版；船型资料仍可查看。';
  }, 12000);
})();
