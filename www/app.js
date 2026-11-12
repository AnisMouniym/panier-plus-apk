/* ==========================================================================
   BASE DE DONNÉES LOCALE
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
        PIN: '482916',
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
    const user = requireSession(token);
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
      $('loginError').classList.add('hidden');$('submitLoginBtn').click();
    }
  }
}

function delPin() {
  const input = $('pin');
  input.value = input.value.slice(0, -1);
  updatePinDisplay();
}

function clearPin() {
  $('
