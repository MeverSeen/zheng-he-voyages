/*
 * 共用页眉：栏目导航与昼夜切换。各页面在 <body data-page="…"> 上写本页 id，
 * 页眉里放 <div class="mast-actions"><button id="theme-toggle">…</button></div>，其余由本脚本生成。
 * 切换昼夜时在 window 上派发 'zh:theme' 事件（detail.dark 为布尔值），供需要重绘的页面监听。
 */
(function () {
  'use strict';
  // ready: false 的页面尚未完成，不出现在导航中（完成一个就改一个，见 docs/ROADMAP.md）
  var PAGES = [
    { id: 'map', href: 'index.html', name: '航海图' },
    { id: 'world', href: 'world.html', name: '天下全图' },
    { id: 'voyages', href: 'voyages.html', name: '航次档案' },
    { id: 'fleet', href: 'fleet.html', name: '舰队复原' },
    { id: 'people', href: 'people.html', name: '人物复原', ready: false }
  ];
  var root = document.documentElement;

  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem('zh:' + k);
      window.localStorage.setItem('zh:' + k, v);
    } catch (e) { return null; }
  }
  // 尽早应用保存的配色，避免闪烁
  var saved = store('theme');
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);

  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function mount() {
    var head = document.querySelector('.masthead');
    if (!head) return;
    var current = document.body.getAttribute('data-page');
    var pages = PAGES.filter(function (p) { return p.ready !== false || p.id === current; });
    if (pages.length > 1) {
      var nav = document.createElement('nav');
      nav.className = 'site-nav';
      nav.setAttribute('aria-label', '栏目');
      nav.innerHTML = pages.map(function (p) {
        return '<a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : '') + '>' + p.name + '</a>';
      }).join('');
      head.insertBefore(nav, head.querySelector('.mast-actions'));
    }
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var sync = function () { btn.textContent = isDark() ? '昼航' : '夜航'; };
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store('theme', next);
      sync();
      window.dispatchEvent(new CustomEvent('zh:theme', { detail: { dark: next === 'dark' } }));
    });
    sync();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', function () {
        sync();
        window.dispatchEvent(new CustomEvent('zh:theme', { detail: { dark: isDark() } }));
      });
    }
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  window.ZHNav = { pages: PAGES, isDark: isDark, store: store };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
