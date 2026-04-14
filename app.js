/* ═══════════════════════════════════════════════════
   KhoQR — Application Logic v1.0
   Vanilla JS, no framework
════════════════════════════════════════════════════ */

const App = (() => {

  /* ─────────────────────────────────────
     STATE
  ───────────────────────────────────── */
  const S = {
    gasUrl:      '',
    storeName:   'KhoQR',
    staffName:   '',
    currentPage: 'dashboard',
    scanMode:    'stocktake',        // 'stocktake' | 'export'
    scanners:    {},                 // { scan: Html5Qrcode, import: Html5Qrcode }
    scannerActive: {},               // { scan: bool, import: bool }
    scannedItem: null,               // item found in scan page
    importItem:  null,               // item found in import page
    modalItem:   null,               // item shown in detail modal
    allItems:    [],
    history:     [],
    filterStatus:'all',
    qr:          null,               // current QRCode instance
    isDemo:      false,
    todayCount:  0,
  };

  /* ─────────────────────────────────────
     DEMO DATA (when no GAS)
  ───────────────────────────────────── */
  const DEMO = [
    { 'Mã NL':'NL001', 'Tên NL':'Gạo trắng',   'Đơn vị':'kg',   'Tồn hiện tại':50, 'Tồn tối thiểu':10, 'Tồn tối đa':200, 'Ghi chú':'' },
    { 'Mã NL':'NL002', 'Tên NL':'Dầu ăn',      'Đơn vị':'lít',  'Tồn hiện tại':20, 'Tồn tối thiểu':5,  'Tồn tối đa':50,  'Ghi chú':'' },
    { 'Mã NL':'NL003', 'Tên NL':'Đường trắng', 'Đơn vị':'kg',   'Tồn hiện tại':8,  'Tồn tối thiểu':10, 'Tồn tối đa':100, 'Ghi chú':'Sắp hết!' },
    { 'Mã NL':'NL004', 'Tên NL':'Muối biển',   'Đơn vị':'kg',   'Tồn hiện tại':30, 'Tồn tối thiểu':5,  'Tồn tối đa':80,  'Ghi chú':'' },
    { 'Mã NL':'NL005', 'Tên NL':'Bột mì',      'Đơn vị':'kg',   'Tồn hiện tại':15, 'Tồn tối thiểu':8,  'Tồn tối đa':60,  'Ghi chú':'' },
    { 'Mã NL':'NL006', 'Tên NL':'Nước măm',    'Đơn vị':'chai', 'Tồn hiện tại':6,  'Tồn tối thiểu':5,  'Tồn tối đa':30,  'Ghi chú':'Cần đặt thêm' },
  ];
  const DEMO_HIST = [];

  /* ─────────────────────────────────────
     INIT
  ───────────────────────────────────── */
  function init() {
    // Load settings
    S.gasUrl    = ls('gasUrl')    || '';
    S.storeName = ls('storeName') || 'KhoQR';
    S.staffName = ls('staffName') || '';
    S.isDemo    = ls('isDemo') === '1';

    // Clock
    updateClock();
    setInterval(updateClock, 30000);

    // Splash → then show setup or app
    setTimeout(() => {
      document.getElementById('splash').classList.add('hidden');
      setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        if (!S.gasUrl && !S.isDemo) {
          showSetup();
        } else {
          startApp();
        }
      }, 500);
    }, 1800);
  }

  function startApp() {
    document.getElementById('header-store-name').textContent = S.storeName;
    document.getElementById('app').style.display = 'flex';

    loadDashboard();
    navigate('dashboard');
  }

  function updateClock() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2,'0');
    const m    = String(now.getMinutes()).padStart(2,'0');
    const days = ['CN','T2','T3','T4','T5','T6','T7'];
    const el   = document.getElementById('header-time');
    if (el) el.textContent = `${days[now.getDay()]} ${h}:${m}`;
  }

  /* ─────────────────────────────────────
     SETUP
  ───────────────────────────────────── */
  function showSetup() {
    document.getElementById('setup-overlay').style.display = 'flex';
  }

  function saveSetup() {
    const url   = document.getElementById('setup-url').value.trim();
    const store = document.getElementById('setup-store').value.trim();

    if (!url) { toast('Vui lòng nhập URL GAS', 'error'); return; }

    S.gasUrl    = url;
    S.storeName = store || 'KhoQR';
    S.isDemo    = false;

    ls('gasUrl',    S.gasUrl);
    ls('storeName', S.storeName);
    ls('isDemo',    '');

    document.getElementById('setup-overlay').style.display = 'none';
    startApp();
    toast('Kết nối thành công!', 'success');
  }

  function useDemo() {
    S.isDemo    = true;
    S.storeName = 'Demo Store';
    S.allItems  = JSON.parse(JSON.stringify(DEMO));
    ls('isDemo',    '1');
    ls('storeName', S.storeName);
    document.getElementById('setup-overlay').style.display = 'none';
    startApp();
    toast('Đang dùng chế độ Demo', 'info');
  }

  /* ─────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────── */
  function navigate(page) {
    // Stop old scanners when leaving
    if (S.currentPage === 'scan' && page !== 'scan')   stopScanner('scan');
    if (S.currentPage === 'import' && page !== 'import') stopScanner('import');

    // Deactivate all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Activate target
    const pageEl = document.getElementById('page-' + page);
    const navEl  = document.getElementById('nav-' + page);
    if (pageEl) pageEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    S.currentPage = page;

    // Page-specific init
    if (page === 'scan')   initScanner('scan');
    if (page === 'import') initScanner('import');
    if (page === 'list')   loadAllItems();
    if (page === 'admin' && S.qr === null) populateQRSelect();
  }

  /* ─────────────────────────────────────
     API CALLS (JSONP)
  ───────────────────────────────────── */
  function apiCall(params) {
    if (S.isDemo) return demoCalls(params);
    return new Promise((resolve, reject) => {
      const cb   = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url  = new URL(S.gasUrl);
      Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
      url.searchParams.set('callback', cb);

      const script = document.createElement('script');
      const timer  = setTimeout(() => {
        delete window[cb];
        document.body.removeChild(script);
        reject(new Error('Timeout — Kiểm tra kết nối GAS'));
      }, 10000);

      window[cb] = (data) => {
        clearTimeout(timer);
        delete window[cb];
        document.body.removeChild(script);
        resolve(data);
      };

      script.src = url.toString();
      script.onerror = () => {
        clearTimeout(timer);
        delete window[cb];
        reject(new Error('Lỗi kết nối GAS'));
      };
      document.body.appendChild(script);
    });
  }

  /* ─────────────────────────────────────
     DEMO API STUBS
  ───────────────────────────────────── */
  async function demoCalls(p) {
    await new Promise(r => setTimeout(r, 300)); // simulate latency
    switch (p.action) {
      case 'getAllItems':  return { success:true, items: S.allItems };
      case 'getLowStock': return { success:true, items: S.allItems.filter(it => it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu']) };
      case 'getHistory':  return { success:true, history: [...DEMO_HIST].reverse().slice(0, parseInt(p.limit)||50) };
      case 'getItem': {
        const found = S.allItems.find(it => it['Mã NL'].toUpperCase() === (p.code||'').toUpperCase());
        return found ? { success:true, item: found } : { error: 'Không tìm thấy mã: ' + p.code };
      }
      case 'updateStock': {
        const it = S.allItems.find(i => i['Mã NL'].toUpperCase() === (p.code||'').toUpperCase());
        if (!it) return { error: 'Không tìm thấy mã' };
        const prev = it['Tồn hiện tại'];
        it['Tồn hiện tại'] = p.type==='NHAP' ? prev + Number(p.quantity) : prev - Number(p.quantity);
        if (it['Tồn hiện tại'] < 0) { it['Tồn hiện tại'] = prev; return { error: 'Không đủ tồn kho' }; }
        DEMO_HIST.push({ 'Thời gian': new Date().toISOString(), 'Mã NL': it['Mã NL'], 'Tên NL': it['Tên NL'], 'Loại': p.type, 'Số lượng': p.quantity, 'Nhân viên': p.staff||'Demo', 'Ghi chú': p.note||'', 'Tồn trước': prev, 'Tồn sau': it['Tồn hiện tại'] });
        S.todayCount++;
        return { success:true, newStock: it['Tồn hiện tại'], name: it['Tên NL'], unit: it['Đơn vị'] };
      }
      case 'submitStocktake': {
        const it = S.allItems.find(i => i['Mã NL'].toUpperCase() === (p.code||'').toUpperCase());
        if (!it) return { error: 'Không tìm thấy mã' };
        const prev = it['Tồn hiện tại'];
        it['Tồn hiện tại'] = Number(p.actualQuantity);
        DEMO_HIST.push({ 'Thời gian': new Date().toISOString(), 'Mã NL': it['Mã NL'], 'Tên NL': it['Tên NL'], 'Loại':'KIEM_KHO', 'Số lượng': p.actualQuantity, 'Nhân viên': p.staff||'Demo', 'Ghi chú':'Chênh lệch: '+(Number(p.actualQuantity)-prev), 'Tồn trước': prev, 'Tồn sau': it['Tồn hiện tại'] });
        S.todayCount++;
        return { success:true, systemStock: prev, actual: it['Tồn hiện tại'], diff: it['Tồn hiện tại'] - prev };
      }
      case 'addItem': {
        if (S.allItems.find(i => i['Mã NL'].toUpperCase() === (p.code||'').toUpperCase())) return { error: 'Mã đã tồn tại' };
        S.allItems.push({ 'Mã NL': p.code.toUpperCase(), 'Tên NL': p.name, 'Đơn vị': p.unit, 'Tồn hiện tại': Number(p.currentStock)||0, 'Tồn tối thiểu': Number(p.minStock)||0, 'Tồn tối đa': Number(p.maxStock)||0, 'Ghi chú': p.note||'' });
        return { success:true };
      }
      case 'updateItem': {
        const it = S.allItems.find(i => i['Mã NL'].toUpperCase() === (p.code||'').toUpperCase());
        if (!it) return { error: 'Không tìm thấy' };
        if (p.name !== undefined)     it['Tên NL']       = p.name;
        if (p.unit !== undefined)     it['Đơn vị']       = p.unit;
        if (p.minStock !== undefined) it['Tồn tối thiểu'] = Number(p.minStock);
        if (p.note !== undefined)     it['Ghi chú']      = p.note;
        return { success:true };
      }
      case 'deleteItem': {
        const idx = S.allItems.findIndex(i => i['Mã NL'].toUpperCase() === (p.code||'').toUpperCase());
        if (idx < 0) return { error: 'Không tìm thấy' };
        S.allItems.splice(idx, 1);
        return { success:true };
      }
      default: return { error: 'Unknown demo action: ' + p.action };
    }
  }

  /* ─────────────────────────────────────
     DASHBOARD
  ───────────────────────────────────── */
  async function loadDashboard() {
    try {
      const [allRes, histRes] = await Promise.all([
        apiCall({ action: 'getAllItems' }),
        apiCall({ action: 'getHistory', limit: 20 }),
      ]);

      if (allRes.success) {
        S.allItems = allRes.items;
        const total = allRes.items.length;
        const low   = allRes.items.filter(it => it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu']).length;
        const ok    = total - low;

        document.getElementById('s-total').textContent = total;
        document.getElementById('s-low').textContent   = low;
        document.getElementById('s-ok').textContent    = ok;

        // Low stock list
        const lowItems = allRes.items.filter(it => it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu']);
        renderLowStock(lowItems);
      }

      if (histRes.success) {
        S.history = histRes.history;
        const today = new Date().toLocaleDateString('vi-VN');
        S.todayCount = histRes.history.filter(h => {
          const d = h.ThoiGian ? new Date(h.ThoiGian).toLocaleDateString('vi-VN') : '';
          return d === today;
        }).length;
        document.getElementById('s-today').textContent = S.todayCount;
        renderRecentActivity(histRes.history.slice(0, 8));
      }
    } catch (e) {
      toast('Không thể tải dữ liệu: ' + e.message, 'error');
    }
  }

  function renderLowStock(items) {
    const sec  = document.getElementById('low-section');
    const list = document.getElementById('low-list');
    if (!items.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    list.innerHTML = items.map(it => `
      <div class="low-item">
        <div class="low-info">
          <div class="low-code">${esc(it['Mã NL'])}</div>
          <div class="low-name">${esc(it['Tên NL'])}</div>
          <div class="low-stock">Tồn: ${it['Tồn hiện tại']} ${esc(it['Đơn vị'])} / Tối thiểu: ${it['Tồn tối thiểu']}</div>
        </div>
        <div class="low-badge">⚠️ Sắp Hết</div>
      </div>
    `).join('');
  }

  function renderRecentActivity(history) {
    const list = document.getElementById('recent-list');
    if (!history.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Chưa có giao dịch</div></div>`;
      return;
    }
    list.innerHTML = history.map(h => {
      const cls  = typeClass(h['Loại']);
      const icon = typeIcon(h['Loại']);
      const sign = h['Loại'] === 'NHAP' ? '+' : (h['Loại'] === 'XUAT' ? '-' : '');
      const time = h['Thời gian'] ? fmtTime(new Date(h['Thời gian'])) : '—';
      return `
        <div class="activity-item">
          <div class="act-dot ${cls}">${icon}</div>
          <div class="act-body">
            <div class="act-name">${esc(h['Tên NL'] || h['Mã NL'])}</div>
            <div class="act-meta">${esc(h['Mã NL'])} · ${time}${h['Nhân viên'] ? ' · ' + esc(h['Nhân viên']) : ''}</div>
          </div>
          <div class="act-qty ${cls}">${sign}${h['Số lượng']}</div>
        </div>`;
    }).join('');
  }

  async function refreshData() {
    const btn = document.getElementById('btn-refresh');
    btn.style.opacity = '0.4';
    btn.style.pointerEvents = 'none';
    const page = S.currentPage;
    if (page === 'dashboard') await loadDashboard();
    if (page === 'list')      await loadAllItems();
    if (page === 'admin' && document.getElementById('tab-hist').classList.contains('active')) await loadHistory();
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    toast('Đã cập nhật dữ liệu', 'success');
  }

  /* ─────────────────────────────────────
     QR SCANNER
  ───────────────────────────────────── */
  function initScanner(ctx) {
    // Already running
    if (S.scannerActive[ctx]) return;

    const readerId = 'qr-reader-' + ctx;
    const el = document.getElementById(readerId);
    if (!el) return;

    // Clear any previous content
    el.innerHTML = '';

    try {
      const scanner = new Html5Qrcode(readerId, { verbose: false });
      S.scanners[ctx] = scanner;
      S.scannerActive[ctx] = false;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (decodedText) => handleScan(ctx, decodedText),
        () => {}
      ).then(() => {
        S.scannerActive[ctx] = true;
      }).catch(err => {
        console.warn('Scanner start error:', err);
        el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8888aa;font-size:0.8rem;flex-direction:column;gap:8px;padding:20px;text-align:center">
          <div style="font-size:2rem">📷</div><div>Camera không khả dụng.<br>Dùng nhập thủ công bên dưới.</div>
        </div>`;
      });
    } catch(e) {
      console.warn('Scanner init error:', e);
    }
  }

  function stopScanner(ctx) {
    if (!S.scanners[ctx]) return;
    S.scanners[ctx].stop().catch(() => {});
    S.scanners[ctx] = null;
    S.scannerActive[ctx] = false;
  }

  async function handleScan(ctx, code) {
    // Debounce: pause scanner temporarily
    if (S.scanners[ctx]) {
      try { await S.scanners[ctx].pause(); } catch(e) {}
    }

    const trimmed = code.trim().toUpperCase();

    if (ctx === 'scan')   await lookupItem('scan', trimmed);
    if (ctx === 'import') await lookupItem('import', trimmed);

    // Resume scanner after 3 seconds
    setTimeout(() => {
      if (S.scanners[ctx]) {
        try { S.scanners[ctx].resume(); } catch(e) {}
      }
    }, 3000);
  }

  /* ─────────────────────────────────────
     ITEM LOOKUP
  ───────────────────────────────────── */
  async function lookupItem(ctx, code) {
    if (!code) return;
    try {
      const res = await apiCall({ action: 'getItem', code });
      if (res.error) { toast(res.error, 'error'); return; }
      if (ctx === 'scan')   showScanResult(res.item);
      if (ctx === 'import') showImportResult(res.item);
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }

  function manualLookup(ctx) {
    const input = document.getElementById('manual-' + ctx);
    const code  = input ? input.value.trim() : '';
    if (!code) { toast('Vui lòng nhập mã nguyên liệu', 'error'); return; }
    lookupItem(ctx, code.toUpperCase());
    if (input) input.value = '';
  }

  /* ─────────────────────────────────────
     SCAN MODE & RESULT (scan page)
  ───────────────────────────────────── */
  function setScanMode(mode) {
    S.scanMode = mode;
    document.getElementById('mode-btn-stocktake').classList.toggle('active', mode === 'stocktake');
    document.getElementById('mode-btn-export').classList.toggle('active', mode === 'export');
    document.getElementById('form-stocktake').style.display = mode === 'stocktake' ? '' : 'none';
    document.getElementById('form-export').style.display    = mode === 'export'   ? '' : 'none';
    document.getElementById('scan-save-label').textContent  = mode === 'stocktake' ? 'Lưu Kết Quả Kiểm Kho' : 'Xác Nhận Xuất Kho';

    // Reset result panel
    closeScanResult();
  }

  function showScanResult(item) {
    S.scannedItem = item;
    const panel = document.getElementById('scan-result');
    document.getElementById('scan-res-code').textContent  = item['Mã NL'];
    document.getElementById('scan-res-name').textContent  = item['Tên NL'];
    document.getElementById('scan-res-unit').textContent  = item['Đơn vị'];
    document.getElementById('scan-res-stock').textContent = item['Tồn hiện tại'] + ' ' + item['Đơn vị'];
    document.getElementById('scan-qty').value = '';
    document.getElementById('scan-qty-exp') && (document.getElementById('scan-qty-exp').value = '');
    document.getElementById('scan-note').value = '';
    panel.style.display = '';
    // Scroll to it
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  function closeScanResult() {
    document.getElementById('scan-result').style.display = 'none';
    S.scannedItem = null;
  }

  async function saveScan() {
    if (!S.scannedItem) return;
    const item = S.scannedItem;
    const mode = S.scanMode;
    const note = document.getElementById('scan-note').value.trim();
    const qtyId = mode === 'stocktake' ? 'scan-qty' : 'scan-qty-exp';
    const qty  = parseFloat(document.getElementById(qtyId).value);

    if (isNaN(qty) || qty < 0) { toast('Vui lòng nhập số lượng hợp lệ', 'error'); return; }

    const btn = document.getElementById('scan-save-btn');
    setBtnLoading(btn, true);

    try {
      let res;
      if (mode === 'stocktake') {
        res = await apiCall({ action:'submitStocktake', code: item['Mã NL'], actualQuantity: qty, staff: S.staffName, note });
      } else {
        res = await apiCall({ action:'updateStock', code: item['Mã NL'], type:'XUAT', quantity: qty, staff: S.staffName, note });
      }

      if (res.error) { toast(res.error, 'error'); return; }

      const label = mode === 'stocktake' ? 'Đã lưu kiểm kho!' : 'Xuất kho thành công!';
      if (mode === 'stocktake' && res.diff !== undefined) {
        const diff = res.diff;
        const diffStr = diff === 0 ? 'Chính xác' : (diff > 0 ? '+' + diff + ' (thừa)' : diff + ' (thiếu)');
        toast(`${label} Chênh lệch: ${diffStr}`, 'success');
      } else {
        toast(label, 'success');
      }
      closeScanResult();

      // Re-init scanner
      if (S.scanners['scan']) {
        try { S.scanners['scan'].resume(); } catch(e) {}
      }
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  /* ─────────────────────────────────────
     IMPORT RESULT
  ───────────────────────────────────── */
  function showImportResult(item) {
    S.importItem = item;
    const panel = document.getElementById('import-result');
    document.getElementById('import-res-code').textContent  = item['Mã NL'];
    document.getElementById('import-res-name').textContent  = item['Tên NL'];
    document.getElementById('import-res-unit').textContent  = item['Đơn vị'];
    document.getElementById('import-res-stock').textContent = item['Tồn hiện tại'] + ' ' + item['Đơn vị'];
    document.getElementById('import-qty').value  = '';
    document.getElementById('import-note').value = '';
    panel.style.display = '';
    setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
  }

  function closeImportResult() {
    document.getElementById('import-result').style.display = 'none';
    S.importItem = null;
  }

  async function saveImport() {
    if (!S.importItem) return;
    const qty  = parseFloat(document.getElementById('import-qty').value);
    const note = document.getElementById('import-note').value.trim();

    if (isNaN(qty) || qty <= 0) { toast('Vui lòng nhập số lượng > 0', 'error'); return; }

    const btn = document.querySelector('#import-result .btn-success');
    setBtnLoading(btn, true);

    try {
      const res = await apiCall({ action:'updateStock', code: S.importItem['Mã NL'], type:'NHAP', quantity: qty, staff: S.staffName, note });
      if (res.error) { toast(res.error, 'error'); return; }
      toast(`Đã nhập ${qty} ${S.importItem['Đơn vị']} ${S.importItem['Tên NL']}`, 'success');
      closeImportResult();
      if (S.scanners['import']) {
        try { S.scanners['import'].resume(); } catch(e) {}
      }
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  /* ─────────────────────────────────────
     INVENTORY LIST
  ───────────────────────────────────── */
  async function loadAllItems() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><span>Đang tải...</span></div>`;

    try {
      const res = await apiCall({ action: 'getAllItems' });
      if (res.error) { toast(res.error, 'error'); return; }
      S.allItems = res.items;
      renderInventoryList(S.allItems);
      populateQRSelect();
    } catch(e) {
      toast('Lỗi tải danh sách: ' + e.message, 'error');
    }
  }

  function renderInventoryList(items) {
    const list = document.getElementById('inventory-list');
    if (!items.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Chưa có nguyên liệu nào</div><div class="empty-sub">Thêm nguyên liệu trong tab Quản Lý</div></div>`;
      return;
    }

    list.innerHTML = items.map(it => {
      const isLow  = it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu'];
      const isCrit = it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu'] * 0.5;
      const stockCls = isCrit ? 'crit' : (isLow ? 'low' : 'ok');
      const initials = it['Mã NL'].slice(0,3).toUpperCase();
      return `
        <div class="inv-item ${isLow ? 'low' : ''}" onclick="App.showItemModal('${esc(it['Mã NL'])}')">
          <div class="inv-code-badge">
            <span class="icb-code">${esc(initials)}</span>
            <span class="icb-icon">📦</span>
          </div>
          <div class="inv-body">
            <div class="inv-name">${esc(it['Tên NL'])}</div>
            <div class="inv-unit">${esc(it['Mã NL'])} · ${esc(it['Đơn vị'])}${isLow ? ' · ⚠️' : ''}</div>
          </div>
          <div class="inv-stock-block">
            <div class="inv-stock-val ${stockCls}">${it['Tồn hiện tại']}</div>
            <div class="inv-stock-unit">${esc(it['Đơn vị'])}</div>
          </div>
        </div>`;
    }).join('');
  }

  function filterList() {
    const q = (document.getElementById('list-search').value || '').toLowerCase();
    let items = S.allItems;

    if (q) {
      items = items.filter(it =>
        it['Mã NL'].toLowerCase().includes(q) ||
        it['Tên NL'].toLowerCase().includes(q)
      );
    }
    if (S.filterStatus === 'low') {
      items = items.filter(it => it['Tồn tối thiểu'] > 0 && it['Tồn hiện tại'] <= it['Tồn tối thiểu']);
    } else if (S.filterStatus === 'ok') {
      items = items.filter(it => it['Tồn tối thiểu'] === 0 || it['Tồn hiện tại'] > it['Tồn tối thiểu']);
    }
    renderInventoryList(items);
  }

  function setFilter(status, btn) {
    S.filterStatus = status;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    filterList();
  }

  /* ─────────────────────────────────────
     ITEM MODAL
  ───────────────────────────────────── */
  function showItemModal(code) {
    const item = S.allItems.find(it => it['Mã NL'] === code);
    if (!item) return;
    S.modalItem = item;

    document.getElementById('item-modal-title').textContent = item['Tên NL'];

    const isLow = item['Tồn tối thiểu'] > 0 && item['Tồn hiện tại'] <= item['Tồn tối thiểu'];
    const stockCls = isLow ? 'is-current' + (item['Tồn hiện tại'] <= 0 ? ' is-min' : '') : 'is-current';

    document.getElementById('item-modal-body').innerHTML = `
      <div class="item-detail">
        <div class="item-detail-header">
          <div class="item-code-circle">
            <span class="icc-code">${esc(item['Mã NL'])}</span>
            <span class="icc-icon">📦</span>
          </div>
          <div>
            <div class="item-d-name">${esc(item['Tên NL'])}</div>
            <div class="item-d-unit">Đơn vị: ${esc(item['Đơn vị'])}${isLow ? ' · ⚠️ Sắp hết' : ''}</div>
          </div>
        </div>
        <div class="item-stat-row">
          <div class="item-stat">
            <div class="is-val ${stockCls}">${item['Tồn hiện tại']}</div>
            <div class="is-label">Tồn Hiện Tại</div>
          </div>
          <div class="item-stat">
            <div class="is-val is-min">${item['Tồn tối thiểu'] || '—'}</div>
            <div class="is-label">Tối Thiểu</div>
          </div>
          <div class="item-stat">
            <div class="is-val is-max">${item['Tồn tối đa'] || '—'}</div>
            <div class="is-label">Tối Đa</div>
          </div>
        </div>
        ${item['Ghi chú'] ? `<div class="item-note">📝 ${esc(item['Ghi chú'])}</div>` : ''}
      </div>`;
    document.getElementById('item-overlay').style.display = 'flex';
  }

  function closeItemModal() {
    document.getElementById('item-overlay').style.display = 'none';
  }

  async function deleteItem() {
    if (!S.modalItem) return;
    if (!confirm(`Xoá "${S.modalItem['Tên NL']}" (${S.modalItem['Mã NL']})?`)) return;
    try {
      const res = await apiCall({ action:'deleteItem', code: S.modalItem['Mã NL'] });
      if (res.error) { toast(res.error, 'error'); return; }
      toast('Đã xoá ' + S.modalItem['Tên NL'], 'success');
      closeItemModal();
      S.allItems = S.allItems.filter(it => it['Mã NL'] !== S.modalItem['Mã NL']);
      filterList();
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }

  function genQRFromModal() {
    if (!S.modalItem) return;
    closeItemModal();
    navigate('admin');
    showTab('qr');
    setTimeout(() => generateQRCode(S.modalItem['Mã NL'], S.modalItem['Tên NL']), 100);
  }

  function openEditModal() {
    if (!S.modalItem) return;
    const it = S.modalItem;
    document.getElementById('edit-code').value       = it['Mã NL'];
    document.getElementById('edit-name').value       = it['Tên NL'];
    document.getElementById('edit-unit').value       = it['Đơn vị'];
    document.getElementById('edit-min').value        = it['Tồn tối thiểu'] || '';
    document.getElementById('edit-note-val').value   = it['Ghi chú'] || '';
    closeItemModal();
    document.getElementById('edit-overlay').style.display = 'flex';
  }

  function closeEditModal() {
    document.getElementById('edit-overlay').style.display = 'none';
  }

  async function saveEdit() {
    const code = document.getElementById('edit-code').value;
    const name = document.getElementById('edit-name').value.trim();
    const unit = document.getElementById('edit-unit').value.trim();
    const min  = document.getElementById('edit-min').value;
    const note = document.getElementById('edit-note-val').value.trim();

    const btn = document.querySelector('#edit-overlay .btn-primary');
    setBtnLoading(btn, true);
    try {
      const res = await apiCall({ action:'updateItem', code, name, unit, minStock: min, note });
      if (res.error) { toast(res.error, 'error'); return; }
      toast('Đã cập nhật!', 'success');
      closeEditModal();
      await loadAllItems();
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    finally { setBtnLoading(btn, false); }
  }

  /* ─────────────────────────────────────
     ADD ITEM (Admin Tab)
  ───────────────────────────────────── */
  async function addItem() {
    const code  = document.getElementById('add-code').value.trim();
    const name  = document.getElementById('add-name').value.trim();
    const unit  = document.getElementById('add-unit').value.trim();
    const stock = document.getElementById('add-stock').value;
    const min   = document.getElementById('add-min').value;
    const max   = document.getElementById('add-max').value;
    const note  = document.getElementById('add-note').value.trim();

    if (!code)  { toast('Cần nhập Mã NL', 'error'); return; }
    if (!name)  { toast('Cần nhập Tên NL', 'error'); return; }
    if (!unit)  { toast('Cần nhập Đơn vị', 'error'); return; }

    const btn = document.querySelector('#tab-content-add .btn-primary');
    setBtnLoading(btn, true);
    try {
      const res = await apiCall({ action:'addItem', code: code.toUpperCase(), name, unit, currentStock: stock||0, minStock: min||0, maxStock: max||0, note });
      if (res.error) { toast(res.error, 'error'); return; }
      toast('Đã thêm ' + name + '!', 'success');
      ['add-code','add-name','add-unit','add-stock','add-min','add-max','add-note'].forEach(id => { document.getElementById(id).value = ''; });
      await loadAllItems();
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    finally { setBtnLoading(btn, false); }
  }

  /* ─────────────────────────────────────
     ADMIN TABS
  ───────────────────────────────────── */
  function showTab(tab) {
    ['add','qr','hist'].forEach(t => {
      document.getElementById('tab-' + t).classList.toggle('active', t === tab);
      document.getElementById('tab-content-' + t).style.display = t === tab ? '' : 'none';
    });
    if (tab === 'hist') loadHistory();
    if (tab === 'qr')   populateQRSelect();
  }

  /* ─────────────────────────────────────
     HISTORY
  ───────────────────────────────────── */
  async function loadHistory() {
    const list = document.getElementById('hist-list');
    list.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><span>Đang tải...</span></div>`;
    try {
      const res = await apiCall({ action:'getHistory', limit: 100 });
      if (res.error) { toast(res.error, 'error'); return; }
      S.history = res.history;
      renderHistory(res.history);
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }

  function applyHistFilter() {
    const type = document.getElementById('hist-filter').value;
    const filtered = type ? S.history.filter(h => h['Loại'] === type) : S.history;
    renderHistory(filtered);
  }

  function renderHistory(history) {
    const list = document.getElementById('hist-list');
    if (!history.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Không có giao dịch</div></div>`;
      return;
    }
    list.innerHTML = history.map(h => {
      const cls  = typeClass(h['Loại']);
      const icon = typeIcon(h['Loại']);
      const sign = h['Loại'] === 'NHAP' ? '+' : (h['Loại'] === 'XUAT' ? '-' : '');
      const time = h['Thời gian'] ? fmtTime(new Date(h['Thời gian'])) : '—';
      return `
        <div class="hist-item">
          <div class="hist-type-badge ${cls}">${icon}</div>
          <div class="hist-body">
            <div class="hist-code">${esc(h['Mã NL'])} · ${fmtLoai(h['Loại'])}</div>
            <div class="hist-name">${esc(h['Tên NL'] || h['Mã NL'])}</div>
            <div class="hist-time">${time}${h['Nhân viên'] ? ' · ' + esc(h['Nhân viên']) : ''}</div>
          </div>
          <div class="hist-qty ${cls}">${sign}${h['Số lượng']}</div>
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────
     QR CODE GENERATION
  ───────────────────────────────────── */
  function populateQRSelect() {
    const sel = document.getElementById('qr-select');
    if (!sel) return;
    const opts = S.allItems.map(it => `<option value="${esc(it['Mã NL'])}" data-name="${esc(it['Tên NL'])}">${esc(it['Mã NL'])} — ${esc(it['Tên NL'])}</option>`).join('');
    sel.innerHTML = '<option value="">— Chọn nguyên liệu —</option>' + opts;
  }

  function genQRFromSelect() {
    const sel  = document.getElementById('qr-select');
    const code = sel.value;
    if (!code) return;
    const opt  = sel.options[sel.selectedIndex];
    const name = opt ? opt.dataset.name : '';
    generateQRCode(code, name);
  }

  function genQRManual() {
    const code = document.getElementById('qr-code-input').value.trim().toUpperCase();
    if (!code) { toast('Nhập mã nguyên liệu', 'error'); return; }
    const item = S.allItems.find(it => it['Mã NL'].toUpperCase() === code);
    generateQRCode(code, item ? item['Tên NL'] : code);
  }

  function generateQRCode(code, name) {
    const canvas = document.getElementById('qr-canvas');
    canvas.innerHTML = '';

    if (S.qr) {
      try { S.qr.clear(); } catch(e) {}
    }

    S.qr = new QRCode(canvas, {
      text:          code,
      width:         180,
      height:        180,
      colorDark:     '#000000',
      colorLight:    '#ffffff',
      correctLevel:  QRCode.CorrectLevel.H,
    });

    document.getElementById('qr-label-code').textContent = code;
    document.getElementById('qr-label-name').textContent = name || code;
    document.getElementById('qr-output').style.display = '';
  }

  function downloadQR() {
    const canvas = document.querySelector('#qr-canvas canvas');
    if (!canvas) { toast('Chưa có QR để tải', 'error'); return; }
    const link = document.createElement('a');
    link.download = 'QR_' + (document.getElementById('qr-label-code').textContent || 'code') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function printQR() {
    const code = document.getElementById('qr-label-code').textContent;
    const name = document.getElementById('qr-label-name').textContent;
    const canvas = document.querySelector('#qr-canvas canvas');
    if (!canvas) { toast('Chưa có QR để in', 'error'); return; }
    const imgSrc = canvas.toDataURL('image/png');
    const print  = document.getElementById('print-area');
    print.innerHTML = `
      <div style="text-align:center;padding:20px;font-family:Arial,sans-serif">
        <img src="${imgSrc}" style="width:200px;height:200px" />
        <div style="font-size:14px;font-weight:bold;margin-top:8px">${esc(code)}</div>
        <div style="font-size:11px;color:#555">${esc(name)}</div>
      </div>`;
    window.print();
  }

  function printAllQR() {
    if (!S.allItems.length) { toast('Chưa có dữ liệu nguyên liệu', 'error'); return; }

    const print = document.getElementById('print-area');
    print.innerHTML = `<div class="print-qr-grid" id="bulk-qr-grid"></div>`;
    const grid = document.getElementById('bulk-qr-grid');

    let rendered = 0;
    S.allItems.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'print-qr-item';
      div.innerHTML = `<div class="pqi-code">${esc(item['Mã NL'])}</div><div class="pqi-name">${esc(item['Tên NL'])}</div>`;
      const qrDiv = document.createElement('div');
      div.appendChild(qrDiv);
      grid.appendChild(div);

      new QRCode(qrDiv, {
        text: item['Mã NL'], width: 100, height: 100,
        colorDark: '#000', colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.H,
      });

      rendered++;
      if (rendered === S.allItems.length) {
        setTimeout(() => window.print(), 800);
      }
    });
  }

  /* ─────────────────────────────────────
     SETTINGS
  ───────────────────────────────────── */
  function openSettings() {
    document.getElementById('settings-store').value = ls('storeName') || '';
    document.getElementById('settings-url').value   = ls('gasUrl') || '';
    document.getElementById('settings-staff').value = ls('staffName') || '';
    document.getElementById('settings-overlay').style.display = 'flex';
  }

  function closeSettings() {
    document.getElementById('settings-overlay').style.display = 'none';
  }

  function saveSettings() {
    const store = document.getElementById('settings-store').value.trim();
    const url   = document.getElementById('settings-url').value.trim();
    const staff = document.getElementById('settings-staff').value.trim();
    ls('storeName', store);
    ls('gasUrl',    url);
    ls('staffName', staff);
    S.storeName = store || 'KhoQR';
    S.gasUrl    = url;
    S.staffName = staff;
    document.getElementById('header-store-name').textContent = S.storeName;
    closeSettings();
    toast('Đã lưu cài đặt', 'success');
  }

  function resetApp() {
    if (!confirm('Xoá toàn bộ dữ liệu cục bộ? (Dữ liệu GAS không bị ảnh hưởng)')) return;
    localStorage.clear();
    location.reload();
  }

  /* ─────────────────────────────────────
     QUANTITY ADJUST HELPER
  ───────────────────────────────────── */
  function adjQty(id, delta) {
    const el  = document.getElementById(id);
    if (!el) return;
    const val = parseFloat(el.value) || 0;
    el.value  = Math.max(0, Math.round((val + delta) * 100) / 100);
  }

  /* ─────────────────────────────────────
     HELPERS
  ───────────────────────────────────── */
  function ls(key, val) {
    if (val !== undefined) { try { localStorage.setItem('khoqr_' + key, val); } catch(e) {} return val; }
    try { return localStorage.getItem('khoqr_' + key) || ''; } catch(e) { return ''; }
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtTime(date) {
    if (!(date instanceof Date) || isNaN(date)) return '—';
    const now  = new Date();
    const diff = now - date;
    if (diff < 60000)    return 'Vừa xong';
    if (diff < 3600000)  return Math.floor(diff/60000) + ' phút trước';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' giờ trước';
    return date.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function typeClass(loai) {
    return loai === 'NHAP' ? 'nhap' : (loai === 'XUAT' ? 'xuat' : 'kiem');
  }

  function typeIcon(loai) {
    return loai === 'NHAP' ? '📥' : (loai === 'XUAT' ? '📤' : '🔍');
  }

  function fmtLoai(loai) {
    return loai === 'NHAP' ? 'Nhập Kho' : (loai === 'XUAT' ? 'Xuất Kho' : 'Kiểm Kho');
  }

  let _toastTimer;
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = 'toast show ' + type;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3500);
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = loading
      ? '<div class="spinner" style="width:18px;height:18px;border-color:rgba(255,255,255,0.3);border-top-color:currentColor"></div>'
      : btn.dataset.orig;
  }

  /* ─────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────── */
  return {
    init,
    navigate,
    saveSetup,
    useDemo,

    // Scan page
    setScanMode,
    manualLookup,
    closeScanResult,
    saveScan,
    adjQty,

    // Import page
    closeImportResult,
    saveImport,

    // List page
    loadAllItems,
    filterList,
    setFilter,

    // Item modal
    showItemModal,
    closeItemModal,
    deleteItem,
    genQRFromModal,
    openEditModal,
    closeEditModal,
    saveEdit,

    // Admin
    addItem,
    showTab,
    applyHistFilter,
    loadHistory,
    genQRFromSelect,
    genQRManual,
    downloadQR,
    printQR,
    printAllQR,

    // Settings
    openSettings,
    closeSettings,
    saveSettings,
    resetApp,
    refreshData,
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
