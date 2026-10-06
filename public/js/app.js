import { FamilyTreeAPI } from './api.js';
import { D3HierarchyRenderer } from './d3-tree.js';
import { D3GraphRenderer } from './d3-graph.js';

/**
 * Main Application State
 */
const state = {
  trees: [],
  selectedTreeId: null,
  currentFormat: 'hierarchy', // 'hierarchy' | 'graph'
  direction: 'descendants',   // 'descendants' | 'ancestors'
  rootPersonId: null,
  selectedPerson: null,
  activeRenderer: null,
};

// DOM References
const elements = {
  treeSelect: document.getElementById('tree-select'),
  formatHierarchyBtn: document.getElementById('btn-format-hierarchy'),
  formatGraphBtn: document.getElementById('btn-format-graph'),
  directionSelect: document.getElementById('direction-select'),
  loadingOverlay: document.getElementById('loading-overlay'),
  svgCanvas: document.getElementById('tree-canvas'),
  
  // HUD
  statNodes: document.getElementById('stat-total-nodes'),
  statDepth: document.getElementById('stat-max-depth'),
  statDirection: document.getElementById('stat-direction'),
  
  // Zoom
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),

  // Drawer
  drawer: document.getElementById('inspector-drawer'),
  drawerCloseBtn: document.getElementById('btn-close-drawer'),
  drawerAvatar: document.getElementById('drawer-avatar'),
  drawerName: document.getElementById('drawer-name'),
  drawerGenderTag: document.getElementById('drawer-gender-tag'),
  drawerBirth: document.getElementById('drawer-birth'),
  drawerDeath: document.getElementById('drawer-death'),
  drawerLiving: document.getElementById('drawer-living'),
  drawerNotes: document.getElementById('drawer-notes'),
  drawerPartnersList: document.getElementById('drawer-partners-list'),
  drawerChildrenList: document.getElementById('drawer-children-list'),
  btnFocusPerson: document.getElementById('btn-focus-person'),
  btnViewCousins: document.getElementById('btn-view-cousins'),
};

/**
 * Initialize Application
 */
async function initApp() {
  setupEventListeners();
  await loadTrees();
}

/**
 * Event Listeners
 */
function setupEventListeners() {
  // Tree change
  elements.treeSelect.addEventListener('change', (e) => {
    state.selectedTreeId = e.target.value;
    state.rootPersonId = null;
    loadAndRenderTree();
  });

  // Format Switchers
  elements.formatHierarchyBtn.addEventListener('click', () => {
    if (state.currentFormat === 'hierarchy') return;
    state.currentFormat = 'hierarchy';
    elements.formatHierarchyBtn.classList.add('active');
    elements.formatGraphBtn.classList.remove('active');
    loadAndRenderTree();
  });

  elements.formatGraphBtn.addEventListener('click', () => {
    if (state.currentFormat === 'graph') return;
    state.currentFormat = 'graph';
    elements.formatGraphBtn.classList.add('active');
    elements.formatHierarchyBtn.classList.remove('active');
    loadAndRenderTree();
  });

  // Direction Change
  elements.directionSelect.addEventListener('change', (e) => {
    state.direction = e.target.value;
    loadAndRenderTree();
  });

  // Zoom Controls
  elements.btnZoomIn.addEventListener('click', () => state.activeRenderer?.zoomIn());
  elements.btnZoomOut.addEventListener('click', () => state.activeRenderer?.zoomOut());
  elements.btnZoomReset.addEventListener('click', () => state.activeRenderer?.resetZoom());

  // Drawer Close
  elements.drawerCloseBtn.addEventListener('click', closeDrawer);

  // Focus Person
  elements.btnFocusPerson.addEventListener('click', () => {
    if (!state.selectedPerson) return;
    state.rootPersonId = state.selectedPerson.id;
    closeDrawer();
    loadAndRenderTree();
  });

  // View Cousins
  elements.btnViewCousins.addEventListener('click', async () => {
    if (!state.selectedPerson) return;
    showLoading(true);
    try {
      const cousins = await FamilyTreeAPI.getCousins(state.selectedTreeId, state.selectedPerson.id);
      renderCousinsModal(cousins);
    } catch (err) {
      alert(`Sepupu tidak ditemukan: ${err.message}`);
    } finally {
      showLoading(false);
    }
  });

  // Window Resize
  window.addEventListener('resize', () => {
    if (state.activeRenderer) {
      state.activeRenderer.fitToScreen();
    }
  });
}

/**
 * Load List of Family Trees
 */
async function loadTrees() {
  showLoading(true);
  try {
    const trees = await FamilyTreeAPI.getTrees();
    state.trees = trees;

    elements.treeSelect.innerHTML = '';
    if (trees.length === 0) {
      elements.treeSelect.innerHTML = '<option value="">(Belum ada tree)</option>';
      return;
    }

    trees.forEach((tree, idx) => {
      const opt = document.createElement('option');
      opt.value = tree.id;
      opt.textContent = `${tree.name} (${tree._count?.persons || 0} anggota)`;
      elements.treeSelect.appendChild(opt);
    });

    state.selectedTreeId = trees[0].id;
    await loadAndRenderTree();
  } catch (err) {
    console.error('Error loading trees:', err);
  } finally {
    showLoading(false);
  }
}

/**
 * Load Tree and Render
 */
async function loadAndRenderTree() {
  if (!state.selectedTreeId) return;

  showLoading(true);
  try {
    const renderPayload = await FamilyTreeAPI.renderTree(state.selectedTreeId, {
      format: state.currentFormat,
      direction: state.direction,
      rootPersonId: state.rootPersonId,
    });

    // Update HUD Stats
    updateStats(renderPayload.meta);

    // Initialize renderer depending on format
    if (state.currentFormat === 'hierarchy') {
      state.activeRenderer = new D3HierarchyRenderer(elements.svgCanvas, {
        onNodeClick: (person) => openPersonInspector(person),
      });
      state.activeRenderer.render(renderPayload.data);
    } else {
      state.activeRenderer = new D3GraphRenderer(elements.svgCanvas, {
        onNodeClick: (person) => openPersonInspector(person),
      });
      state.activeRenderer.render(renderPayload.data);
    }
  } catch (err) {
    console.error('Error rendering tree:', err);
    alert(`Gagal merender silsilah: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

/**
 * Update HUD Stats
 */
function updateStats(meta) {
  if (!meta) return;
  elements.statNodes.textContent = meta.totalNodes ?? '-';
  elements.statDepth.textContent = meta.maxDepth ?? 'Semua';
  elements.statDirection.textContent = meta.direction === 'ancestors' ? 'Leluhur (Ke Atas)' : 'Keturunan (Ke Bawah)';
}

/**
 * Open Inspector Drawer with Person details
 */
async function openPersonInspector(person) {
  state.selectedPerson = person;
  elements.drawer.classList.add('open');

  // Fill Basic Info
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  elements.drawerName.textContent = fullName || 'Tanpa Nama';
  elements.drawerAvatar.textContent = person.firstName ? person.firstName.charAt(0).toUpperCase() : '?';

  const isMale = (person.gender || 'male') === 'male';
  elements.drawerGenderTag.textContent = isMale ? 'Laki-laki' : 'Perempuan';
  elements.drawerGenderTag.className = `gender-tag ${isMale ? 'male' : 'female'}`;

  elements.drawerBirth.textContent = person.birthDate ? new Date(person.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  elements.drawerDeath.textContent = person.deathDate ? new Date(person.deathDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  elements.drawerLiving.textContent = person.isLiving ? '✅ Masih Hidup' : '🕊️ Wafat';
  elements.drawerNotes.textContent = person.notes || 'Tidak ada catatan silsilah.';

  // Partners List
  elements.drawerPartnersList.innerHTML = '';
  if (person.partners && person.partners.length > 0) {
    person.partners.forEach(partner => {
      const chip = document.createElement('div');
      chip.className = 'relation-chip';
      chip.innerHTML = `
        <span>💍 ${partner.firstName || ''} ${partner.lastName || ''}</span>
        <span class="chip-tag">${partner.type || 'Pasangan'}</span>
      `;
      chip.addEventListener('click', () => openPersonInspector(partner));
      elements.drawerPartnersList.appendChild(chip);
    });
  } else {
    elements.drawerPartnersList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Tidak ada pasangan terdaftar</span>';
  }

  // Children List
  elements.drawerChildrenList.innerHTML = '';
  if (person.children && person.children.length > 0) {
    person.children.forEach(child => {
      const chip = document.createElement('div');
      chip.className = 'relation-chip';
      chip.innerHTML = `
        <span>👶 ${child.firstName || ''} ${child.lastName || ''}</span>
        <span class="chip-tag">${child.relationType || 'Anak'}</span>
      `;
      chip.addEventListener('click', () => openPersonInspector(child));
      elements.drawerChildrenList.appendChild(chip);
    });
  } else {
    elements.drawerChildrenList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Tidak ada anak terdaftar</span>';
  }
}

function closeDrawer() {
  elements.drawer.classList.remove('open');
}

/**
 * Modal to display cousins
 */
function renderCousinsModal(cousins) {
  if (!cousins || cousins.length === 0) {
    alert('Tidak ditemukan sepupu untuk anggota ini.');
    return;
  }
  const names = cousins.map(c => `• ${c.firstName} ${c.lastName || ''} (${c.gender === 'male' ? 'L' : 'P'})`).join('\n');
  alert(`Daftar Sepupu (${cousins.length} orang):\n\n${names}`);
}

/**
 * Show / Hide Loading Overlay
 */
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    elements.loadingOverlay.classList.add('hidden');
  }
}

// Start application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
