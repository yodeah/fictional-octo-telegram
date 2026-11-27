'use strict';

// Scenes seen through your own eyes, and the strangers who stop you. Drawn as inline SVG: no image files.
const Art = (() => {
  const svg = (body, label) => '<svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + label + '">' + body + '</svg>';
  const rect = (x, y, w, h, fill, extra = '') => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" ' + extra + '/>';
  const circle = (x, y, r, fill, extra = '') => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" ' + extra + '/>';
  const path = (d, fill, extra = '') => '<path d="' + d + '" fill="' + fill + '" ' + extra + '/>';
  const sky = (id, top, bottom) => '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/></linearGradient></defs>' + rect(0, 0, 400, 190, 'url(#' + id + ')');
  // Your own two hands at the bottom of the view.
  const hands = (extra = '') => path('M20 190 C40 150 70 150 92 160 L112 154 L118 162 L98 170 L120 172 L118 180 L96 180 L84 190Z', '#a9714c')
    + path('M380 190 C360 150 330 150 308 160 L288 154 L282 162 L302 170 L280 172 L282 180 L304 180 L316 190Z', '#a9714c') + extra;
  const person = (x, y, skin, cloth, extra = '') => path('M' + (x - 44) + ' ' + (y + 90) + ' Q' + x + ' ' + (y + 4) + ' ' + (x + 44) + ' ' + (y + 90) + 'Z', cloth)
    + circle(x, y, 24, skin) + circle(x - 8, y - 3, 2.6, '#1d130d') + circle(x + 8, y - 3, 2.6, '#1d130d') + extra;
  const torch = x => rect(x - 3, 60, 6, 38, '#4a3222') + path('M' + x + ' 32 Q' + (x + 16) + ' 52 ' + x + ' 66 Q' + (x - 16) + ' 52 ' + x + ' 32', '#ff9a3d') + circle(x, 54, 6, '#ffe28a');

  const scenes = {
    beach: () => svg(sky('b', '#24344a', '#c9825a') + circle(300, 86, 22, '#ffcf8a')
      + rect(0, 104, 400, 40, '#2f5a68') + path('M0 118 q50 -8 100 0 t100 0 t100 0 t100 0', 'none', 'stroke="#9cc4c4" stroke-width="2" opacity=".6"')
      + path('M70 130 L96 44 L102 46 L84 132Z', '#2b1c12') + path('M96 48 L150 62 L112 96Z', '#d8c8a8', 'opacity=".75"')
      + path('M40 138 Q90 112 150 134 L138 148 L56 150Z', '#3a2618') + rect(0, 140, 400, 50, '#c9a56a')
      + rect(210, 148, 40, 8, '#5a3d26', 'transform="rotate(14 230 152)"') + rect(262, 160, 26, 7, '#5a3d26', 'transform="rotate(-22 275 163)"') + hands(), 'A wrecked ship on a beach, seen from the sand'),
    yard: () => svg(sky('y', '#4a3a52', '#d99a63') + rect(0, 70, 400, 70, '#7a5a44') + Array.from({ length: 9 }, (_, i) => rect(i * 48, 58, 26, 14, '#7a5a44')).join('')
      + path('M170 140 V96 a30 30 0 0 1 60 0 V140Z', '#2a1a12') + rect(0, 140, 400, 50, '#b8905c') + torch(140) + torch(260)
      + person(200, 104, '#b07650', '#6d2c25', path('M176 94 Q200 66 224 94', 'none', 'stroke="#c9c2b0" stroke-width="7"')), 'The lanista waits in the yard'),
    market: () => svg(rect(0, 0, 400, 190, '#3b281b') + path('M0 0 H400 V34 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0 q-25 20 -50 0Z', '#8e3b2c')
      + rect(34, 56, 6, 80, '#c9c2b0') + path('M30 56 L37 40 L44 56Z', '#c9c2b0') + circle(86, 92, 28, '#8a6a3c') + circle(86, 92, 9, '#d9b26a')
      + rect(320, 52, 7, 84, '#9aa0a4') + rect(306, 108, 35, 6, '#6b4a2a') + path('M350 62 q30 6 22 36 l-22 -8Z', '#b8bcc0')
      + person(200, 82, '#c58e68', '#4d5c3a', path('M182 94 q18 22 36 0 q-4 30 -18 32 q-14 -2 -18 -32', '#d8d2c4') + path('M174 70 q26 -30 52 0Z', '#7a2f2a'))
      + rect(0, 150, 400, 40, '#5c3d24') + rect(0, 150, 400, 6, '#8a6038') + circle(130, 162, 7, '#e6c15a') + circle(146, 165, 7, '#e6c15a') + circle(270, 162, 9, '#b8402f'), 'The shopkeeper behind the counter'),
    training: () => svg(sky('t', '#6c8aa0', '#d9b98a') + rect(0, 112, 400, 78, '#b8905c')
      + rect(196, 56, 9, 96, '#5a3d26') + rect(164, 82, 74, 8, '#5a3d26') + circle(200, 52, 17, '#c9a56a') + rect(182, 90, 38, 44, '#a8854c')
      + path('M188 100 l26 24 M214 100 l-26 24', 'none', 'stroke="#7a2f2a" stroke-width="3"')
      + person(70, 88, '#9a6844', '#3f4b52') + hands(rect(300, 112, 9, 62, '#7a5334', 'transform="rotate(28 304 143)"')), 'A training dummy in the yard'),
    arena: () => svg(sky('a', '#2a1c2e', '#b8553c') + path('M0 60 H400 V130 H0Z', '#4a3228')
      + Array.from({ length: 90 }, (_, i) => circle((i * 47) % 400, 66 + (i * 13) % 52, 4, ['#c58e68', '#8e3b2c', '#d9b26a', '#6c8aa0'][i % 4])).join('')
      + rect(0, 124, 400, 66, '#c49a62') + path('M150 190 L178 124 H222 L250 190Z', '#d3ac74') + circle(120, 168, 12, '#7d1f1a', 'opacity=".6"') + circle(292, 150, 7, '#7d1f1a', 'opacity=".55"')
      + path('M0 0 H70 V190 H0Z M330 0 H400 V190 H330Z', '#1d130d') + torch(52) + torch(348) + hands(), 'The arena seen from the gate'),
    grave: () => svg(sky('g', '#12151f', '#3d3340') + circle(310, 48, 20, '#e8e0d0') + rect(0, 132, 400, 58, '#2c2418')
      + rect(188, 74, 8, 78, '#8a8478') + rect(170, 88, 44, 8, '#8a8478') + path('M178 70 q14 -18 28 0 v10 h-28Z', '#6a655c')
      + circle(150, 156, 11, '#d8d0c0') + circle(146, 154, 2.5, '#1d130d') + circle(155, 154, 2.5, '#1d130d') + circle(238, 162, 20, '#6e1a16', 'opacity=".7"'), 'A grave marker under the moon')
  };

  // A hooded stranger seen across a barrel, tinted to tell them apart.
  function stranger(color, key) {
    const rgb = 'rgb(' + color.join(',') + ')';
    const held = {
      crone: circle(268, 128, 13, '#8fbf6a', 'opacity=".85"') + path('M262 118 q6 -20 12 0', 'none', 'stroke="#d9e8b0" stroke-width="2"'),
      peddler: circle(268, 126, 11, '#e8e0d0') + circle(268, 126, 5, '#3f7a8c') + circle(268, 126, 2, '#0c0806'),
      envoy: rect(248, 116, 42, 26, '#d8c8a8') + circle(269, 129, 7, '#8e1f1f'),
      dealer: rect(232, 120, 22, 32, '#d8c8a8', 'transform="rotate(-12 243 136)"') + rect(258, 118, 22, 32, '#d8c8a8') + rect(284, 120, 22, 32, '#d8c8a8', 'transform="rotate(12 295 136)"'),
      flagellant: path('M262 96 q34 14 6 34 t14 30 M262 96 q18 30 -8 48 M262 96 q44 22 38 52', 'none', 'stroke="#3a2618" stroke-width="4"')
    }[key];
    return svg(sky('s', '#15121c', '#5a3a30') + torch(52) + torch(348)
      + path('M130 190 Q140 96 200 74 Q260 96 270 190Z', rgb) + path('M168 108 Q166 46 200 42 Q234 46 232 108 Q200 130 168 108', rgb)
      + path('M178 100 Q178 66 200 62 Q222 66 222 100 Q200 116 178 100', '#1d130d') + circle(192, 90, 2.6, '#ffd9a0') + circle(208, 90, 2.6, key === 'peddler' ? '#1d130d' : '#ffd9a0')
      + rect(0, 150, 400, 40, '#3a2618') + rect(0, 150, 400, 5, '#6b4a2a') + held + hands(), 'A stranger waiting for your answer');
  }

  return { scene: name => scenes[name](), stranger };
})();
