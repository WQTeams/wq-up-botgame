const state = {
  token: localStorage.getItem('wqToken') || '',
  user: null,
  skins: [],
  inventory: [],
  selectedSkinId: 'purple-camo',
  activeTab: 'upgrade'
};

const els = {
  authScreen: document.getElementById('auth-screen'),
  gameScreen: document.getElementById('game-screen'),
  authForm: document.getElementById('auth-form'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  toggleButtons: [...document.querySelectorAll('.toggle-btn')],
  navButtons: [...document.querySelectorAll('.nav-btn')],
  topupBtn: document.getElementById('topup-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  balance: document.getElementById('balance'),
  skinGrid: document.getElementById('skin-grid'),
  inventoryList: document.getElementById('inventory-list'),
  skinMarket: document.getElementById('skin-market'),
  upgradeModal: document.getElementById('upgrade-modal'),
  topupModal: document.getElementById('topup-modal'),
  adminModal: document.getElementById('admin-modal'),
  oddsRange: document.getElementById('odds-range'),
  multiplierRange: document.getElementById('multiplier-range'),
  oddsValue: document.getElementById('odds-value'),
  multiplierValue: document.getElementById('multiplier-value'),
  costValue: document.getElementById('cost-value'),
  selectedSkinName: document.getElementById('selected-skin-name'),
  selectedSkinMeta: document.getElementById('selected-skin-meta'),
  selectedSkinPreview: document.getElementById('selected-skin-preview'),
  startUpgrade: document.getElementById('start-upgrade'),
  confirmTopup: document.getElementById('confirm-topup'),
  customTopup: document.getElementById('custom-topup'),
  grantCurrency: document.getElementById('grant-currency'),
  toast: document.getElementById('toast'),
  adminPassword: document.getElementById('admin-password'),
  adminUser: document.getElementById('admin-user'),
  adminAmount: document.getElementById('admin-amount')
};

let authMode = 'login';

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  return fetch(path, { ...options, headers }).then(async (response) => {
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) {}
    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed');
    }
    return payload;
  });
}

function renderSelectedSkin() {
  const skin = state.skins.find(item => item.id === state.selectedSkinId) || state.skins[0];
  if (!skin) return;

  els.selectedSkinName.textContent = skin.name;
  els.selectedSkinMeta.textContent = `${skin.rarity} • ${skin.price} coins`;
  els.selectedSkinPreview.innerHTML = `<div class="gun"><div class="slide ${skin.colorClass || 'orange'}"></div><div class="body ${skin.colorClass || 'orange'}"></div><div class="barrel ${skin.colorClass || 'orange'}"></div><div class="grip ${skin.colorClass || 'orange'}"></div></div>`;
}

function renderSkins() {
  if (!state.skins.length) return;

  els.skinGrid.innerHTML = state.skins.map((skin) => `
    <button class="skin-card ${state.selectedSkinId === skin.id ? 'selected' : ''}" data-skin="${skin.id}">
      <div class="gun">
        <div class="slide ${skin.colorClass || 'orange'}"></div>
        <div class="body ${skin.colorClass || 'orange'}"></div>
        <div class="barrel ${skin.colorClass || 'orange'}"></div>
        <div class="grip ${skin.colorClass || 'orange'}"></div>
      </div>
      <div class="skin-info">
        <span class="name">${skin.name}</span>
        <span class="price">${skin.price}</span>
      </div>
    </button>
  `).join('');

  document.querySelectorAll('.skin-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.selectedSkinId = card.dataset.skin;
      renderSelectedSkin();
      renderSkins();
      els.upgradeModal.classList.remove('hidden');
    });
  });
}

function renderInventory() {
  if (!state.inventory.length) {
    els.inventoryList.innerHTML = '<div class="panel-wrapper"><p>No items yet.</p></div>';
    return;
  }

  els.inventoryList.innerHTML = state.inventory.map((item) => `
    <div class="inventory-item">
      <div>${state.skins.find(s => s.id === item.skin_id)?.name || item.skin_id}</div>
      <div>Qty: ${item.quantity}</div>
      <div>Lvl: ${item.level}</div>
      <button class="orange-btn">Use</button>
    </div>
  `).join('');
}

function renderMarket() {
  els.skinMarket.innerHTML = state.skins.map((skin) => `
    <div class="market-item">
      <div>${skin.name}</div>
      <div>${skin.rarity}</div>
      <div>${skin.price}</div>
      <button class="orange-btn" data-buy="${skin.id}">Buy</button>
    </div>
  `).join('');

  els.skinMarket.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const response = await api('/api/buy-skin', {
          method: 'POST',
          body: JSON.stringify({ skinId: btn.dataset.buy })
        });
        state.user.balance = response.balance;
        refreshPlayer();
        showToast('Skin purchased');
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

async function refreshPlayer() {
  if (!state.token) return;
  try {
    const result = await api('/api/player');
    state.user = result.user;
    state.inventory = result.inventory || [];
    els.balance.textContent = state.user.balance;
    if (state.user.is_admin) {
      document.body.classList.add('admin-enabled');
    }
    renderInventory();
  } catch (error) {
    console.error(error);
    logout();
  }
}

async function boot() {
  try {
    const skinsResult = await api('/api/skins');
    state.skins = skinsResult.skins.map((skin, index) => ({
      ...skin,
      colorClass: ['orange', 'green', 'blue', 'red', 'purple', 'gold'][index % 6]
    }));
    renderSkins();
    renderSelectedSkin();
    renderMarket();
  } catch (error) {
    console.error(error);
  }

  if (state.token) {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      els.balance.textContent = state.user.balance;
      showApp();
      refreshPlayer();
    } catch (error) {
      logout();
    }
  } else {
    showAuth();
  }
}

function showAuth() {
  els.authScreen.classList.remove('hidden');
  els.gameScreen.classList.add('hidden');
}

function showApp() {
  els.authScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  els.balance.textContent = state.user ? state.user.balance : 0;
}

function logout() {
  localStorage.removeItem('wqToken');
  state.token = '';
  state.user = null;
  showAuth();
}

els.toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    authMode = button.dataset.mode;
    els.toggleButtons.forEach((b) => b.classList.toggle('active', b === button));
  });
});

els.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = els.username.value.trim();
  const password = els.password.value;

  try {
    const endpoint = authMode === 'register' ? '/api/register' : '/api/login';
    const res = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('wqToken', res.token);
    els.balance.textContent = res.user.balance;
    showApp();
    refreshPlayer();
    showToast(authMode === 'register' ? 'Account created' : 'Logged in');
  } catch (error) {
    showToast(error.message);
  }
});

els.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    els.navButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${state.activeTab}-tab`));
  });
});

els.oddsRange.addEventListener('input', () => {
  els.oddsValue.textContent = `${els.oddsRange.value}%`;
});

els.multiplierRange.addEventListener('input', () => {
  els.multiplierValue.textContent = `x${els.multiplierRange.value}`;
});

els.startUpgrade.addEventListener('click', async () => {
  if (!state.token) return showToast('Login first');

  try {
    const payload = {
      skinId: state.selectedSkinId,
      odds: Number(els.oddsRange.value),
      multiplier: Number(els.multiplierRange.value),
      amount: Number(els.costValue.value || 10)
    };

    const result = await api('/api/upgrade', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    state.user.balance = result.balance;
    els.balance.textContent = result.balance;
    showToast(result.success ? 'Success!' : 'Failed.');
    refreshPlayer();
    els.upgradeModal.classList.add('hidden');
  } catch (error) {
    showToast(error.message);
  }
});

els.topupBtn.addEventListener('click', () => {
  els.topupModal.classList.remove('hidden');
});

els.confirmTopup.addEventListener('click', async () => {
  const amount = Number(els.customTopup.value || 0);
  const token = state.token;
  if (!token || amount <= 0) {
    return showToast('Invalid amount');
  }

  try {
    await api('/api/admin/grant-currency', {
      method: 'POST',
      body: JSON.stringify({
        username: state.user.username,
        amount,
        password: '5533422'
      })
    });
    showToast(`Balance updated by ${amount}`);
    await refreshPlayer();
    els.topupModal.classList.add('hidden');
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('[data-close]').forEach((closeBtn) => {
  closeBtn.addEventListener('click', () => {
    const target = closeBtn.dataset.close;
    document.getElementById(target).classList.add('hidden');
  });
});

els.logoutBtn.addEventListener('click', logout);

document.querySelectorAll('.sum-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.sum-btn').forEach((b) => b.classList.toggle('active', b === button));
    els.customTopup.value = button.dataset.amount;
  });
});

els.grantCurrency.addEventListener('click', async () => {
  try {
    const payload = {
      username: els.adminUser.value,
      amount: Number(els.adminAmount.value),
      password: els.adminPassword.value
    };
    const result = await api('/api/admin/grant-currency', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast(`${result.username} granted ${result.amount}`);
    els.adminModal.classList.add('hidden');
    refreshPlayer();
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal').forEach((modal) => modal.classList.add('hidden'));
  }
});

if (state.user) {
  showApp();
}

boot();
