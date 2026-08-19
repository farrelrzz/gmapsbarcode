(function () {
  "use strict";

  const state = { codes: [], selected: new Set(), baseUrl: "" };

  const $ = (id) => document.getElementById(id);
  const loginScreen = $("loginScreen");
  const app = $("app");

  // ---------- API helper ----------
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      throw new Error((data && data.error) || "Terjadi kesalahan.");
    }
    return data;
  }

  // ---------- Auth ----------
  async function checkSession() {
    const { isAdmin } = await api("/api/session");
    if (isAdmin) {
      showApp();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    app.hidden = true;
  }

  async function showApp() {
    loginScreen.hidden = true;
    app.hidden = false;
    const cfg = await api("/api/config");
    state.baseUrl = cfg.baseUrl;
    $("baseUrlLabel").textContent = cfg.baseUrl + "/r/{kode}";
    await refreshAll();
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginError").hidden = true;
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: $("loginPassword").value }),
      });
      $("loginPassword").value = "";
      await showApp();
    } catch (err) {
      $("loginError").textContent = err.message;
      $("loginError").hidden = false;
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    showLogin();
  });

  // ---------- Data ----------
  async function refreshAll() {
    await Promise.all([refreshStats(), refreshTable()]);
  }

  async function refreshStats() {
    const s = await api("/api/stats");
    $("statTotal").textContent = s.total;
    $("statActive").textContent = s.active;
    $("statInactive").textContent = s.inactive;
    $("statScans").textContent = s.scans;
  }

  async function refreshTable() {
    const search = $("searchInput").value.trim();
    const status = $("statusFilter").value;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const { codes } = await api("/api/codes?" + params.toString());
    state.codes = codes;
    renderTable();
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderTable() {
    const body = $("tableBody");
    if (!state.codes.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-row">Belum ada kode. Klik "Buat Kode Baru" untuk mulai.</td></tr>`;
      return;
    }
    body.innerHTML = state.codes
      .map((c) => {
        const checked = state.selected.has(c.code) ? "checked" : "";
        const pill =
          c.status === "active"
            ? `<span class="status-pill active"><span class="dot"></span>Aktif</span>`
            : `<span class="status-pill inactive"><span class="dot"></span>Belum aktif</span>`;
        const linkCell = c.targetUrl
          ? `<a href="${escapeAttr(c.targetUrl)}" target="_blank" rel="noopener">${escapeHtml(c.targetUrl)}</a>`
          : `<span class="muted">—</span>`;
        const actions =
          c.status === "active"
            ? `<button data-act="deactivate" data-code="${c.code}">Nonaktifkan</button>
               <button data-act="edit" data-code="${c.code}">Ubah Link</button>
               <button data-act="print1" data-code="${c.code}">Cetak</button>
               <button data-act="delete" data-code="${c.code}" class="danger">Hapus</button>`
            : `<button data-act="activate" data-code="${c.code}">Aktifkan</button>
               <button data-act="print1" data-code="${c.code}">Cetak</button>
               <button data-act="delete" data-code="${c.code}" class="danger">Hapus</button>`;
        return `<tr>
          <td class="col-check"><input type="checkbox" class="rowcheck" data-code="${c.code}" ${checked} /></td>
          <td>${pill}</td>
          <td class="code-cell">${c.code}</td>
          <td class="label-cell">${c.label ? escapeHtml(c.label) : "—"}</td>
          <td class="link-cell">${linkCell}</td>
          <td>${c.scanCount || 0}</td>
          <td class="muted">${fmtDate(c.createdAt)}</td>
          <td class="col-actions"><div class="row-actions">${actions}</div></td>
        </tr>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  // ---------- Search / filter ----------
  let searchTimer;
  $("searchInput").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshTable, 250);
  });
  $("statusFilter").addEventListener("change", refreshTable);

  // ---------- Row selection ----------
  $("selectAll").addEventListener("change", (e) => {
    if (e.target.checked) state.codes.forEach((c) => state.selected.add(c.code));
    else state.selected.clear();
    renderTable();
  });

  $("tableBody").addEventListener("change", (e) => {
    if (e.target.classList.contains("rowcheck")) {
      const code = e.target.dataset.code;
      if (e.target.checked) state.selected.add(code);
      else state.selected.delete(code);
    }
  });

  // ---------- Row actions ----------
  $("tableBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const code = btn.dataset.code;
    const act = btn.dataset.act;

    if (act === "activate" || act === "edit") {
      openActivateModal(code);
    } else if (act === "deactivate") {
      if (!confirm(`Nonaktifkan kode ${code}? Link ulasan akan dilepas.`)) return;
      await api(`/api/codes/${code}/deactivate`, { method: "POST" });
      await refreshAll();
    } else if (act === "delete") {
      if (!confirm(`Hapus kode ${code} secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
      await api(`/api/codes/${code}`, { method: "DELETE" });
      await refreshAll();
    } else if (act === "print1") {
      window.open(`/print?ids=${encodeURIComponent(code)}`, "_blank");
    }
  });

  // ---------- Generate modal ----------
  const generateModal = $("generateModal");
  $("generateBtn").addEventListener("click", () => (generateModal.hidden = false));
  generateModal.addEventListener("click", (e) => {
    if (e.target === generateModal || e.target.dataset.close !== undefined) generateModal.hidden = true;
  });
  $("generateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const count = parseInt($("genCount").value, 10);
    const prefix = $("genPrefix").value.trim();
    const batchLabel = $("genLabel").value.trim();
    try {
      const result = await api("/api/codes/generate", {
        method: "POST",
        body: JSON.stringify({ count, prefix, batchLabel }),
      });
      generateModal.hidden = true;
      $("generateForm").reset();
      $("genCount").value = 100;
      await refreshAll();
      if (confirm(`${result.created.length} kode berhasil dibuat. Cetak sekarang?`)) {
        window.open(`/print?ids=${encodeURIComponent(result.created.join(","))}`, "_blank");
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // ---------- Activate modal ----------
  const activateModal = $("activateModal");
  let activatingCode = null;

  function openActivateModal(code) {
    activatingCode = code;
    $("activateCodeLabel").textContent = code;
    const existing = state.codes.find((c) => c.code === code);
    $("activateUrl").value = (existing && existing.targetUrl) || "";
    $("activateError").hidden = true;
    activateModal.hidden = false;
  }

  activateModal.addEventListener("click", (e) => {
    if (e.target === activateModal || e.target.dataset.close !== undefined) activateModal.hidden = true;
  });

  $("activateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("activateError").hidden = true;
    try {
      await api(`/api/codes/${activatingCode}/activate`, {
        method: "POST",
        body: JSON.stringify({ targetUrl: $("activateUrl").value.trim() }),
      });
      activateModal.hidden = true;
      await refreshAll();
    } catch (err) {
      $("activateError").textContent = err.message;
      $("activateError").hidden = false;
    }
  });

  // ---------- Bulk actions ----------
  $("printSelectedBtn").addEventListener("click", () => {
    if (!state.selected.size) return alert("Pilih minimal satu kode dulu.");
    window.open(`/print?ids=${encodeURIComponent([...state.selected].join(","))}`, "_blank");
  });
  $("printAllBtn").addEventListener("click", () => {
    window.open("/print", "_blank");
  });
  $("exportBtn").addEventListener("click", () => {
    window.location.href = "/api/codes/export.csv";
  });

  checkSession();
})();
