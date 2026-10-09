const state = {
  token: localStorage.getItem('wqToken') || '',
  user: null,
  skins: [],
  inventory: [],
  selectedSkinId: 'purple-camo',
  activeTab: 'upgrade',
  authMode: 'login'
};

const API_BASE = window.location.origin;

const els = {
  authScreen: document.getElementById('auth-screen'),
  gameScreen: document.getElementById('game-screen'),
  authForm: document.getElementById('auth-form'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  toggleButtons: document.querySelectorAll('.toggle-btn'),
  navButtons: document.querySelectorAll('.nav-btn'),
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
  adminAmount: document.getElementById('admin-amount'),
  sumBtns: document.querySelectorAll('.sum-btn'),
  closeButtons: document.querySelectorAll('.close-btn')
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2500);
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error('JSON parse error:', e);
    }

    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  } catch (error) {
    throw error;
  }
}

function createGunSVG(colorClass = 'orange') {
  return `
    <div class="gun">
      <div class="slide ${colorClass}"></div>
      <div class="body ${colorClass}"></div>
      <div class="barrel ${colorClass}"></div>
      <div class="grip ${colorClass}"></div>
    </div>
  `;
}

function renderSkins() {
  if (!state.skins.length) return;

  els.skinGrid.innerHTML = state.skins.map((skin) => `
    <button class="skin-card ${state.selectedSkinId === skin.id ? 'selected' : ''}" data-skin-id="${skin.id}">
      ${createGunSVG(skin.colorClass || 'orange')}
      <div class="skin-info">
        <span class="name">${skin.name}</span>
        <span class="price">${skin.price}</span>
      </div>
    </button>
  `).join('');

  // Attach click handlers to skin cards
  els.skinGrid.querySelectorAll('.skin-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const skinId = card.dataset.skinId;
      state.selectedSkinId = skinId;
      renderSelectedSkin();
      renderSkins();
      els.upgradeModal.classList.remove('hidden');
    });
  });
}

function renderSelectedSkin() {
  const skin = state.skins.find(item => item.id === state.selectedSkinId) || state.skins[0];
  if (!skin) return;

  els.selectedSkinName.textContent = skin.name;
  els.selectedSkinMeta.textContent = `${skin.rarity} • ${skin.price} coins`;
  els.selectedSkinPreview.innerHTML = createGunSVG(skin.colorClass || 'orange');
}

function renderInventory() {
  if (!state.inventory || state.inventory.length === 0) {
    els.inventoryList.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 20px;">No items yet. Start upgrading to build your inventory.</div>';
    return;
  }

  els.inventoryList.innerHTML = state.inventory.map((item) => {
    const skin = state.skins.find(s => s.id === item.skin_id);
    return `
      <div class="inventory-item">
        <div>${skin?.name || item.skin_id}</div>
        <div>Qty: ${item.quantity}</div>
        <div>Lvl: ${item.level}</div>
        <button class="orange-btn">Equip</button>
      </div>
    `;
  }).join('');
}

function renderMarket() {
  els.skinMarket.innerHTML = state.skins.map((skin) => `
    <div class="market-item">
      <div><strong>${skin.name}</strong></div>
      <div>${skin.rarity}</div>
      <div><strong>${skin.price} coins</strong></div>
      <button class="orange-btn" data-buy-skin="${skin.id}">Buy</button>
    </div>
  `).join('');

  els.skinMarket.querySelectorAll('[data-buy-skin]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const skinId = btn.dataset.buySkin;
      try {
        const response = await api('/api/buy-skin', {
          method: 'POST',
          body: JSON.stringify({ skinId })
        });
        state.user.balance = response.balance;
        refreshPlayer();
        showToast('✓ Skin purchased');
      } catch (error) {
        showToast('✗ ' + error.message);
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
    renderInventory();
  } catch (error) {
    console.error('Refresh error:', error);
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
    console.error('Boot error:', error);
    showToast('Failed to load skins');
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
  if (state.user) {
    els.balance.textContent = state.user.balance;
  }
}

function logout() {
  localStorage.removeItem('wqToken');
  state.token = '';
  state.user = null;
  showAuth();
}

// Auth toggle
els.toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.authMode = button.dataset.mode;
    els.toggleButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === state.authMode));
  });
});

// Auth form submit
els.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = els.username.value.trim();
  const password = els.password.value;

  if (!username || !password) {
    showToast('Username and password required');
    return;
  }

  try {
    const endpoint = state.authMode === 'register' ? '/api/register' : '/api/login';
    const res = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('wqToken', res.token);
    els.balance.textContent = res.user.balance;
    els.username.value = '';
    els.password.value = '';
    showApp();
    refreshPlayer();
    showToast(state.authMode === 'register' ? '✓ Account created' : '✓ Logged in');
  } catch (error) {
    showToast('✗ ' + error.message);
  }
});

// Nav buttons
els.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    els.navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === state.activeTab));
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${state.activeTab}-tab`);
    });
  });
});

// Odds and multiplier sliders
els.oddsRange.addEventListener('input', () => {
  els.oddsValue.textContent = `${els.oddsRange.value}%`;
});

els.multiplierRange.addEventListener('input', () => {
  els.multiplierValue.textContent = `x${els.multiplierRange.value}`;
});

// Start upgrade
els.startUpgrade.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!state.token) {
    showToast('Login first');
    return;
  }

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
    showToast(result.success ? '✓ Upgrade success!' : '✗ Upgrade failed.');
    refreshPlayer();
    els.upgradeModal.classList.add('hidden');
  } catch (error) {
    showToast('✗ ' + error.message);
  }
});

// Top-up button
els.topupBtn.addEventListener('click', (e) => {
  e.preventDefault();
  els.topupModal.classList.remove('hidden');
});

// Sum buttons for top-up
els.sumBtns.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    els.sumBtns.forEach((b) => b.classList.toggle('active', b === button));
    els.customTopup.value = button.dataset.amount;
  });
});

// Confirm top-up
els.confirmTopup.addEventListener('click', async (e) => {
  e.preventDefault();
  const amount = Number(els.customTopup.value || 0);

  if (!state.token || amount <= 0) {
    showToast('Invalid amount');
    return;
  }

  try {
    const result = await api('/api/admin/grant-currency', {
      method: 'POST',
      body: JSON.stringify({
        username: state.user.username,
        amount,
        password: '5533422'
      })
    });
    showToast(`✓ Balance updated by ${amount}`);
    await refreshPlayer();
    els.topupModal.classList.add('hidden');
  } catch (error) {
    showToast('✗ ' + error.message);
  }
});

// Grant currency (admin)
els.grantCurrency.addEventListener('click', async (e) => {
  e.preventDefault();
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
    showToast(`✓ ${result.username} granted ${result.amount}`);
    els.adminModal.classList.add('hidden');
    refreshPlayer();
  } catch (error) {
    showToast('✗ ' + error.message);
  }
});

// Close modals
els.closeButtons.forEach((closeBtn) => {
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const target = closeBtn.dataset.close;
    const modal = document.getElementById(target);
    if (modal) {
      modal.classList.add('hidden');
    }
  });
});

// Close modals on background click
document.querySelectorAll('.modal').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
});

// Logout button
els.logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

// Keyboard escape to close modals
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.classList.add('hidden');
    });
  }
});

// Bootstrap
boot();
