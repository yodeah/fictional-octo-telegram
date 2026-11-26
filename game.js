'use strict';

// Screens, saving and the link between the rules and the arena.
const Game = (() => {
  const SAVE_KEY = 'sandals-save-v1';
  const app = document.getElementById('app');
  const bar = document.getElementById('fight-bar');
  const fresh = () => ({ v: 1, run: null, legacy: 0, seen: {}, graves: [], draft: null, victories: 0 });
  let save = load();
  let view = 'title';
  let tab = 'arena';
  let notes = [];
  let preview = null;
  let storyPage = 0;
  let message = '';
  let watching = false;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      return data?.v === 1 ? { ...fresh(), ...data } : fresh();
    } catch { return fresh(); }
  }
  function store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { message = 'This browser blocks saving. Copy a save code from the menu.'; }
  }
  const encode = () => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(save))));
  function decode(code) {
    const bytes = Uint8Array.from(atob(code.trim()), char => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data?.v !== 1 || (data.run && !Rules.races[data.run.race])) throw new Error('Not a save code');
    return { ...fresh(), ...data };
  }

  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const button = (action, label, extra = '') => '<button type="button" data-action="' + action + '" ' + extra + '>' + label + '</button>';
  const itemName = key => key === 'none' ? 'Nothing' : specials[key]?.name || weapons[key]?.name || shields[key]?.name || armors[key]?.name || key;
  const scene = name => '<div class="scene">' + Art.scene(name) + '</div>';

  const tips = {
    arena: ['The arena', 'Fights run on their own. You decide who to face, what to carry and when. Sparring ends at first blood. Blood bouts and champions end in death.'],
    debt: ['The debt', 'Every fifth day the lanista collects. Miss once and you are flogged. Miss twice and you are sold.'],
    train: ['Training', 'A drill costs gold and a day. Each repeat of the same drill teaches a little less.'],
    market: ['Armor matters', 'Melee cuts through leather, bolts through robes, spells through plate. Axes and maces break shields.'],
    wounds: ['Wounds', 'You carry your wounds into the next fight. A day heals some; resting heals all.'],
    spells: ['Spells', 'Your first spell wakes your mana. You can ready up to three; your gladiator decides when to cast.']
  };
  const tip = key => save.seen[key] ? '' : '<aside class="tip"><b>' + tips[key][0] + '</b><p>' + tips[key][1] + '</p>' + button('tip', 'Got it', 'data-key="' + key + '"') + '</aside>';

  function weaponText(key) {
    const base = weapons[Rules.trophies[key] || key];
    const parts = [base.style === 'ranged' ? 'Ranged' : ['Stab', 'Slash', 'Crush'][meleeType(Rules.trophies[key] || key)],
      'damage ' + base.damage, 'reach ' + base.range.toFixed(1), 'speed ' + Math.round(base.tempo * 100)];
    if (base.twoHanded) parts.push('two hands, no shield');
    if (breaksShields(Rules.trophies[key] || key)) parts.push('breaks shields');
    return parts.join(' · ') + (specials[key] ? '<br><em>' + specials[key].effect + '</em>' : '');
  }
  function itemText(key) {
    const slot = Rules.slotOf(key);
    if (slot === 'weapon') return weaponText(key);
    if (slot === 'shield') return 'Defense +' + shields[key].defense + ' · speed ' + Math.round(shields[key].mobility * 100) + '% · survives ' + shields[key].durability + ' breaking blows';
    const kit = armors[key];
    return 'Defense +' + kit.defense + ' · against stab ' + signed(kit.defenseBonus[0]) + ', slash ' + signed(kit.defenseBonus[1]) + ', crush ' + signed(kit.defenseBonus[2])
      + ' · speed ' + Math.round(kit.mobility * 100) + '%';
  }

  function weakness(config) {
    const kit = armors[config.gear.armor];
    const styles = ['melee', 'ranged', 'magic'].filter(style => kit[style] >= 1.1);
    const types = ['stabbing', 'slashing', 'crushing'];
    const soft = types[[0, 1, 2].reduce((best, i) => kit.defenseBonus[i] < kit.defenseBonus[best] ? i : best, 0)];
    return (styles.length ? 'Open to ' + styles.join(' and ') + '. ' : '') + 'Softest against ' + soft + '.';
  }

  function card(config, extra = '') {
    const gear = config.gear;
    return '<div class="card fighter-card"><h3>' + escape(config.name) + '</h3><p class="num">' + config.maxHP + ' health · strength ' + config.strength
      + ' · skill ' + config.attack + ' · defense ' + config.defense + '</p><p>' + itemName(gear.special !== 'none' ? gear.special : gear.weapon)
      + (gear.reserve !== 'none' ? ' and ' + itemName(gear.reserve) : '') + ' · ' + itemName(gear.shield) + ' · ' + itemName(gear.armor)
      + (config.spellList?.length ? ' · casts ' + config.spellList.map(key => spells[key].name).join(', ') : '') + '</p>' + extra + '</div>';
  }

  // A few quick trial bouts, as the trainer imagining how this could go.
  function trainersRead(hero, foe) {
    let wins = 0;
    const trials = 15;
    for (let i = 0; i < trials; i++) {
      ArenaDuel.setup(7000 + i * 131, [hero, foe]);
      wins += ArenaDuel.resolve().won ? 1 : 0;
    }
    ArenaDuel.stop();
    const share = wins / trials;
    return share >= .93 ? ['safe', 'You should win this.'] : share >= .72 ? ['good', 'The odds are yours, but not certain.']
      : share >= .45 ? ['even', 'A coin toss. Think again.'] : ['bad', 'You will likely lose.'];
  }

  const screens = {
    title: () => scene('beach') + '<div class="title"><p class="eyebrow">A GLADIATOR’S ROAD</p><h1>Salt &amp; Sand</h1><p>Shipwrecked, sold, and sworn to the arena. Kill four champions or die trying.</p></div><div class="stack">'
      + (save.run && !save.run.over ? button('continue', 'Continue: ' + escape(save.run.name) + ', day ' + save.run.day, 'class="primary"') : '')
      + button('new', save.run && !save.run.over ? 'Abandon and start anew' : 'New gladiator', save.run && !save.run.over ? '' : 'class="primary"')
      + button('saves', 'Save code') + '</div>'
      + (save.graves.length ? '<h2>The fallen</h2><ul class="list">' + save.graves.slice(-5).reverse().map(grave => '<li>' + escape(grave) + '</li>').join('') + '</ul>' : '')
      + '<p class="foot"><a href="./mechanics.html">Mechanics guide</a> · <a href="./sandbox.html">Sparring sandbox</a></p>',

    saves: () => '<h2>Save code</h2><p>Your game saves itself in this browser. Phones can clear that, so copy this code somewhere safe.</p>'
      + '<textarea id="code-out" readonly rows="5">' + encode() + '</textarea>' + button('copy', 'Copy')
      + '<h2>Restore</h2><textarea id="code-in" rows="4" placeholder="Paste a save code"></textarea>' + button('restore', 'Restore this save') + button('title', 'Back'),

    create: () => {
      const draft = save.draft;
      const race = Rules.races[draft.race];
      return '<h2>Who washed ashore?</h2><label class="field">Name<input id="name" maxlength="16" value="' + escape(draft.name) + '"></label><div class="races">'
        + Object.entries(Rules.races).map(([key, item]) => button('race', '<b>' + item.name + '</b><span>' + item.text + '</span><span class="flaw">' + item.flaw + '</span>', 'data-key="' + key + '" aria-pressed="' + (draft.race === key) + '"')).join('')
        + '</div><dl class="dice">' + Object.entries(Rules.statNames).map(([key, label]) => {
          const bonus = race.stats[key] || 0;
          return '<div><dt>' + label + '</dt><dd>' + (draft.stats[key] + bonus) + (bonus ? '<small>' + signed(bonus) + '</small>' : '') + '</dd></div>';
        }).join('') + '</dl><p class="small">Strength hits harder. Agility aims and dodges. Endurance is health. Mind powers spells. Charm earns coin.</p>'
        + button('reroll', 'Roll again (' + draft.rerolls + ' left)', draft.rerolls ? '' : 'disabled')
        + (save.legacy ? '<label class="field">Begin at<select id="start">' + Array.from({ length: save.legacy + 1 }, (_, i) => '<option value="' + i + '"' + (draft.startAct === i ? ' selected' : '') + '>'
          + (i ? 'Champion ' + (i + 1) + ' — a Legacy start' : 'The beach — the full story') + '</option>').join('') + '</select></label>' : '')
        + button('begin', 'Begin', 'class="primary"') + button('title', 'Back');
    },

    story: () => {
      const pages = [
        ['beach', 'The mast broke at midnight. You wake with salt in your mouth and nothing in your hands but a piece of driftwood that will serve as a club.'],
        ['yard', '“I pulled you out,” says Marrow the lanista, “so you owe me. Every fifth day I collect. You will earn it on the sand.”'],
        ['arena', 'Four champions hold this city. Kill all four and your debt dies with them. Die, and you stay dead.']
      ];
      return scene(pages[storyPage][0]) + '<p class="story">' + pages[storyPage][1] + '</p>' + button('story', storyPage < 2 ? 'Next' : 'Step into the yard', 'class="primary"');
    },

    hub: () => {
      const run = save.run;
      const due = Rules.daysToDebt(run);
      const header = '<header class="status"><div><b>' + escape(run.name) + '</b><span>' + Rules.races[run.race].name + ' · day ' + run.day + '</span></div>'
        + '<dl><div><dt>Gold</dt><dd>' + run.gold + '</dd></div><div><dt>Health</dt><dd class="' + (run.health < .6 ? 'warn' : '') + '">' + Math.round(run.health * 100) + '%</dd></div>'
        + '<div><dt>Debt</dt><dd class="' + (due <= 2 && run.gold < Rules.debtDue(run) ? 'warn' : '') + '">' + Rules.debtDue(run) + '<small>' + (due === 1 ? 'tonight' : 'in ' + due + ' days') + '</small></dd></div>'
        + '<div><dt>Renown</dt><dd>' + Math.min(run.renown, Rules.renownNeeded[run.act]) + '/' + Rules.renownNeeded[run.act] + '</dd></div></dl></header>';
      const journal = notes.length ? '<ul class="notes">' + notes.map(note => '<li>' + escape(note) + '</li>').join('') + '</ul>' : '';
      const panels = { arena: arenaPanel, train: trainPanel, market: marketPanel, gear: gearPanel, wall: wallPanel };
      const nav = '<nav class="tabs">' + [['arena', 'Arena'], ['train', 'Yard'], ['market', 'Market'], ['gear', 'Gear'], ['wall', 'Champions']]
        .map(([key, label]) => button('tab', label, 'data-key="' + key + '" aria-current="' + (tab === key) + '"')).join('') + '</nav>';
      return header + journal + panels[tab](run) + button('title', 'Menu', 'class="quiet"') + nav;
    },

    confirm: () => {
      const run = save.run;
      const { kind, foe, read } = preview;
      const risk = kind === 'spar' ? 'First blood. Losing costs the purse and leaves you hurt.'
        : run.mercy ? 'To the death. If you fall, the crowd may spare you this once, for half your gold.' : 'To the death. There is no mercy left. If you fall, ' + escape(run.name) + ' is gone.';
      return scene('arena') + '<h2>' + { spar: 'Sparring', blood: 'Blood bout', champion: 'Champion' }[kind] + ' · purse about ' + Rules.purse(run, kind) + ' gold</h2>'
        + card({ ...Rules.heroConfig(run) }, '<p class="small">You, at ' + Math.round(run.health * 100) + '% health</p>')
        + card(foe, '<p class="weak">' + weakness(foe) + '</p>' + (kind === 'champion' ? '<p class="small">' + Rules.champions[run.act].hint + '</p>' : ''))
        + '<p class="read ' + (read?.[0] || '') + '">Trainer: ' + (read ? read[1] : 'Let me watch you both…') + '</p><p class="small ' + (kind === 'spar' ? '' : 'warn') + '">' + risk + '</p>'
        + button('fight', 'Walk onto the sand', 'class="primary"') + button('back', 'Not today');
    },

    outcome: () => {
      const run = save.run;
      return scene(run.over === 'dead' ? 'grave' : run.over === 'sold' ? 'beach' : 'arena') + '<ul class="notes big">' + notes.map(note => '<li>' + escape(note) + '</li>').join('') + '</ul>' + button('after', 'Continue', 'class="primary"');
    },

    spell: () => '<h2>A torn spell page</h2><p>Choose one to learn.</p>' + tip('spells') + '<div class="stack">' + save.run.spellChoices.map(key => {
      const spell = spells[key];
      return button('learn', '<b style="color:' + spell.color + '">' + spell.icon + ' ' + spell.name + '</b><span>' + spellText(spell) + '</span>', 'data-key="' + key + '" class="item"');
    }).join('') + '</div>',

    over: () => {
      const run = save.run;
      const won = run.over === 'won';
      return scene(won ? 'arena' : 'grave') + '<div class="title"><h1>' + (won ? 'Free' : run.over === 'sold' ? 'Sold' : 'Dead') + '</h1><p>'
        + (won ? escape(run.name) + ' killed all four champions. The debt is ash and the city knows your name.' : escape(run.name) + ' is gone for good.')
        + '</p><p class="num">Day ' + run.day + ' · ' + run.wins + ' victories · ' + (won ? 4 : run.act) + ' champions slain</p>'
        + (!won && save.legacy ? '<p>A new castaway may begin where the Legacy reaches: champion ' + (save.legacy + 1) + '.</p>' : '') + '</div>'
        + button('new', 'New gladiator', 'class="primary"') + button('title', 'Title');
    }
  };

  function spellText(spell) {
    if (spell.heal) return 'Heals you when badly hurt. ' + spell.cost + ' mana.';
    if (spell.absorb) return 'A shield that soaks damage. ' + spell.cost + ' mana.';
    if (spell.energyRestore) return 'Restores energy and speed. ' + spell.cost + ' mana.';
    return (spell.effect || 'A damaging bolt.') + ' · ' + spell.damage + ' damage · ' + spell.cost + ' mana.';
  }

  function arenaPanel(run) {
    const offer = (kind, title, foe) => '<div class="card offer ' + kind + '"><p class="eyebrow">' + title + '</p><h3>' + escape(foe.name) + '</h3><p>' + itemName(foe.gear.special !== 'none' ? foe.gear.special : foe.gear.weapon) + ' · ' + itemName(foe.gear.armor)
      + ' · ' + foe.maxHP + ' health</p><p class="small">About ' + Rules.purse(run, kind) + ' gold</p>' + button('size', 'Size up', 'data-key="' + kind + '"') + '</div>';
    const champion = Rules.champions[run.act];
    return scene('arena') + tip('arena') + (run.health < 1 ? tip('wounds') : '') + (run.day > 2 ? tip('debt') : '')
      + offer('spar', 'SPARRING · +1 renown', run.offers.spar) + offer('blood', 'BLOOD BOUT · +2 renown · to the death', run.offers.blood)
      + (Rules.championReady(run) ? offer('champion', champion.title + ' · to the death', Rules.championConfig(run.act))
        : '<p class="small locked">' + champion.name + ' will answer your challenge at ' + Rules.renownNeeded[run.act] + ' renown.</p>')
      + '<div class="row">' + button('rest', 'Rest a day<span>Heal fully</span>') + button('work', 'Work the docks<span>+' + Rules.wage(run) + ' gold, safe</span>') + '</div>';
  }

  function trainPanel(run) {
    const hero = Rules.heroConfig(run);
    const cost = Rules.trainingCost(run);
    return scene('training') + tip('train') + '<p class="num">Strength ' + hero.strength + ' · Skill ' + hero.attack + ' · Defense ' + hero.defense + ' · Health ' + hero.maxHP + '</p><div class="stack">'
      + Object.entries(Rules.drills).map(([key, drill]) => button('train', '<b>' + drill.name + ' — ' + cost + ' gold, one day</b><span>' + drill.text + ' Done ' + run.train[key] + '×.</span>', 'class="item" data-key="' + key + '"' + (run.gold < cost ? ' disabled' : ''))).join('') + '</div>';
  }

  function marketPanel(run) {
    const stock = Rules.shopStock(run);
    return scene('market') + tip('market') + ['weapon', 'shield', 'armor'].map(slot => '<h2>' + { weapon: 'Weapons', shield: 'Shields', armor: 'Armor' }[slot] + '</h2><div class="stack">'
      + stock.filter(key => Rules.slotOf(key) === slot).map(key => {
        const owned = run.inventory.includes(key);
        return button('buy', '<b>' + itemName(key) + ' — ' + (owned ? 'owned' : Rules.price(run, key) + ' gold') + '</b><span>' + itemText(key) + '</span>', 'class="item" data-key="' + key + '"' + (owned || run.gold < Rules.price(run, key) ? ' disabled' : ''));
      }).join('') + '</div>').join('') + '<p class="small">Buying puts the item to use at once. Sell old gear under Gear.</p>';
  }

  function gearPanel(run) {
    const select = (slot, label, empty) => {
      const options = run.inventory.filter(key => Rules.slotOf(key) === (slot === 'reserve' ? 'weapon' : slot));
      if (empty) options.unshift(empty);
      return '<label class="field">' + label + '<select data-slot="' + slot + '">' + options.map(key => '<option value="' + key + '"' + (run.equipped[slot] === key ? ' selected' : '') + '>' + (key === 'rags' ? 'Rags' : itemName(key)) + '</option>').join('') + '</select></label>';
    };
    const spare = run.inventory.filter(key => !Rules.equipped(run, key) && Rules.catalog[key]);
    return '<h2>What you carry</h2>' + select('weapon', 'Main weapon') + '<p class="small">' + weaponText(run.equipped.weapon) + '</p>' + select('reserve', 'Backup weapon', 'none') + select('shield', 'Shield', 'none') + select('armor', 'Armor', 'rags')
      + '<p class="small">A backup lets your gladiator switch as the fight changes, but slows them a little.</p>'
      + (run.learned.length ? '<h2>Spells (ready up to 3)</h2><div class="stack">' + run.learned.map(key => button('spell', '<b>' + (run.spells.includes(key) ? '✔ ' : '') + spells[key].name + '</b><span>' + spellText(spells[key]) + '</span>', 'class="item" data-key="' + key + '" aria-pressed="' + run.spells.includes(key) + '"')).join('') + '</div>' : '')
      + (spare.length ? '<h2>Sell</h2><div class="stack">' + spare.map(key => button('sell', itemName(key) + ' for ' + Rules.sellPrice(key) + ' gold', 'data-key="' + key + '"')).join('') + '</div>' : '');
  }

  function wallPanel(run) {
    return '<h2>The wall of champions</h2>' + Rules.champions.map((champion, index) => {
      const state = index < run.act ? 'slain' : index === run.act ? 'next' : 'waiting';
      return '<div class="card champion ' + state + '">' + Art.portrait(champion.color, champion.trim, index) + '<div><p class="eyebrow">' + champion.title + '</p><h3>' + champion.name + '</h3><p class="small">'
        + (state === 'slain' ? 'Slain. Their weapon hangs in your gear.' : state === 'next' ? champion.hint + ' ' + weakness(Rules.championConfig(index)) : 'You know only the name. Kill those before them.') + '</p></div></div>';
    }).join('');
  }

  function render(keepScroll = false) {
    const y = window.scrollY;
    document.body.dataset.view = view === 'fight' ? 'fight' : 'menu';
    if (view !== 'fight') app.innerHTML = (message ? '<p class="tip warn">' + escape(message) + '</p>' : '') + screens[view]();
    message = '';
    window.scrollTo(0, keepScroll ? y : 0);
  }
  function go(next) {
    view = next;
    render();
  }

  // Where a run belongs after loading or after a screen closes.
  function resume() {
    const run = save.run;
    if (run.pending) return startWatching();
    if (run.over) return go('over');
    if (run.spellChoices) return go('spell');
    go('hub');
  }

  function startWatching() {
    const { seed, hero, foe } = save.run.pending;
    view = 'fight';
    render();
    ArenaDuel.setup(seed, [hero, foe]);
    document.body.dataset.fight = 'on';
    document.body.dataset.heroMana = String(hero.spellList.length > 0);
    document.body.dataset.foeMana = String(foe.spellList.length > 0);
    watching = true;
  }

  // The result is saved the moment the fight ends, before the fall has finished playing.
  function settle() {
    const result = ArenaDuel.result();
    if (!watching || !result) return;
    watching = false;
    const run = save.run;
    const before = run.act;
    notes = Rules.finishFight(run, result);
    save.legacy = Math.max(save.legacy, Math.min(3, run.over === 'won' ? 3 : run.act > before ? run.act : save.legacy));
    if (run.over === 'won') save.victories++;
    bury(run);
    store();
    document.body.dataset.fight = 'over';
  }

  function bury(run) {
    if (run.over === 'dead' || run.over === 'sold') save.graves.push(run.name + ' the ' + Rules.races[run.race].name.toLowerCase() + ', ' + (run.over === 'dead' ? 'died' : 'sold') + ' on day ' + run.day + ' after ' + run.wins + ' victories');
  }

  function dayAction(events) {
    if (!events) return;
    notes = events;
    bury(save.run);
    store();
    if (save.run.over) return go('outcome');
    render(true);
    window.scrollTo(0, 0);
  }

  function newDraft() {
    return { name: '', race: 'human', stats: Rules.rollStats(), rerolls: 3, startAct: 0 };
  }

  const actions = {
    title: () => go('title'),
    saves: () => go('saves'),
    continue: () => { notes = []; resume(); },
    new: () => {
      if (save.run && !save.run.over && !window.confirm('Abandon ' + save.run.name + '? They will be gone for good.')) return;
      // The dice are kept in the save, so reloading cannot buy more rolls.
      save.draft = save.draft || newDraft();
      store();
      go('create');
    },
    race: key => { save.draft.race = key; store(); render(true); },
    reroll: () => {
      if (!save.draft.rerolls) return;
      save.draft.rerolls--;
      save.draft.stats = Rules.rollStats();
      store();
      render(true);
    },
    begin: () => {
      save.run = Rules.newRun(save.draft);
      save.draft = null;
      store();
      notes = [];
      tab = 'arena';
      storyPage = 0;
      go('story');
    },
    story: () => {
      if (storyPage < 2) { storyPage++; render(); } else resume();
    },
    tab: key => { tab = key; notes = []; go('hub'); },
    tip: key => { save.seen[key] = true; store(); render(true); },
    size: kind => {
      const run = save.run;
      const foe = kind === 'champion' ? Rules.championConfig(run.act) : run.offers[kind];
      const mine = preview = { kind, foe, read: null };
      go('confirm');
      setTimeout(() => {
        if (preview !== mine || view !== 'confirm') return;
        mine.read = trainersRead(Rules.heroConfig(run), foe);
        render(true);
      }, 60);
    },
    back: () => go('hub'),
    fight: () => {
      if (!Rules.startFight(save.run, preview.kind)) return;
      preview = null;
      store();
      startWatching();
    },
    skip: () => { ArenaDuel.resolve(); settle(); },
    done: () => {
      ArenaDuel.stop();
      go('outcome');
    },
    after: () => { tab = 'arena'; if (save.run.over) go('over'); else resume(); },
    train: key => dayAction(Rules.train(save.run, key)),
    rest: () => dayAction(Rules.rest(save.run)),
    work: () => dayAction(Rules.work(save.run)),
    buy: key => {
      if (!Rules.buy(save.run, key)) return;
      Rules.equip(save.run, Rules.slotOf(key), key);
      store();
      render(true);
    },
    sell: key => { Rules.sell(save.run, key); store(); render(true); },
    spell: key => { Rules.toggleSpell(save.run, key); store(); render(true); },
    learn: key => { Rules.learnSpell(save.run, key); store(); resume(); },
    copy: () => {
      const box = document.getElementById('code-out');
      box.select();
      navigator.clipboard?.writeText(box.value).catch(() => {});
    },
    restore: () => {
      try {
        save = decode(document.getElementById('code-in').value);
        store();
        message = 'Save restored.';
        go('title');
      } catch {
        message = 'That is not a valid save code.';
        render();
      }
    }
  };

  for (const root of [app, bar]) {
    root.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (target && !target.disabled) actions[target.dataset.action](target.dataset.key);
    });
  }
  app.addEventListener('input', event => {
    if (event.target.id === 'name') { save.draft.name = event.target.value; store(); }
    if (event.target.id === 'start') { save.draft.startAct = Number(event.target.value); store(); }
    if (event.target.dataset.slot) {
      Rules.equip(save.run, event.target.dataset.slot, event.target.value);
      store();
      render(true);
    }
  });
  setInterval(settle, 150);
  // Reloading in the middle of a fight returns to the same fight, from the start.
  if (save.run?.pending) startWatching();
  else render();

  return { get save() { return save; }, go };
})();
