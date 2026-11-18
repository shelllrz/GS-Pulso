(function () {
  "use strict";

  const PROFILE_KEY = "pulso-profile-v2";
  const REPORTS_KEY = "pulso-reports-v2";
  const PREFERENCE_KEY = "pulso-alert-preference-v2";
  const $ = (id) => document.getElementById(id);
  const read = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value === null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const profile = () => read(PROFILE_KEY, null);
  const currentLocation = () => {
    const p = profile();
    return p ? { neighborhood: p.neighborhood, city: p.city, state: p.state } : null;
  };
  const locationLabel = (p = currentLocation()) => p ? `${p.neighborhood} · ${p.city}/${p.state}` : "Cadastre seu bairro";
  const updateSharedLabels = () => {
    const p = profile();
    document.querySelectorAll("[data-current-location]").forEach((el) => { el.textContent = locationLabel(); });
    document.querySelectorAll("[data-current-name]").forEach((el) => { el.textContent = p ? p.name : "Seu perfil"; });
  };
  const setStatus = (id, message, kind = "") => {
    const node = $(id); if (!node) return;
    node.textContent = message;
    node.className = `inline-status${kind ? ` inline-status--${kind}` : ""}`;
  };
  const escapeAttr = escapeHTML;
  const selectedNotice = (p) => {
    if (!p) return null;
    return pulsoData.officialUpdates.find((item) => normalize(item.city) === normalize(p.city) && item.state === p.state) || null;
  };
  const date = (value) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  const dateRange = (item) => {
    const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
    const start = formatter.format(new Date(item.eventStartsAt));
    const end = formatter.format(new Date(item.eventEndsAt));
    return start === end ? start : `${start} a ${end}`;
  };

  function renderProfile() {
    const form = $("profile-form");
    if (!form) { updateSharedLabels(); return; }
    const p = profile();
    const summary = $("profile-summary");
    const formSection = $("profile-form-section");
    if (p) {
      const fields = { name: "name", neighborhood: "neighborhood", city: "city", state: "state", cep: "cep", "residence-type": "residenceType", "residence-number": "residenceNumber" };
      Object.entries(fields).forEach(([id, key]) => { const field = $(id); if (field) field.value = p[key] || ""; });
      const consent = $("profile-local-consent"); if (consent) consent.checked = true;
      const summaryText = $("profile-summary-text");
      if (summaryText) summaryText.innerHTML = `<strong>${escapeHTML(p.name)}</strong><span>${escapeHTML(locationLabel(p))} · CEP ${escapeHTML(p.cep)}</span><small>Perfil salvo apenas neste navegador.</small>`;
      if (summary) summary.hidden = false;
      if (formSection) formSection.hidden = true;
    } else {
      if (summary) summary.hidden = true;
      if (formSection) formSection.hidden = false;
      const consent = $("profile-local-consent"); if (consent) consent.checked = false;
    }
    updateSharedLabels();
  }

  function renderOfficialStatus() {
    const host = $("official-status");
    if (!host) return;
    const p = profile();
    if (!p) {
      host.innerHTML = $("profile-form")
        ? `<article class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">⌖</span><div><span class="eyebrow">CONSULTA POR REGIÃO</span><h3>Salve seu perfil acima para ver a informação do seu bairro.</h3><p>A ausência de um comunicado não confirma que o abastecimento esteja normal.</p></div></article>`
        : `<div class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">⌖</span><div><span class="eyebrow">SEU BAIRRO</span><h3>Comece criando seu perfil.</h3><p>Seu perfil identifica a região usada para filtrar os avisos e relatos.</p><a class="button button--blue" href="index.html#perfil">Criar meu perfil</a></div></div>`;
      return;
    }
    const cityNotice = selectedNotice(p);
    if (!cityNotice) {
      host.innerHTML = `<article class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">i</span><div><span class="eyebrow">${escapeHTML(locationLabel(p))}</span><h3>Ainda não há comunicado oficial cadastrado para esta localidade.</h3><p>As informações disponíveis variam conforme os canais oficiais de cada município. A ausência de um comunicado no Pulso não confirma que o abastecimento esteja normal.</p><a class="text-link" href="sobre.html#fontes">Entenda a cobertura atual <span aria-hidden="true">↗</span></a></div></article>`;
      return;
    }
    const area = cityNotice.affectedAreas.find((item) => normalize(item.name) === normalize(p.neighborhood));
    if (!area) {
      host.innerHTML = `<article class="state-card state-card--info"><span class="state-card__mark" aria-hidden="true">i</span><div><div class="status-meta"><span class="status-chip">AVISO PUBLICADO PARA ${escapeHTML(cityNotice.city.toUpperCase())}</span><span class="source-code">${escapeHTML(cityNotice.provider)}</span></div><h3>O comunicado não cita ${escapeHTML(p.neighborhood)}.</h3><p>Para não atribuir um impacto sem confirmação, o Pulso não aplica este aviso ao seu bairro. A publicação lista: ${cityNotice.affectedAreas.map((item) => escapeHTML(item.name)).join(", ")}.</p><div class="state-card__meta"><span>Publicado ${escapeHTML(date(cityNotice.publishedAt))} · conferido manualmente ${escapeHTML(date(cityNotice.checkedAt))}</span><a class="button button--outline" href="${escapeAttr(cityNotice.sourceUrl)}" target="_blank" rel="noopener noreferrer">Saiba mais na fonte original ↗</a></div></div></article>`;
      return;
    }
    const expired = Date.now() > new Date(cityNotice.eventEndsAt).getTime();
    host.innerHTML = `<article class="state-card state-card--official"><span class="state-card__mark" aria-hidden="true">${expired ? "!" : "●"}</span><div><div class="status-meta"><span class="status-chip ${expired ? "status-chip--ended" : "status-chip--official"}">${expired ? "PERÍODO PUBLICADO ENCERRADO · SITUAÇÃO ATUAL NÃO CONFIRMADA" : "AVISO OFICIAL PARA SEU BAIRRO"}</span><span class="source-code">${escapeHTML(cityNotice.provider)}</span></div><h3>${escapeHTML(cityNotice.title)}</h3><p>${escapeHTML(cityNotice.impact)}</p><div class="status-details"><div><span>PERÍODO INFORMADO</span><strong>${escapeHTML(dateRange(cityNotice))}</strong></div><div><span>RETORNO</span><strong>${escapeHTML(cityNotice.return)}</strong></div><div><span>ÁREA</span><strong>${escapeHTML(area.name)}</strong></div></div><details class="status-areas"><summary>Todos os bairros citados neste comunicado (${cityNotice.affectedAreas.length})</summary><ul>${cityNotice.affectedAreas.map((item) => `<li>${escapeHTML(item.name)}</li>`).join("")}</ul></details><div class="state-card__meta"><span>Publicado ${escapeHTML(date(cityNotice.publishedAt))} · conferido manualmente ${escapeHTML(date(cityNotice.checkedAt))}</span><a class="button button--outline" href="${escapeAttr(cityNotice.sourceUrl)}" target="_blank" rel="noopener noreferrer">Saiba mais na fonte original ↗</a></div><small class="source-note">Este comunicado foi conferido manualmente na fonte oficial. Novas publicações podem ainda não estar refletidas aqui.</small></div></article>`;
  }

  function reportMatches(report, p) {
    return normalize(report.neighborhood) === normalize(p.neighborhood)
      && normalize(report.city) === normalize(p.city)
      && String(report.state).toUpperCase() === String(p.state).toUpperCase();
  }
  function renderReports() {
    document.querySelectorAll("[data-report-feed]").forEach((host) => {
      const p = profile();
      const countNode = $("report-count");
      if (!p) {
        host.innerHTML = `<div class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">⌖</span><div><h3>Crie seu perfil para ver os relatos do seu bairro.</h3><p>O filtro considera bairro, cidade e UF.</p><a class="text-link" href="index.html#perfil">Criar meu perfil <span aria-hidden="true">↗</span></a></div></div>`;
        if (countNode) countNode.textContent = "00";
        return;
      }
      const reports = read(REPORTS_KEY, []).filter((report) => reportMatches(report, p)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (countNode) countNode.textContent = String(reports.length).padStart(2, "0");
      host.innerHTML = reports.length ? reports.map((r) => `<article class="report-card"><div class="report-card__top"><span class="status-chip status-chip--report">RELATO DE MORADOR · NÃO VERIFICADO</span><time datetime="${escapeAttr(r.createdAt)}">${escapeHTML(date(r.createdAt))}</time></div><h3>${escapeHTML(r.typeLabel)}</h3><p>${escapeHTML(r.description || "Sem detalhes adicionais.")}</p><div class="report-card__bottom"><span>${escapeHTML(r.neighborhood)} · ${escapeHTML(r.city)}/${escapeHTML(r.state)}</span></div></article>`).join("") : `<div class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">♡</span><div><h3>Ainda não há relatos registrados neste dispositivo para ${escapeHTML(p.neighborhood)}.</h3><p>Quando houver uma observação, ela ficará separada dos comunicados oficiais.</p></div></div>`;
    });
  }
  function renderSupport() {
    const host = $("support-results");
    if (!host) return;
    const p = profile();
    if (!p) {
      host.innerHTML = `<div class="state-card state-card--empty"><span class="state-card__mark" aria-hidden="true">⌖</span><div><h3>Crie seu perfil para consultar apoio no seu bairro.</h3><a class="button button--blue" href="index.html#perfil">Criar meu perfil</a></div></div>`;
      return;
    }
    const points = (pulsoData.confirmedSupportPoints || []).filter((point) => normalize(point.city) === normalize(p.city) && point.state === p.state && (point.neighborhoods || [point.neighborhood]).some((n) => normalize(n) === normalize(p.neighborhood)));
    if (!points.length) {
      host.innerHTML = `<article class="support-empty"><span class="support-empty__icon" aria-hidden="true">⌖</span><div><span class="eyebrow">${escapeHTML(locationLabel(p))}</span><h3>Ainda não há ponto de água confirmado na base do Pulso para este bairro.</h3><p>Só exibimos locais com endereço, horário e funcionamento confirmados. A ausência de ponto listado não significa que não exista apoio na região.</p><a class="text-link" href="sobre.html#fontes">Como as fontes são identificadas <span aria-hidden="true">↗</span></a></div></article>`;
      return;
    }
    host.innerHTML = `<div class="support-list">${points.map((pt) => `<article class="support-point"><span class="status-chip status-chip--official">CONFIRMADO PELA FONTE</span><h3>${escapeHTML(pt.name)}</h3><p>${escapeHTML(pt.address)} · ${escapeHTML(pt.hours)}</p><p>Acessibilidade: ${escapeHTML(pt.accessibility || "não informada")} · Disponibilidade: ${escapeHTML(pt.availability || "não informada")}</p><a class="text-link" href="${escapeAttr(pt.sourceUrl)}" target="_blank" rel="noopener noreferrer">Saiba mais na fonte original ↗</a></article>`).join("")}</div>`;
  }

  function bindDemoAlert() {
    const dialog = $("demo-alert-dialog");
    const dismiss = $("demo-alert-dismiss");
    if (!dialog || !dismiss) return;
    const closeDialog = (showResults = false) => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      if (showResults) {
        const results = $("official-status");
        if (results) {
          const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          results.focus({ preventScroll: true });
          results.scrollIntoView({ behavior, block: "center" });
        }
      }
    };
    dismiss.addEventListener("click", () => closeDialog(true));
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  }

  function showDemoAlert(p) {
    const dialog = $("demo-alert-dialog");
    const updates = (pulsoData.officialUpdates || []).filter((item) => Array.isArray(item.affectedAreas) && item.affectedAreas.some((area) => area.listedBySource !== false));
    if (!dialog || !p || !updates.length) return;
    const cityMatches = (item) => normalize(p.city) === normalize(item.city)
      && String(p.state).toUpperCase() === String(item.state).toUpperCase();
    const areaMatches = (item) => item.affectedAreas.some((area) => area.listedBySource !== false && normalize(area.name) === normalize(p.neighborhood));
    const cityNotice = updates.find(cityMatches);
    const noticeForProfile = updates.find((item) => cityMatches(item) && areaMatches(item));
    const latestNotice = updates.slice().sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];
    const notice = noticeForProfile || cityNotice || latestNotice;
    const listedAreas = notice.affectedAreas.filter((item) => item.listedBySource !== false);
    const area = listedAreas.find((item) => normalize(item.name) === normalize(p.neighborhood));
    const profileMatchesNotice = Boolean(noticeForProfile);
    const profileCityMatches = cityMatches(notice);
    const shownKey = `pulso-demo-alert:${notice.id}:${normalize(p.neighborhood)}:${normalize(p.city)}:${String(p.state).toUpperCase()}`;
    try { if (sessionStorage.getItem(shownKey) === "1") return; } catch (_) {}

    const ended = Date.now() > new Date(notice.eventEndsAt).getTime();
    const badge = $("demo-alert-badge");
    if (badge) {
      badge.classList.toggle("status-chip--demo", !profileMatchesNotice || ended);
      badge.classList.toggle("status-chip--official", profileMatchesNotice && !ended);
      badge.textContent = profileMatchesNotice
        ? (ended ? "AVISO OFICIAL · PERÍODO ENCERRADO" : "AVISO OFICIAL · ÁREA CITADA")
        : (profileCityMatches ? "EXEMPLO · BAIRRO NÃO CITADO" : "EXEMPLO · OUTRA LOCALIDADE");
    }
    $("demo-alert-provider").textContent = `${notice.provider} · publicado ${date(notice.publishedAt)}${notice.checkedAt ? ` · conferido ${date(notice.checkedAt)}` : ""}`;
    $("demo-alert-title").textContent = profileMatchesNotice ? "Comunicado oficial para a área citada" : "Exemplo de mensagem de alerta";
    $("demo-alert-location").textContent = `Perfil consultado: ${locationLabel(p)}`;
    $("demo-alert-message").textContent = `${notice.title}. ${notice.impact} ${notice.return}`;
    $("demo-alert-period").textContent = `${dateRange(notice)}${ended ? " · período encerrado" : ""}`;
    $("demo-alert-area").textContent = `${notice.city}/${notice.state} · ${listedAreas.length} áreas citadas na fonte`;
    const areasSummary = $("demo-alert-areas-summary");
    if (areasSummary) areasSummary.textContent = `Ver as ${listedAreas.length} áreas citadas na publicação original`;
    const areasList = $("demo-alert-areas-list");
    if (areasList) {
      areasList.replaceChildren(...listedAreas.map((item) => {
        const li = document.createElement("li");
        li.textContent = item.name;
        return li;
      }));
    }
    const areasDisclosure = $("demo-alert-areas");
    if (areasDisclosure) areasDisclosure.open = !profileMatchesNotice;
    const profileNote = profileMatchesNotice
      ? `O bairro ${area.name} está citado na publicação oficial. ${ended ? "O período informado já terminou; isto não confirma uma ocorrência atual." : "Consulte a fonte original para acompanhar os detalhes."}`
      : profileCityMatches
        ? `Não há comunicado cadastrado para ${locationLabel(p)}. Este exemplo do SAAE ${notice.city} abrange somente as áreas listadas e não descreve a situação do seu bairro.`
        : `Não há comunicado cadastrado para ${locationLabel(p)}. Este exemplo do SAAE ${notice.city} abrange somente as áreas listadas e não representa sua localidade.`;
    $("demo-alert-disclosure").textContent = `${profileNote} A informação foi conferida e cadastrada manualmente a partir do canal oficial. O status realmente filtrado aparece após fechar; esta janela não envia Push Web.`;
    $("demo-alert-source").href = notice.sourceUrl;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      sessionStorage.setItem(shownKey, "1");
    } catch (_) {}
  }

  function bindProfileForm() {
    const form = $("profile-form");
    if (!form) return;
    const saved = profile();
    if (saved) {
      const fields = { name: "name", neighborhood: "neighborhood", city: "city", state: "state", cep: "cep", "residence-type": "residenceType", "residence-number": "residenceNumber" };
      Object.entries(fields).forEach(([id, key]) => { const field = $(id); if (field) field.value = saved[key] || ""; });
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("name").value.trim();
      const neighborhood = $("neighborhood").value.trim();
      const city = $("city").value.trim();
      const state = $("state").value.trim().toUpperCase();
      const cep = $("cep").value.replace(/\D/g, "");
      const localConsent = $("profile-local-consent").checked;
      if (!name || !neighborhood || !city || !/^[A-Z]{2}$/.test(state) || !/^\d{8}$/.test(cep)) {
        setStatus("profile-status", "Preencha nome, bairro, cidade, UF e CEP válido para continuar.", "error"); return;
      }
      if (!localConsent) {
        setStatus("profile-status", "Confirme que compreendeu onde e como estes dados ficam armazenados.", "error"); $("profile-local-consent").focus(); return;
      }
      const p = { name, neighborhood, city, state, cep: `${cep.slice(0,5)}-${cep.slice(5)}`, residenceType: $("residence-type").value, residenceNumber: $("residence-number").value.trim(), savedAt: new Date().toISOString() };
      if (saved && (normalize(saved.neighborhood) !== normalize(p.neighborhood) || normalize(saved.city) !== normalize(p.city) || String(saved.state).toUpperCase() !== p.state)) localStorage.removeItem(PREFERENCE_KEY);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      renderProfile(); renderOfficialStatus(); renderSupport(); renderReports();
      setStatus("profile-status", "Perfil salvo neste navegador. As consultas desta sessão agora usam o bairro informado.", "success");
      showDemoAlert(p);
      if (location.hash === "#perfil") $("profile-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("edit-profile")?.addEventListener("click", () => {
      const section = $("profile-form-section"); if (section) section.hidden = false;
      $("profile-summary")?.setAttribute("hidden", "");
      $("name")?.focus();
    });
    $("delete-profile")?.addEventListener("click", () => {
      localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(REPORTS_KEY); localStorage.removeItem(PREFERENCE_KEY);
      form.reset(); renderProfile(); renderOfficialStatus(); renderSupport(); renderReports();
      setStatus("profile-status", "Perfil e relatos locais removidos deste navegador.", "success");
    });
  }
  function bindReportForm() {
    const form = $("report-form");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const p = profile();
      if (!p) { setStatus("report-status", "Crie seu perfil antes de registrar uma observação.", "error"); return; }
      const type = pulsoData.reportTypes.find((item) => item.id === $("report-type").value);
      const description = $("report-description").value.trim().slice(0, 240);
      if (!type) { setStatus("report-status", "Escolha a situação que observou.", "error"); $("report-type").focus(); return; }
      const reports = read(REPORTS_KEY, []);
      reports.push({ id: `R-${Date.now()}`, neighborhood: p.neighborhood, city: p.city, state: p.state, typeLabel: type.label, description, createdAt: new Date().toISOString(), verification: "não verificado" });
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(-50)));
      form.reset(); renderReports();
      setStatus("report-status", "Observação registrada neste dispositivo para seu bairro. Ela não foi enviada a outros moradores nem confirmada por uma fonte.", "success");
    });
  }
  function bindPreferenceForm() {
    const form = $("preference-form"); if (!form) return;
    let pref = read(PREFERENCE_KEY, null);
    const p = profile();
    if (pref && p && (normalize(pref.neighborhood) !== normalize(p.neighborhood) || normalize(pref.city) !== normalize(p.city) || String(pref.state).toUpperCase() !== p.state)) { localStorage.removeItem(PREFERENCE_KEY); pref = null; }
    if (pref && $("updates-opt-in")) $("updates-opt-in").checked = Boolean(pref.wantsUpdates);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!profile()) { setStatus("preference-status", "Crie seu perfil para registrar a preferência pelo seu bairro.", "error"); return; }
      const wantsUpdates = Boolean($("updates-opt-in")?.checked);
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ wantsUpdates, neighborhood: profile().neighborhood, city: profile().city, state: profile().state, savedAt: new Date().toISOString() }));
      setStatus("preference-status", wantsUpdates ? "Preferência salva neste dispositivo para o bairro do perfil. Ainda não envia push automático." : "Preferência desativada neste dispositivo.", "success");
    });
  }
  function bindNavigation() {
    const toggle = $("menu-toggle"); const nav = $("primary-navigation");
    if (!toggle || !nav) return;
    const close = () => { toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Abrir navegação"); nav.classList.remove("is-open"); };
    toggle.addEventListener("click", () => { const open = toggle.getAttribute("aria-expanded") === "true"; toggle.setAttribute("aria-expanded", String(!open)); toggle.setAttribute("aria-label", open ? "Abrir navegação" : "Fechar navegação"); nav.classList.toggle("is-open", !open); });
    nav.addEventListener("click", (event) => { if (event.target.closest("a")) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { close(); toggle.focus(); } });
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-active-nav]").forEach((link) => { if (link.dataset.activeNav === document.body.dataset.page) link.setAttribute("aria-current", "page"); });
    bindNavigation(); bindProfileForm(); bindReportForm(); bindPreferenceForm(); bindDemoAlert();
    renderProfile(); renderOfficialStatus(); renderSupport(); renderReports();
  });
})();
