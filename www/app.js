/* ==========================================================================
   BASE DE DONNÉES LOCALE (100 % HORS-LIGNE)
   ========================================================================== */
const DB_KEYS = {
  EMPLOYEES: 'pp_db_employees',
  PRODUCTS: 'pp_db_products',
  DECLARATIONS: 'pp_db_declarations',
  SESSIONS: 'pp_db_sessions'
};

function initLocalDB() {
  if (!localStorage.getItem(DB_KEYS.EMPLOYEES)) {
    const defaultEmployees = [
      {
        IDEmploye: 'ADMIN01',
        Nom: 'PANIER+',
        Prenom: 'Administrateur',
        PIN: '123456',
        Role: 'ADMIN',
        Actif: true
      }
    ];
    localStorage.setItem(DB_KEYS.EMPLOYEES, JSON.stringify(defaultEmployees));
  }

  if (!localStorage.getItem(DB_KEYS.PRODUCTS)) {
    const defaultProducts = [
      { IDProduit: 'PROD_1', NomProduit: 'Sandwich Poulet', Categorie: 'Sandwich', Unite: 'pièce', ImageURL: '', Description: 'Poulet crudités', OrdreAffichage: 1, Actif: true },
      { IDProduit: 'PROD_2', NomProduit: 'Eau 50cl', Categorie: 'Boisson', Unite: 'bouteille', ImageURL: '', Description: 'Eau de source', OrdreAffichage: 2, Actif: true },
      { IDProduit: 'PROD_3', NomProduit: 'Cookie Chocolat', Categorie: 'Dessert', Unite: 'pièce', ImageURL: '', Description: 'Pépites chocolat', OrdreAffichage: 3, Actif: true }
    ];
    localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(defaultProducts));
  }

  if (!localStorage.getItem(DB_KEYS.DECLARATIONS)) {
    localStorage.setItem(DB_KEYS.DECLARATIONS, JSON.stringify([]));
  }

  if (!localStorage.getItem(DB_KEYS.SESSIONS)) {
    localStorage.setItem(DB_KEYS.SESSIONS, JSON.stringify([]));
  }
}

function getTable(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

function saveTable(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function requireSession(token) {
  const sessions = getTable(DB_KEYS.SESSIONS);
  const session = sessions.find(s => s.token === token);
  if (!session) throw new Error('Session expirée. Reconnecte-toi.');

  const employees = getTable(DB_KEYS.EMPLOYEES);
  const user = employees.find(e => e.IDEmploye === session.employeeId && e.Actif);
  if (!user) throw new Error('Compte introuvable ou désactivé.');

  return user;
}

function requireAdmin(token) {
  const user = requireSession(token);
  if (user.Role !== 'ADMIN') throw new Error('Accès réservé aux administrateurs.');
  return user;
}

function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ==========================================================================
   API LOCALE
   ========================================================================== */
const localBackend = {
  async login(pin) {
    if (!/^\d{6}$/.test(String(pin))) {
      throw new Error('Le PIN doit faire 6 chiffres.');
    }
    const employees = getTable(DB_KEYS.EMPLOYEES);
    const user = employees.find(e => String(e.PIN) === String(pin) && e.Actif);
    if (!user) {
      throw new Error('PIN incorrect ou compte inactif.');
    }

    const token = 'tok_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    const sessions = getTable(DB_KEYS.SESSIONS);
    sessions.push({ token, employeeId: user.IDEmploye, createdAt: new Date().toISOString() });
    saveTable(DB_KEYS.SESSIONS, sessions);

    return {
      token,
      employee: {
        id: user.IDEmploye,
        name: `${user.Prenom} ${user.Nom}`.trim(),
        role: user.Role || 'USER'
      }
    };
  },

  async logout(token) {
    const sessions = getTable(DB_KEYS.SESSIONS).filter(s => s.token !== token);
    saveTable(DB_KEYS.SESSIONS, sessions);
    return true;
  },

  async getInitialData(token) {
    const user = requireSession(token);
    const products = await this.getProducts(token);
    return {
      user: {
        id: user.IDEmploye,
        name: `${user.Prenom} ${user.Nom}`.trim(),
        role: user.Role || 'USER'
      },
      products
    };
  },

  async getProducts(token) {
    requireSession(token);
    return getTable(DB_KEYS.PRODUCTS)
      .filter(p => p.Actif)
      .sort((a, b) => (Number(a.OrdreAffichage) || 0) - (Number(b.OrdreAffichage) || 0))
      .map(p => ({
        id: p.IDProduit,
        name: p.NomProduit,
        category: p.Categorie,
        unit: p.Unite,
        image: p.ImageURL || '',
        description: p.Description || '',
        order: Number(p.OrdreAffichage) || 0
      }));
  },

  async submitDeclaration(token, items) {
    const user = requireSession(token);
    if (!Array.isArray(items) || !items.length) {
      throw new Error('Panier vide.');
    }

    const declarations = getTable(DB_KEYS.DECLARATIONS);
    const today = getLocalTodayStr();

    const alreadyToday = declarations.some(d =>
      d.IDEmploye === user.IDEmploye &&
      d.Statut === 'VALIDEE' &&
      d.DateJour === today
    );
    if (alreadyToday) {
      throw new Error("Tu as déjà enregistré ton panier aujourd'hui.");
    }

    const products = getTable(DB_KEYS.PRODUCTS);
    const detailedItems = items.map(item => {
      const prod = products.find(p => p.IDProduit === item.id);
      if (!prod || !prod.Actif) throw new Error('Produit indisponible.');
      return {
        id: prod.IDProduit,
        name: prod.NomProduit,
        category: prod.Categorie,
        unit: prod.Unite,
        quantity: Number(item.quantity) || 1
      };
    });

    const newDecl = {
      IDDeclaration: 'DEC_' + Date.now(),
      DateHeure: new Date().toISOString(),
      DateJour: today,
      IDEmploye: user.IDEmploye,
      NomEmploye: `${user.Prenom} ${user.Nom}`.trim(),
      Statut: 'VALIDEE',
      items: detailedItems
    };

    declarations.push(newDecl);
    saveTable(DB_KEYS.DECLARATIONS, declarations);
    return newDecl.IDDeclaration;
  },

  async getMyHistory(token) {
    const user = requireSession(token);
    return getTable(DB_KEYS.DECLARATIONS)
      .filter(d => d.IDEmploye === user.IDEmploye && d.Statut === 'VALIDEE')
      .sort((a, b) => new Date(b.DateHeure) - new Date(a.DateHeure))
      .map(d => ({
        date: d.DateHeure,
        items: d.items
      }));
  },

  async changeMyPin(token, oldPin, newPin) {
    const user = requireAdmin(token);
    if (String(user.PIN) !== String(oldPin)) {
      throw new Error('Ancien PIN incorrect.');
    }
    if (!/^\d{6}$/.test(String(newPin))) {
      throw new Error('Le nouveau PIN doit contenir 6 chiffres.');
    }

    const employees = getTable(DB_KEYS.EMPLOYEES);
    if (employees.some(e => e.IDEmploye !== user.IDEmploye && String(e.PIN) === String(newPin))) {
      throw new Error('Ce code PIN est déjà utilisé.');
    }

    const idx = employees.findIndex(e => e.IDEmploye === user.IDEmploye);
    employees[idx].PIN = String(newPin);
    saveTable(DB_KEYS.EMPLOYEES, employees);
    return true;
  },

  async adminGetStats(token) {
    requireAdmin(token);
    const employees = getTable(DB_KEYS.EMPLOYEES);
    const products = getTable(DB_KEYS.PRODUCTS);
    const declarations = getTable(DB_KEYS.DECLARATIONS).filter(d => d.Statut === 'VALIDEE');
    const today = getLocalTodayStr();

    return {
      activeEmployees: employees.filter(e => e.Actif).length,
      activeProducts: products.filter(p => p.Actif).length,
      declarations: declarations.length,
      today: declarations.filter(d => d.DateJour === today).length
    };
  },

  async adminListEmployees(token) {
    requireAdmin(token);
    return getTable(DB_KEYS.EMPLOYEES).map(e => ({
      id: e.IDEmploye,
      nom: e.Nom,
      prenom: e.Prenom,
      nomComplet: `${e.Prenom} ${e.Nom}`.trim(),
      role: e.Role,
      actif: Boolean(e.Actif)
    }));
  },

  async adminSaveEmployee(token, data) {
    requireAdmin(token);
    const nom = String(data.nom || '').trim();
    const prenom = String(data.prenom || '').trim();
    const pin = String(data.pin || '').trim();

    if (!nom || !prenom) {
      throw new Error('Prénom et nom obligatoires.');
    }
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('Le PIN doit contenir exactement 6 chiffres.');
    }

    const employees = getTable(DB_KEYS.EMPLOYEES);
    if (employees.some(e => String(e.PIN) === pin)) {
      throw new Error('Ce code PIN est déjà attribué.');
    }

    employees.push({
      IDEmploye: 'EMP_' + Date.now(),
      Nom: nom,
      Prenom: prenom,
      PIN: pin,
      Role: 'USER',
      Actif: true
    });
    saveTable(DB_KEYS.EMPLOYEES, employees);
    return true;
  },

  async adminSetEmployeeActive(token, targetId, active) {
    const admin = requireAdmin(token);
    if (admin.IDEmploye === targetId && !active) {
      throw new Error('Impossible de désactiver ton propre compte administrateur.');
    }
    const employees = getTable(DB_KEYS.EMPLOYEES);
    const idx = employees.findIndex(e => e.IDEmploye === targetId);
    if (idx === -1) throw new Error('Salarié introuvable.');
    employees[idx].Actif = Boolean(active);
    saveTable(DB_KEYS.EMPLOYEES, employees);
    return true;
  },

  async adminListProducts(token) {
    requireAdmin(token);
    return getTable(DB_KEYS.PRODUCTS).sort(
      (a, b) => (Number(a.OrdreAffichage) || 0) - (Number(b.OrdreAffichage) || 0)
    );
  },

  async adminSaveProduct(token, data) {
    requireAdmin(token);
    const name = String(data.name || '').trim();
    const category = String(data.category || '').trim();
    if (!name || !category) {
      throw new Error('Nom et catégorie obligatoires.');
    }

    const products = getTable(DB_KEYS.PRODUCTS);
    const id = String(data.id || '').trim();

    if (id) {
      const idx = products.findIndex(p => String(p.IDProduit) === id);
      if (idx !== -1) {
        products[idx] = {
          ...products[idx],
          NomProduit: name,
          Categorie: category,
          Unite: String(data.unit || 'pièce').trim(),
          ImageURL: String(data.image || '').trim(),
          Description: String(data.description || '').trim(),
          OrdreAffichage: Number(data.order) || 0,
          Actif: data.active !== undefined ? Boolean(data.active) : products[idx].Actif
        };
        saveTable(DB_KEYS.PRODUCTS, products);
        return true;
      }
    }

    products.push({
      IDProduit: 'PROD_' + Date.now(),
      NomProduit: name,
      Categorie: category,
      Unite: String(data.unit || 'pièce').trim(),
      ImageURL: String(data.image || '').trim(),
      Description: String(data.description || '').trim(),
      OrdreAffichage: Number(data.order) || (products.length + 1),
      Actif: true
    });
    saveTable(DB_KEYS.PRODUCTS, products);
    return true;
  },

  async adminGetDeclarations(token, limit = 200) {
    requireAdmin(token);
    return getTable(DB_KEYS.DECLARATIONS)
      .filter(d => d.Statut === 'VALIDEE')
      .sort((a, b) => new Date(b.DateHeure) - new Date(a.DateHeure))
      .slice(0, limit)
      .map(d => ({
        employee: d.NomEmploye,
        date: d.DateHeure,
        items: d.items
      }));
  },

  async adminExportCsv(token) {
    requireAdmin(token);
    const declarations = getTable(DB_KEYS.DECLARATIONS).filter(d => d.Statut === 'VALIDEE');

    const rows = [['DateHeure', 'Produit', 'Categorie', 'Quantite', 'Unite']];
    declarations.forEach(d => {
      d.items.forEach(item => {
        rows.push([
          d.DateHeure,
          `"${String(item.name).replace(/"/g, '""')}"`,
          `"${String(item.category).replace(/"/g, '""')}"`,
          item.quantity,
          `"${String(item.unit || '').replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvString = '\uFEFF' + rows.map(r => r.join(';')).join('\n');
    return btoa(unescape(encodeURIComponent(csvString)));
  }
};

/* ==========================================================================
   INTERFACE UTILISATEUR & ROUTEUR
   ========================================================================== */
const state = {
  token: sessionStorage.getItem('pp_token') || '',
  user: null,
  products: [],
  cart: {},
  route: 'home',
  category: 'Tous',
  search: '',
  history: [],
  adminTab: 'dashboard'
};

const $ = id => document.getElementById(id);

function call(name, ...args) {
  if (!localBackend[name]) {
    return Promise.reject(new Error(`Fonction inconnue : ${name}`));
  }
  return localBackend[name](...args);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function moneyDate(d) {
  try {
    return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return d;
  }
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function boot() {
  initLocalDB();

  $('themeToggle').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('pp_theme', t);
  };
  document.documentElement.dataset.theme = localStorage.getItem('pp_theme') || 'light';

  if (!state.token) return renderLogin();

  try {
    const initData = await call('getInitialData', state.token);
    state.user = initData.user;
    state.products = initData.products;
    render();
  } catch (e) {
    state.token = '';
    sessionStorage.removeItem('pp_token');
    renderLogin();
  }
}

function updatePinDisplay() {
  const pinValue = $('pin').value;
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, index) => {
    if (index < pinValue.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function addPin(num) {
  const input = $('pin');
  if (input.value.length < 6) {
    input.value += num;
    updatePinDisplay();

    if (input.value.length === 6) {
      $('loginError').classList.add('hidden');
      $('submitLoginBtn').click();
    }
  }
}

function delPin() {
  const input = $('pin');
  input.value = input.value.slice(0, -1);
  updatePinDisplay();
}

function clearPin() {
  $('pin').value = '';
  updatePinDisplay();
}

function renderLogin() {
  $('bottomNav').classList.add('hidden');
  $('userBadge').classList.add('hidden');
  if ($('headerLogoutBtn')) $('headerLogoutBtn').classList.add('hidden');
  $('view').innerHTML = $('loginTemplate').innerHTML;

  $('loginForm').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.submitter;
    if (btn) btn.disabled = true;

    try {
      const pin = $('pin').value;
      if (!/^\d{6}$/.test(pin)) throw new Error('Le PIN doit contenir exactement 6 chiffres.');

      $('loginError').classList.add('hidden');
      if ($('loginLoading')) $('loginLoading').classList.remove('hidden');

      const r = await call('login', pin);

      state.token = r.token;
      state.user = r.employee;
      state.route = 'home';
      sessionStorage.setItem('pp_token', state.token);
      await loadProducts();
      render();
    } catch (e) {
      if ($('loginLoading')) $('loginLoading').classList.add('hidden');
      showError($('loginError'), e.message);
      clearPin();
    } finally {
      if (btn) btn.disabled = false;
    }
  };
}

async function loadProducts() {
  state.products = await call('getProducts', state.token);
}

function nav() {
  const items = [
    ['home', '⌂', 'Accueil'],
    ['catalog', '▦', 'Catalogue'],
    ['history', '◷', 'Historique'],
    ['profile', '♙', 'Profil']
  ];
  if (state.user.role === 'ADMIN') items.push(['admin', '⚙', 'Admin']);

  $('bottomNav').innerHTML = items
    .map(x => `<button class="nav-item ${state.route === x[0] ? 'active' : ''}" data-route="${x[0]}"><span>${x[1]}</span><span>${x[2]}</span></button>`)
    .join('');
  $('bottomNav').classList.remove('hidden');

  document.querySelectorAll('[data-route]').forEach(b => {
    b.onclick = () => {
      state.route = b.dataset.route;
      render();
    };
  });

  $('userBadge').textContent = state.user.name;
  $('userBadge').classList.remove('hidden');

  if ($('headerLogoutBtn')) {
    $('headerLogoutBtn').classList.remove('hidden');
    $('headerLogoutBtn').onclick = async () => {
      $('headerLogoutBtn').disabled = true;
      await call('logout', state.token);
      sessionStorage.removeItem('pp_token');
      state.token = '';
      state.user = null;
      state.cart = {};
      $('headerLogoutBtn').disabled = false;
      renderLogin();
    };
  }
}

function render() {
  nav();
  if (state.route === 'home') homeView();
  if (state.route === 'catalog') catalogView();
  if (state.route === 'cart') cartView();
  if (state.route === 'history') historyView();
  if (state.route === 'profile') profileView();
  if (state.route === 'admin') adminView();
}

function homeView() {
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  $('view').innerHTML = `
    <section class="hero">
      <div class="eyebrow" style="color:#b9e8ca">Bienvenue</div>
      <h1>Bonjour ${escapeHtml(state.user.name.split(' ')[0])} 👋</h1>
      <p>Enregistre ton panier repas en quelques secondes.</p>
      <button class="btn btn-light" id="startOrder">Commencer une déclaration →</button>
    </section>
    <div class="row-between"><div><h2>Ton espace</h2></div></div>
    <div class="grid">
      <div class="card"><div class="stat">${count}</div><div class="stat-label">Article(s) dans le panier</div></div>
      <div class="card"><div class="stat">${state.products.length}</div><div class="stat-label">Produits disponibles</div></div>
    </div>
    <section class="card"><div class="row-between"><h2>Ton panier</h2><button class="btn btn-secondary" id="openCart">Voir →</button></div></section>
  `;
  $('startOrder').onclick = () => { state.route = 'catalog'; render(); };
  $('openCart').onclick = () => { state.route = 'cart'; render(); };
}

function catalogView() {
  const cats = [...new Set(state.products.map(p => p.category))];
  const totalCart = Object.values(state.cart).reduce((a, b) => a + b, 0);

  $('view').innerHTML = `
    <div class="eyebrow">Catalogue</div>
    <h1>Compose ton panier</h1>
    <p class="muted">Choisis tes produits dans chaque catégorie.</p>

    ${cats.length ? cats.map(cat => {
      const catProducts = state.products.filter(p => p.category === cat);
      const selectedInCat = catProducts.filter(p => (state.cart[p.id] || 0) > 0);
      const catCount = selectedInCat.reduce((sum, p) => sum + state.cart[p.id], 0);

      return `
        <section class="card">
          <div class="row-between">
            <h2 style="margin:0">${escapeHtml(cat)}</h2>
            ${catCount ? `<span class="badge">${catCount} sélectionné(s)</span>` : ''}
          </div>

          <div class="field" style="margin-bottom:${selectedInCat.length ? '10px' : '0'}">
            <select class="cat-select" style="font-size:16px">
              <option value="">— Choisir un produit (${escapeHtml(cat)}) —</option>
              ${catProducts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          ${selectedInCat.map(p => `
            <div class="cart-line">
              <div>
                <strong>${escapeHtml(p.name)}</strong>
                ${p.description ? `<div class="muted small">${escapeHtml(p.description)}</div>` : ''}
              </div>
              <div class="qty-control">
                <button data-minus="${escapeHtml(p.id)}" aria-label="Retirer">−</button>
                <strong>${state.cart[p.id]}</strong>
                <button data-plus="${escapeHtml(p.id)}" aria-label="Ajouter">+</button>
              </div>
            </div>
          `).join('')}
        </section>
      `;
    }).join('') : '<div class="card empty">Aucun produit disponible.</div>'}

    <div style="position:sticky;bottom:78px;margin-top:16px">
      <button class="btn btn-primary btn-block" id="viewCart">Voir mon panier (${totalCart}) →</button>
    </div>
  `;

  document.querySelectorAll('.cat-select').forEach(sel => {
    sel.onchange = e => {
      const id = e.target.value;
      if (!id) return;
      state.cart[id] = Math.min(99, (state.cart[id] || 0) + 1);
      catalogView();
    };
  });

  document.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => changeQty(b.dataset.plus, 1));
  document.querySelectorAll('[data-minus]').forEach(b => b.onclick = () => changeQty(b.dataset.minus, -1));
  $('viewCart').onclick = () => { state.route = 'cart'; render(); };
}

function changeQty(id, delta) {
  const next = (state.cart[id] || 0) + delta;
  if (next <= 0) delete state.cart[id];
  else if (next <= 99) state.cart[id] = next;
  if (state.route === 'catalog') catalogView();
  else cartView();
}

function cartItems() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => ({ product: state.products.find(p => p.id === id), id, quantity }))
    .filter(x => x.product);
}

function cartView() {
  const items = cartItems();
  const total = items.reduce((a, x) => a + x.quantity, 0);
  $('view').innerHTML = `
    <div class="eyebrow">Récapitulatif</div>
    <h1>Mon panier</h1>
    <p class="muted">Vérifie les quantités avant de confirmer.</p>
    <section class="card">${items.length ? items.map(x => `
      <div class="cart-line">
        <div><strong>${escapeHtml(x.product.name)}</strong><div class="muted small">${escapeHtml(x.product.category)}</div></div>
        <div class="qty-control"><button data-minus="${x.id}">−</button><strong>${x.quantity}</strong><button data-plus="${x.id}">+</button></div>
      </div>`).join('') : '<div class="empty">Ton panier est vide.<br>Ajoute des produits depuis le catalogue.</div>'}
    </section>
    <div class="card row-between"><strong>Total des articles</strong><strong>${total}</strong></div>
    <button class="btn btn-secondary btn-block" id="backCatalog">＋ Ajouter des produits</button>
    <div style="height:10px"></div>
    <button class="btn btn-primary btn-block" id="confirmOrder" ${items.length ? '' : 'disabled'}>Confirmer ma déclaration</button>
  `;
  document.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => changeQty(b.dataset.plus, 1));
  document.querySelectorAll('[data-minus]').forEach(b => b.onclick = () => changeQty(b.dataset.minus, -1));
  $('backCatalog').onclick = () => { state.route = 'catalog'; render(); };
  $('confirmOrder').onclick = () => confirmOrder();
}

async function confirmOrder() {
  const items = cartItems();
  if (!items.length) return;

  const btn = $('confirmOrder');
  if (btn) btn.disabled = true;

  try {
    await call('submitDeclaration', state.token, items.map(x => ({ id: x.id, quantity: x.quantity })));
    state.cart = {};
    toast('Déclaration enregistrée !');
    state.route = 'history';
    await historyLoad();
    render();
  } catch (err) {
    toast(err.message);
    if (btn) btn.disabled = false;
  }
}

async function historyLoad() {
  state.history = await call('getMyHistory', state.token);
}

async function historyView() {
  $('view').innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement de ton historique…</p></div>';
  try {
    await historyLoad();
    $('view').innerHTML = `
      <div class="eyebrow">Mes déclarations</div>
      <h1>Historique</h1>
      <p class="muted">Retrouve tes consommations enregistrées.</p>
      ${state.history.length ? state.history.map(d => `
        <section class="card">
          <div class="row-between"><strong>${moneyDate(d.date)}</strong><span class="badge">Validée</span></div>
          <ul>${d.items.map(i => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`).join('')}</ul>
        </section>`).join('') : '<div class="card empty">Aucune déclaration pour le moment.</div>'}
    `;
  } catch (e) {
    toast(e.message);
  }
}

function profileView() {
  const isAdmin = state.user.role === 'ADMIN';
  $('view').innerHTML = `
    <div class="eyebrow">Mon compte</div>
    <h1>Profil</h1>
    <section class="card">
      <h2>${escapeHtml(state.user.name)}</h2>
      <p class="muted small">Rôle : ${isAdmin ? 'Administrateur' : 'Salarié'}</p>
    </section>
    ${isAdmin ? `
    <section class="card">
      <h2>Modifier mon PIN</h2>
      <div class="field"><label>Ancien PIN</label><input id="oldPin" type="password" inputmode="numeric" maxlength="6"></div>
      <div class="field"><label>Nouveau PIN (6 chiffres)</label><input id="newPin" type="password" inputmode="numeric" maxlength="6"></div>
      <button class="btn btn-primary btn-block" id="changePin">Mettre à jour</button>
    </section>` : ''}
    <button class="btn btn-danger btn-block" id="logout">Se déconnecter</button>
  `;
  if (isAdmin) {
    $('changePin').onclick = async () => {
      try {
        await call('changeMyPin', state.token, $('oldPin').value, $('newPin').value);
        toast('PIN mis à jour.');
        $('oldPin').value = '';
        $('newPin').value = '';
      } catch (e) {
        toast(e.message);
      }
    };
  }
  $('logout').onclick = async () => {
    await call('logout', state.token);
    sessionStorage.removeItem('pp_token');
    state.token = '';
    state.user = null;
    state.cart = {};
    renderLogin();
  };
}
async function adminView() {
  if (state.user.role !== 'ADMIN') {
    state.route = 'home';
    return render();
  }
  $('view').innerHTML = `
    <div class="eyebrow">Espace sécurisé</div>
    <h1>Administration</h1>
    <p class="muted">Pilotage des déclarations et gestion de PANIER+.</p>
    <div class="admin-tabs">${[['dashboard', 'Vue d’ensemble'], ['employees', 'Salariés'], ['products', 'Produits'], ['declarations', 'Déclarations']].map(x => `<button class="chip ${state.adminTab === x[0] ? 'active' : ''}" data-admin="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div id="adminContent"><div class="loading"><div class="spinner"></div></div></div>
  `;
  document.querySelectorAll('[data-admin]').forEach(b => b.onclick = () => { state.adminTab = b.dataset.admin; adminView(); });

  try {
    if (state.adminTab === 'dashboard') {
      const s = await call('adminGetStats', state.token);
      $('adminContent').innerHTML = `
        <div class="grid">
          <div class="card"><div class="stat">${s.activeEmployees}</div><div class="stat-label">Salariés actifs</div></div>
          <div class="card"><div class="stat">${s.declarations}</div><div class="stat-label">Déclarations totales</div></div>
          <div class="card"><div class="stat">${s.activeProducts}</div><div class="stat-label">Produits actifs</div></div>
          <div class="card"><div class="stat">${s.today}</div><div class="stat-label">Aujourd’hui</div></div>
        </div>
        <button class="btn btn-secondary btn-block" id="exportCsv">Exporter les déclarations (CSV anonymisé)</button>
      `;
      $('exportCsv').onclick = exportCsv;
    }

    if (state.adminTab === 'employees') {
      const a = await call('adminListEmployees', state.token);
      $('adminContent').innerHTML = `
        <section class="card">
          <h2>Ajouter un salarié</h2>
          <div class="grid">
            <div class="field"><input id="newEmpFirst" placeholder="Prénom"></div>
            <div class="field"><input id="newEmpLast" placeholder="Nom"></div>
          </div>
          <div class="field"><input id="newEmpPin" placeholder="PIN à 6 chiffres" maxlength="6" inputmode="numeric"></div>
          <button class="btn btn-primary btn-block" id="addEmployee">Créer le compte</button>
        </section>
        <section class="card">
          <h2>Comptes existants</h2>
          <div class="table-wrap">
            <table class="data-table">
              <tr><th>Nom</th><th>Rôle</th><th>Actif</th><th></th></tr>
              ${a.map(e => `<tr><td>${escapeHtml(e.nomComplet)}</td><td>${e.role === 'ADMIN' ? 'Admin' : 'Salarié'}</td><td>${e.actif ? 'Oui' : 'Non'}</td><td><button class="chip" data-toggle="${escapeHtml(e.id)}" data-active="${!e.actif}">${e.actif ? 'Désactiver' : 'Activer'}</button></td></tr>`).join('')}
            </table>
          </div>
        </section>
      `;
      $('addEmployee').onclick = async () => {
        try {
          await call('adminSaveEmployee', state.token, {
            nom: $('newEmpLast').value,
            prenom: $('newEmpFirst').value,
            pin: $('newEmpPin').value
          });
          toast('Compte créé.');
          adminView();
        } catch (e) {
          toast(e.message);
        }
      };
      document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
        try {
          await call('adminSetEmployeeActive', state.token, b.dataset.toggle, b.dataset.active === 'true');
          adminView();
        } catch (e) {
          toast(e.message);
        }
      });
    }

    if (state.adminTab === 'products') {
      const a = await call('adminListProducts', state.token);
      $('adminContent').innerHTML = `
        <section class="card">
          <div class="row-between">
            <h2 id="prodFormTitle" style="margin:0">Ajouter un produit</h2>
            <button type="button" class="chip hidden" id="cancelEditProd">Annuler</button>
          </div>
          <input type="hidden" id="prodId">
          <div class="field"><input id="prodName" placeholder="Nom du produit"></div>
          <div class="grid">
            <div class="field"><input id="prodCat" placeholder="Catégorie"></div>
            <div class="field"><input id="prodUnit" placeholder="Unité"></div>
          </div>
          <div class="field"><input id="prodImage" placeholder="URL publique de l’image (facultatif)"></div>
          <div class="field"><input id="prodDesc" placeholder="Description"></div>
          <div class="field"><input id="prodOrder" type="number" placeholder="Ordre d’affichage"></div>
          <button class="btn btn-primary btn-block" id="saveProduct">Enregistrer le produit</button>
        </section>
        <section class="card">
          <h2>Catalogue (${a.length})</h2>
          ${a.map(p => `<div class="cart-line"><div><strong>${escapeHtml(p.NomProduit)}</strong><div class="small muted">${escapeHtml(p.Categorie)} · ${boolClient(p.Actif) ? 'Actif' : 'Inactif'}</div></div><button class="chip" data-editprod="${escapeHtml(p.IDProduit)}">Modifier</button></div>`).join('')}
        </section>
      `;
      $('cancelEditProd').onclick = () => {
        $('prodId').value = '';
        $('prodName').value = '';
        $('prodCat').value = '';
        $('prodUnit').value = '';
        $('prodImage').value = '';
        $('prodDesc').value = '';
        $('prodOrder').value = '';
        $('prodFormTitle').textContent = 'Ajouter un produit';
        $('cancelEditProd').classList.add('hidden');
      };
      $('saveProduct').onclick = async () => {
        try {
          await call('adminSaveProduct', state.token, {
            id: $('prodId').value,
            name: $('prodName').value,
            category: $('prodCat').value,
            unit: $('prodUnit').value,
            image: $('prodImage').value,
            description: $('prodDesc').value,
            order: $('prodOrder').value,
            active: true
          });
          await loadProducts();
          toast('Produit enregistré.');
          adminView();
        } catch (e) {
          toast(e.message);
        }
      };
      document.querySelectorAll('[data-editprod]').forEach(b => b.onclick = () => {
        const p = a.find(x => String(x.IDProduit) === b.dataset.editprod);
        $('prodId').value = p.IDProduit;
        $('prodName').value = p.NomProduit;
        $('prodCat').value = p.Categorie;
        $('prodUnit').value = p.Unite;
        $('prodImage').value = p.ImageURL;
        $('prodDesc').value = p.Description;
        $('prodOrder').value = p.OrdreAffichage;
        $('prodFormTitle').textContent = 'Modifier le produit';
        $('cancelEditProd').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (state.adminTab === 'declarations') {
      const a = await call('adminGetDeclarations', state.token, 200);
      $('adminContent').innerHTML = `
        <section class="card">
          <h2>Dernières déclarations</h2>
          ${a.length ? a.map(d => `<div class="cart-line"><div><strong>${escapeHtml(d.employee)}</strong><div class="small muted">${moneyDate(d.date)}</div><div class="small">${d.items.map(i => `${escapeHtml(i.name)} × ${i.quantity}`).join(' · ')}</div></div></div>`).join('') : '<p class="empty">Aucune déclaration.</p>'}
        </section>
        <button class="btn btn-secondary btn-block" id="exportCsv">Exporter en CSV</button>
      `;
      $('exportCsv').onclick = exportCsv;
    }
  } catch (e) {
    $('adminContent').innerHTML = `<div class="notice error">${escapeHtml(e.message)}</div>`;
  }
}

function boolClient(v) {
  return v === true || String(v).toLowerCase() === 'true';
}

async function exportCsv() {
  try {
    const b64 = await call('adminExportCsv', state.token);
    const a = document.createElement('a');
    a.href = 'data:text/csv;base64,' + b64;
    a.download = 'panier-plus-export.csv';
    a.click();
  } catch (e) {
    toast(e.message);
  }
}

boot();
