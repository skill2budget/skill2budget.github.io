/* SKILL2BUDGET — all logic runs in the browser, nothing is sent anywhere. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const nf = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfShort = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const lei = (n) => nf.format(n) + " lei";
  // For sentences: Romanian puts "de" before "lei" for whole numbers ≥ 20 whose last
  // two digits are 00 or 20–99 (20 de lei, 100 de lei, but 19 lei, 101 lei, 2,5 lei).
  const deLei = (n) => {
    const a = Math.abs(n);
    if (a === 1) return `${n < 0 ? "−" : ""}1 leu`;
    const r = a % 100;
    return Number.isInteger(a) && a >= 20 && (r === 0 || r >= 20) ? `${short(n)} de lei` : `${short(n)} lei`;
  };
  const short = (n) => nfShort.format(n);
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const round2 = (n) => Math.round(n * 100) / 100;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  // "DD.MM.YYYY" (from today()) -> "10 decembrie 2026"; falls back to today if missing or malformed.
  const longDate = (ddmmyyyy) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ddmmyyyy || "");
    const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date();
    return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  };

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- saved state (loaded first so every section can read it) ----------
  const calcDefaults = {
    skill: "design grafic",
    service: "afiș pentru balul liceului",
    hours: 2,
    price: 100,
    costs: [{ name: "print și materiale", amount: 15 }],
  };
  const calc = Object.assign({}, calcDefaults, store.get("s2b-calc", {}));
  if (!Array.isArray(calc.costs)) calc.costs = calcDefaults.costs.slice();

  const pp = Object.assign({ name: "", answers: ["", "", "", ""], done: [false, false, false, false], dates: ["", "", "", ""] }, store.get("s2b-passport", {}));
  if (!Array.isArray(pp.dates)) pp.dates = ["", "", "", ""];

  // ---------- nav ----------
  const navToggle = $(".nav-toggle");
  const nav = $("#nav");
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  $$("#nav a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); }));

  // ---------- no negative amounts ----------
  // min="0" only limits the spinner arrows; typed values like -50 still get through.
  // Runs in the capture phase so every other input handler already sees the fixed value.
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[type="number"]') && t.value !== "" && Number(t.value) < 0) t.value = "0";
  }, true);

  // ---------- print a single block ----------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-print]");
    if (!btn) return;
    const target = document.getElementById(btn.dataset.print);
    if (!target) return;
    target.classList.add("print-target");
    for (let el = target.parentElement; el; el = el.parentElement) {
      el.classList.add("print-path");
      if (el === document.body) break;
    }
    document.body.classList.add("printing");
    window.print();
  });
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
    $$(".print-target").forEach((el) => el.classList.remove("print-target"));
    $$(".print-path").forEach((el) => el.classList.remove("print-path"));
  });

  // =====================================================================
  // Exercițiul 1 — Skill Value Calculator (bonul de calcul)
  // =====================================================================
  const cSkill = $("#c-skill"), cService = $("#c-service"), cHours = $("#c-hours"), cPrice = $("#c-price");
  const costRows = $("#cost-rows");
  cSkill.value = calc.skill; cService.value = calc.service; cHours.value = calc.hours; cPrice.value = calc.price;
  $("#r-date").textContent = today();

  function renderCostRows() {
    costRows.innerHTML = "";
    calc.costs.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "cost-row";
      row.innerHTML =
        `<input type="text" class="hand-input" aria-label="Pe ce ai dat banii" placeholder="ex. materiale" value="${esc(c.name)}" data-i="${i}" data-k="name">` +
        `<input type="number" class="hand-input" aria-label="Cât a costat (lei)" min="0" step="0.5" value="${c.amount}" data-i="${i}" data-k="amount">` +
        `<button type="button" class="icon-btn" aria-label="Șterge costul" data-del="${i}">×</button>`;
      costRows.appendChild(row);
    });
  }
  costRows.addEventListener("input", (e) => {
    const t = e.target; const i = +t.dataset.i;
    if (!calc.costs[i]) return;
    calc.costs[i][t.dataset.k] = t.dataset.k === "amount" ? num(t.value) : t.value;
    recalc();
  });
  costRows.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    calc.costs.splice(+b.dataset.del, 1);
    renderCostRows(); recalc();
  });
  $("#add-cost").addEventListener("click", () => {
    calc.costs.push({ name: "", amount: 0 });
    renderCostRows(); recalc();
    const inputs = $$("input[type=text]", costRows); inputs[inputs.length - 1].focus();
  });
  [cSkill, cService, cHours, cPrice].forEach((el) => el.addEventListener("input", recalc));

  function calcResult() {
    const price = Math.max(0, num(cPrice.value));
    const hours = Math.max(0, num(cHours.value));
    const costs = calc.costs.reduce((s, c) => s + Math.max(0, num(c.amount)), 0);
    const profit = price - costs;
    return { price, hours, costs, profit, hourly: hours > 0 ? profit / hours : null, margin: price > 0 ? profit / price : null };
  }

  function recalc() {
    calc.skill = cSkill.value; calc.service = cService.value; calc.hours = num(cHours.value); calc.price = num(cPrice.value);
    store.set("s2b-calc", calc);
    const r = calcResult();

    $("#r-skill").textContent = calc.skill.trim() || "—";
    $("#r-service").textContent = calc.service.trim() || "serviciul tău";
    $("#r-income").textContent = nf.format(r.price);
    const lines = calc.costs.filter((c) => num(c.amount) > 0 || c.name.trim());
    $("#r-cost-lines").innerHTML = lines.length
      ? lines.map((c) => { const a = Math.max(0, num(c.amount)); return `<div class="r-line"><span>${esc(c.name.trim() || "cost")}</span><i></i><span>${a > 0 ? "−" : ""}${nf.format(a)}</span></div>`; }).join("")
      : `<div class="r-line"><span>fără costuri</span><i></i><span>0,00</span></div>`;
    $("#r-profit").textContent = lei(r.profit);
    $(".r-total").classList.toggle("loss", r.profit < 0);
    $("#r-hours").textContent = short(r.hours) + " h";
    $("#r-hourly").textContent = r.hourly === null ? "—" : lei(r.hourly);
    $("#r-margin").textContent = r.margin === null ? "—" : Math.round(r.margin * 100) + "%";

    const warn = $("#r-warn");
    if (r.profit < 0) { warn.textContent = `Costurile depășesc prețul: pierzi ${lei(-r.profit)}. Revizuiește prețul sau costurile.`; warn.hidden = false; }
    else if (r.hours === 0) { warn.textContent = "Scrie câte ore ți-a luat ca să afli cât valorează o oră."; warn.hidden = false; }
    else warn.hidden = true;

    $("#solve-1").innerHTML = `${short(r.price)} − ${short(r.costs)} = <strong>${short(round2(r.profit))} lei</strong>`;
    $("#solve-2").innerHTML = r.hourly === null
      ? "câte ore? fără ele nu știi cât valorează o oră"
      : `${short(round2(r.profit))} lei : ${short(r.hours)} ${r.hours === 1 ? "oră" : "ore"} = <span class="answer">${nf.format(r.hourly)} lei pe oră</span>`;

    renderPassportId();
  }

  // =====================================================================
  // Exercițiul 2 — First Income Planner (plicurile)
  // =====================================================================
  const CATS = [
    { id: "nevoi", name: "Nevoi", hint: "transport, mâncare, rechizite", share: 0.30,
      env: { body: "#E6E4D6", side: "#DCDAC9", flap: "#ECEADD", line: "#B9B8A6", shadow: "#1E211E", so: 0.13, text: "#1E211E", amt: "#3D6249" } },
    { id: "dorinte", name: "Dorințe", hint: "ieșiri, haine, jocuri", share: 0.20,
      env: { body: "#C9D6C8", side: "#BDCBBC", flap: "#D3DED2", line: "#9DB09E", shadow: "#1E211E", so: 0.13, text: "#1E211E", amt: "#2C4835" } },
    { id: "economii", name: "Economii", hint: "obiectivul + fondul de rezervă", share: 0.375,
      env: { body: "#3D6249", side: "#365A42", flap: "#456B51", line: "#2C4835", shadow: "#0F120F", so: 0.25, text: "#F4F4EE", amt: "#F4F4EE" } },
    { id: "dezvoltare", name: "Dezvoltare", hint: "un curs, un program, materiale", share: 0.125,
      env: { body: "#2E322E", side: "#282C28", flap: "#363B36", line: "#1E211E", shadow: "#000000", so: 0.3, text: "#F4F4EE", amt: "#C9D6C8" } },
  ];
  const catName = (id) => (CATS.find((c) => c.id === id) || { name: "Datorie" }).name;
  const tilt = [-3, 2, -2, 3];

  function envelopeSVG(e) {
    const flap = "M0.5 0.5 L66 58 Q75 66 84 58 L149.5 0.5 Z";
    return `<svg viewBox="0 0 150 100" aria-hidden="true">` +
      `<rect x="0.5" y="0.5" width="149" height="99" rx="1.2" fill="${e.body}" stroke="${e.line}" stroke-width="0.6"/>` +
      `<path d="M0.5 0.5 L75 52 L0.5 99.5 Z" fill="${e.side}"/><path d="M149.5 0.5 L75 52 L149.5 99.5 Z" fill="${e.side}"/>` +
      `<path d="M0.8 99.2 L75 44 L149.2 99.2 Z" fill="${e.body}" stroke="${e.line}" stroke-width="0.6" stroke-linejoin="round"/>` +
      `<path d="${flap}" fill="${e.shadow}" opacity="${e.so}" transform="translate(1.4 1.8)"/>` +
      `<path d="${flap}" fill="${e.flap}" stroke="${e.line}" stroke-width="0.6" stroke-linejoin="round"/></svg>`;
  }

  const pIncome = $("#p-income"), pSource = $("#p-source"), pGoal = $("#p-goal"), pGoalName = $("#p-goal-name");
  const allocEl = $("#alloc");

  const planDefaults = { income: 400, source: "serviciu de design, scenariu", goal: 250, goalName: "căști noi", alloc: { nevoi: 120, dorinte: 80, economii: 150, dezvoltare: 50 } };
  const plan = Object.assign({}, planDefaults, store.get("s2b-plan", {}));
  plan.alloc = Object.assign({}, planDefaults.alloc, plan.alloc);
  pIncome.value = plan.income; pSource.value = plan.source; pGoal.value = plan.goal; pGoalName.value = plan.goalName;

  let sim = store.get("s2b-sim", null); // { balances, history, done: [], startedWith }
  let openEvent = null;

  function savePlan() {
    plan.income = num(pIncome.value); plan.source = pSource.value; plan.goal = num(pGoal.value); plan.goalName = pGoalName.value;
    $$("input[data-cat]", allocEl).forEach((inp) => { plan.alloc[inp.dataset.cat] = num(inp.value); });
    store.set("s2b-plan", plan);
  }
  function autoSplit() {
    const income = num(pIncome.value);
    let used = 0;
    CATS.forEach((c, i) => {
      const v = i === CATS.length - 1 ? income - used : Math.round(income * c.share);
      plan.alloc[c.id] = Math.max(0, v); used += plan.alloc[c.id];
    });
  }

  function renderAlloc() {
    allocEl.innerHTML = CATS.map((c, i) =>
      `<div class="env-wrap">` +
        `<div class="env" id="env-${c.id}">${envelopeSVG(c.env)}` +
          `<span class="env-label" style="color:${c.env.text};transform:rotate(${tilt[i]}deg)">${c.name}</span>` +
          `<span class="env-amt" style="color:${c.env.amt}" data-amt="${c.id}"></span>` +
        `</div>` +
        `<label class="env-input">în plic <input type="number" class="hand-input" min="0" step="1" data-cat="${c.id}" aria-label="${c.name}, lei în plic" value="${plan.alloc[c.id] || 0}" ${sim ? "disabled" : ""}> lei</label>` +
        `<span class="env-hint">${c.hint}</span>` +
      `</div>`).join("");
    updateAllocStatus();
  }

  const allocSum = () => CATS.reduce((s, c) => s + num(plan.alloc[c.id]), 0);

  function updateAllocStatus() {
    const income = num(pIncome.value);
    $("#h-income").textContent = deLei(income);
    $("#h-them").textContent = income === 1 ? "el" : "ei";
    const st = $("#alloc-status");
    if (sim) {
      const parts = CATS.map((c) => short(num(sim.balances[c.id])));
      const total = CATS.reduce((s, c) => s + num(sim.balances[c.id]), 0);
      st.textContent = `acum în plicuri: ${parts.join(" + ")} = ${short(round2(total))} lei`;
      st.classList.remove("bad");
    } else {
      const diff = round2(income - allocSum());
      const parts = CATS.map((c) => short(num(plan.alloc[c.id])));
      let txt = `${parts.join(" + ")} = ${short(allocSum())} lei`;
      if (diff === 0) txt += " ✓";
      else if (diff > 0) txt += ` · mai ai ${deLei(diff)} fără plic`;
      else txt += ` · ai pus cu ${deLei(-diff)} mai mult decât ai`;
      st.textContent = txt;
      st.classList.toggle("bad", diff !== 0);
    }
    $("#p-start").disabled = !!sim || round2(income - allocSum()) !== 0 || income <= 0;
    pIncome.disabled = !!sim;
  }

  allocEl.addEventListener("input", () => { savePlan(); updateAllocStatus(); renderBalances(); });
  [pIncome, pSource, pGoal, pGoalName].forEach((el) => el.addEventListener("input", () => { savePlan(); updateAllocStatus(); renderBalances(); }));

  // ----- event cards -----
  const EVENTS = [
    {
      id: "tentatia", title: "Tentația", amt: "−84",
      card: "Ce îți doreai costa 120 de lei. Azi e redus cu 30%. Îl iei sau renunți?",
      text: "Produsul pe care îl vrei de mult costă 120 de lei. Azi e redus cu 30%: 84 de lei.",
      choices: [
        { label: "Îl iau din plicul Dorințe", run: () => pay(84, ["dorinte", "economii", "dezvoltare", "nevoi"]) },
        { label: "Îl iau din Economii", run: () => pay(84, ["economii", "dorinte", "dezvoltare", "nevoi"]) },
        { label: "Renunț: nu l-aș fi luat oricum la preț întreg", run: () => "Ai păstrat 84 de lei în plicuri." },
      ],
      lesson: "O reducere de 30% tot înseamnă să plătești 70% din preț. Banii cheltuiți aici nu mai ajung la obiectiv.",
    },
    {
      id: "neprevazut", title: "Neprevăzut", amt: "−100",
      card: "Ți s-a stricat încărcătorul și îți trebuie altul azi. Din ce plic plătești?",
      text: "Ți s-a stricat încărcătorul și ai nevoie de altul azi. Costă 100 de lei și trebuie plătit acum.",
      choices: [
        { label: "Din Economii (fondul de rezervă)", run: () => pay(100, ["economii", "dorinte", "dezvoltare", "nevoi"]) },
        { label: "Din Dorințe", run: () => pay(100, ["dorinte", "economii", "dezvoltare", "nevoi"]) },
        { label: "Din Dezvoltare", run: () => pay(100, ["dezvoltare", "dorinte", "economii", "nevoi"]) },
      ],
      lesson: "Un fond de rezervă te apără: cheltuiala neprevăzută nu mai strică tot planul.",
    },
    {
      id: "obiectiv", title: "Obiectivul tău", amt: "+50",
      card: "Muți bani din Dorințe în Economii ca să ajungi mai repede la obiectiv?",
      text: "Vrei să ajungi mai repede la obiectivul de economisire. Poți muta bani dintr-un alt plic.",
      choices: [
        { label: "Mut 50 de lei din Dorințe în Economii", run: () => move(50, "dorinte", "economii") },
        { label: "Mut 30 de lei din Dezvoltare în Economii", run: () => move(30, "dezvoltare", "economii") },
        { label: "Las plicurile cum sunt", run: () => "Plicurile au rămas neschimbate." },
      ],
      lesson: "Un obiectiv clar te ajută să alegi între o dorință de acum și ceva important mai târziu.",
    },
    {
      id: "reinvest", title: "Investește în tine", amt: "−60",
      card: "Un curs online pentru abilitatea ta. După el poți cere un preț mai bun.",
      text: "Un curs online care îți dezvoltă abilitatea costă 60 de lei. După el, ai putea cere un preț mai bun pe serviciul tău.",
      choices: [
        { label: "Plătesc din Dezvoltare", run: () => pay(60, ["dezvoltare", "dorinte", "economii", "nevoi"]) },
        { label: "Plătesc din Economii", run: () => pay(60, ["economii", "dezvoltare", "dorinte", "nevoi"]) },
        { label: "Îl amân", run: () => "Ai amânat cursul și ai păstrat 60 de lei." },
      ],
      lesson: "Când investești în ce știi să faci, munca ta poate valora mai mult data viitoare.",
    },
  ];

  function pay(amount, order) {
    let left = amount; const parts = [];
    for (const id of order) {
      if (left <= 0) break;
      const take = Math.min(left, Math.max(0, sim.balances[id]));
      if (take > 0) { sim.balances[id] = round2(sim.balances[id] - take); left = round2(left - take); parts.push(`${deLei(take)} din ${catName(id)}`); }
    }
    let msg = `Ai plătit ${deLei(amount)}: ${parts.join(" + ") || "—"}.`;
    if (left > 0) { sim.balances.datorie = round2((sim.balances.datorie || 0) + left); msg += ` N-ai avut destui bani: ${deLei(left)} ${left === 1 ? "a devenit" : "au devenit"} datorie.`; }
    return msg;
  }
  function move(amount, from, to) {
    const take = Math.min(amount, Math.max(0, sim.balances[from]));
    sim.balances[from] = round2(sim.balances[from] - take);
    sim.balances[to] = round2(sim.balances[to] + take);
    return take < amount ? `Ai putut muta doar ${deLei(take)} din ${catName(from)} în ${catName(to)}.` : `Ai mutat ${deLei(take)} din ${catName(from)} în ${catName(to)}.`;
  }

  function renderCards() {
    const box = $("#event-cards");
    box.innerHTML = "";
    EVENTS.forEach((ev) => {
      const done = sim && sim.done.includes(ev.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ev-card" + (done ? " done" : "") + (openEvent && openEvent.id === ev.id ? " active" : "") + (!sim ? " locked" : "");
      b.disabled = !sim || done;
      b.innerHTML = `<span class="ev-top"><strong>${ev.title}</strong><span class="ev-amt">${ev.amt}</span></span><span class="ev-text">${ev.card}</span>`;
      b.addEventListener("click", () => showEvent(ev));
      box.appendChild(b);
    });
  }

  function showEvent(ev) {
    openEvent = ev;
    renderCards();
    const panel = $("#event-panel");
    panel.hidden = false;
    panel.innerHTML =
      `<h4>${ev.title}</h4><p>${ev.text}</p>` +
      `<label>De ce alegi așa? (scrie pe scurt)<textarea rows="1" id="ev-why"></textarea></label>` +
      `<div class="choices">${ev.choices.map((c, i) => `<button type="button" class="btn btn-small btn-outline" data-choice="${i}">${c.label}</button>`).join("")}</div>`;
    $$("[data-choice]", panel).forEach((btn) => btn.addEventListener("click", () => decide(ev, ev.choices[+btn.dataset.choice])));
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("#ev-why").focus({ preventScroll: true });
  }

  function decide(ev, choice) {
    const before = Object.assign({}, sim.balances);
    const detail = choice.run();
    sim.done.push(ev.id);
    sim.history.push({ title: ev.title, choice: choice.label, detail, why: ($("#ev-why").value || "").trim() });
    store.set("s2b-sim", sim);
    const finished = sim.done.length === EVENTS.length;
    $("#event-panel").innerHTML = `<h4>${esc(choice.label)}</h4><p>${esc(detail)}</p><p class="lesson">${ev.lesson}</p>` +
      (finished ? `<p><strong>Ai tras toate cărțile.</strong> Salvează varianta și încearcă altă strategie pentru aceeași sumă.</p>` : "");
    openEvent = null;
    renderAll(before);
  }

  function renderBalances(before) {
    const bal = sim ? sim.balances : plan.alloc;
    CATS.forEach((c) => {
      const amt = $(`[data-amt="${c.id}"]`);
      if (amt) amt.textContent = `${short(num(bal[c.id]))} lei`;
      const env = $(`#env-${c.id}`);
      if (env && before && before[c.id] !== bal[c.id]) {
        env.classList.remove("changed"); void env.offsetWidth; env.classList.add("changed");
      }
    });
    const debt = $("#debt");
    if (sim && sim.balances.datorie > 0) { debt.hidden = false; debt.textContent = `datorie: −${short(sim.balances.datorie)} lei (n-ai avut destui bani în plicuri)`; }
    else debt.hidden = true;

    const goal = num(pGoal.value);
    const saved = num(bal.economii);
    $("#goal-label").textContent = `Obiectiv: ${pGoalName.value.trim() || "obiectivul tău"}`;
    if (goal > 0) {
      $("#goal-pct").textContent = `${short(saved)} / ${short(goal)} lei`;
      $("#goal-fill").style.width = Math.min(100, Math.round((saved / goal) * 100)) + "%";
      $("#goal-note").textContent = saved >= goal ? "ai strâns tot ce-ți trebuie ✓" : `mai ai ${deLei(round2(goal - saved))} până acolo`;
    } else {
      $("#goal-pct").textContent = `${short(saved)} lei`;
      $("#goal-fill").style.width = "0%";
      $("#goal-note").textContent = "scrie cât costă obiectivul ca să vezi cât mai ai";
    }

    $("#sim-state").textContent = !sim ? "" : sim.done.length === EVENTS.length ? "gata, ai tras toate cărțile" : `cartea ${sim.done.length} din ${EVENTS.length}`;
    updateAllocStatus();
  }

  function renderHistory() {
    const ol = $("#history");
    if (!sim || !sim.history.length) {
      ol.innerHTML = `<li class="muted">${sim ? "trage o carte ca să iei prima decizie" : "pornește simularea ca să începi"}</li>`;
      return;
    }
    ol.innerHTML = sim.history.map((h) =>
      `<li>${esc(h.title)}: ${esc(h.choice.toLowerCase())}${h.why ? `<em>„${esc(h.why)}”</em>` : ""}</li>`).join("");
  }

  function renderAll(before) {
    renderAlloc(); renderBalances(before); renderCards(); renderHistory();
  }

  function resetSim() {
    sim = null; openEvent = null; store.set("s2b-sim", null);
    const panel = $("#event-panel"); panel.hidden = true; panel.innerHTML = "";
    renderAll();
  }

  $("#p-start").addEventListener("click", () => {
    savePlan();
    sim = { balances: Object.assign({ datorie: 0 }, plan.alloc), history: [], done: [], startedWith: Object.assign({}, plan.alloc) };
    store.set("s2b-sim", sim);
    renderAll();
  });
  $("#p-reset").addEventListener("click", resetSim);

  $("#to-planner").addEventListener("click", () => {
    const r = calcResult();
    if (r.profit <= 0) { alert("Ai nevoie de o sumă pozitivă după costuri ca să o pui în plicuri."); return; }
    resetSim();
    pIncome.value = Math.round(r.profit);
    pSource.value = [calc.skill, calc.service].filter((s) => s.trim()).join(": ") || "serviciul tău";
    autoSplit();
    renderAlloc(); savePlan(); renderBalances();
    $("#planificator").scrollIntoView();
  });

  // ----- variants A / B -----
  const variants = store.get("s2b-variants", {});
  $$("[data-save]").forEach((btn) => btn.addEventListener("click", () => {
    if (!sim) { alert("Pornește simularea și ia câteva decizii înainte să salvezi o variantă."); return; }
    variants[btn.dataset.save] = {
      income: num(pIncome.value), goal: num(pGoal.value), goalName: pGoalName.value,
      plan: Object.assign({}, sim.startedWith), balances: Object.assign({}, sim.balances), history: sim.history.slice(), done: sim.done.length,
    };
    store.set("s2b-variants", variants);
    renderCompare();
    const label = btn.textContent;
    btn.textContent = `Varianta ${btn.dataset.save} salvată ✓`;
    setTimeout(() => { btn.textContent = label; }, 1600);
  }));

  function renderCompare() {
    const box = $("#compare");
    const cols = [["A", variants.A], ["B", variants.B]].filter(([, v]) => v);
    if (!cols.length) return;
    const pct = (v) => (v.goal > 0 ? Math.min(100, Math.round((num(v.balances.economii) / v.goal) * 100)) : 0);
    const best = (fn, higher = true) => {
      if (cols.length < 2) return null;
      const a = fn(cols[0][1]), b = fn(cols[1][1]);
      if (a === b) return null; return (higher ? a > b : a < b) ? "A" : "B";
    };
    const row = (label, fn, fmt, bestKey) =>
      `<tr><th>${label}</th>${cols.map(([k, v]) => `<td class="num${bestKey === k ? " better" : ""}">${fmt(fn(v))}</td>`).join("")}</tr>`;
    let html = `<div class="compare-wrap"><table><thead><tr><th></th>${cols.map(([k]) => `<th class="num">Varianta ${k}</th>`).join("")}</tr></thead><tbody>`;
    html += row("Suma inițială", (v) => v.income, (n) => short(n) + " lei");
    CATS.forEach((c) => {
      html += row(`${c.name}: plan → final`, (v) => [v.plan[c.id], v.balances[c.id]], ([p, f]) => `${short(num(p))} → ${short(num(f))}`);
    });
    html += row("Datorie", (v) => num(v.balances.datorie), (n) => short(n) + " lei", best((v) => num(v.balances.datorie), false));
    html += row("Obiectiv atins", pct, (p) => p + "%", best(pct));
    html += row("Cărți trase", (v) => v.done, (d) => `${d} / ${EVENTS.length}`);
    html += `</tbody></table></div>`;
    cols.forEach(([k, v]) => {
      if (!v.history.length) return;
      html += `<p class="sheet-title" style="margin-top:16px">Deciziile variantei ${k}</p><ol>` +
        v.history.map((h) => `<li>${esc(h.title)}: ${esc(h.choice.toLowerCase())}${h.why ? ` („${esc(h.why)}”)` : ""}</li>`).join("") + `</ol>`;
    });
    html += `<p class="note-hand">Nu câștigă cine cheltuiește cel mai puțin, ci cine își argumentează cel mai bine deciziile.</p>`;
    box.innerHTML = html;
  }

  // =====================================================================
  // Provocarea de 30 de zile — Skill2Budget Passport
  // =====================================================================
  const WEEKS = [
    {
      key: "Discover", title: "Descoperă o abilitate",
      tasks: ["Completează fișa My Skill Passport.", "Alege o abilitate și fă ceva concret: un afiș, o lecție explicată, o fotografie editată."],
      prompt: "Ce abilitate ai ales și ce ai făcut?",
    },
    {
      key: "Create", title: "Cere feedback și îmbunătățește",
      tasks: ["Cere părerea a trei oameni despre ce ai făcut.", "Pe baza răspunsurilor, îmbunătățește produsul sau serviciul."],
      prompt: "Ce ți-au spus și ce ai schimbat?",
    },
    {
      key: "Earn", title: "Calculează și pune un preț",
      tasks: ["Fă exercițiul 1: timp, resurse, costuri.", "Stabilește un preț corect și vezi ce rămâne după costuri."],
      prompt: "Prețul tău, costurile și ce rămâne:",
      fill: "calc",
    },
    {
      key: "Manage", title: "Împarte banii și testează planul",
      tasks: ["Fă exercițiul 2: împarte banii în plicuri.", "Trage cartea Neprevăzut și vezi dacă planul rezistă."],
      prompt: "Cum ai împărțit banii și ce ai făcut la cheltuiala neprevăzută?",
      fill: "plan",
    },
  ];

  const ppName = $("#pp-name");
  ppName.value = pp.name;
  ppName.addEventListener("input", () => { pp.name = ppName.value; savePP(); renderPassportId(); renderCert(); });
  function savePP() { store.set("s2b-passport", pp); }

  const mrzClean = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "<").replace(/^<|<$/g, "");
  const pad = (s, n) => (s + "<".repeat(n)).slice(0, n);

  function renderPassportId() {
    const nameEl = $("#pp-show-name"), skillEl = $("#pp-show-skill");
    if (!nameEl) return;
    nameEl.textContent = pp.name.trim() || "[prenume nume]";
    skillEl.textContent = (calc.skill || "").trim() || "—";
    const nameParts = pp.name.trim().split(/\s+/).filter(Boolean);
    const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : (nameParts[0] || "NUME");
    const first = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "PRENUME";
    const count = pp.done.filter(Boolean).length;
    $("#mrz").textContent = pad(`P<ROU<${mrzClean(last)}<<${mrzClean(first)}`, 34) + "\n" + pad(`S2B2026<BANOMETRU<${count}`, 34);
  }

  let justStamped = -1;
  const weeksEl = $("#weeks");

  function renderWeeks() {
    weeksEl.innerHTML = "";
    WEEKS.forEach((w, i) => {
      const unlocked = i === 0 || pp.done[i - 1];
      const complete = pp.done[i];
      const card = document.createElement("article");
      card.className = "week" + (unlocked ? "" : " locked") + (complete ? " complete" : "");
      card.innerHTML =
        `<div class="week-top"><span class="wk">săpt. ${i + 1} · ${w.key}</span><span class="week-status">${complete ? "ștampilat ✓" : unlocked ? "în lucru" : "blocat"}</span></div>` +
        `<h3>${w.title}</h3><ul>${w.tasks.map((t) => `<li>${t}</li>`).join("")}</ul>` +
        `<label class="answer">${w.prompt}<textarea rows="2" data-w="${i}" ${unlocked && !complete ? "" : "disabled"}>${esc(pp.answers[i] || "")}</textarea></label>` +
        (w.fill && unlocked && !complete ? `<button type="button" class="link-btn" data-fill="${i}">preia din ${w.fill === "calc" ? "exercițiul 1" : "exercițiul 2"}</button>` : "") +
        `<label class="check"><input type="checkbox" data-done="${i}" ${complete ? "checked" : ""} ${unlocked ? "" : "disabled"}> Am terminat săptămâna ${i + 1}</label>`;
      weeksEl.appendChild(card);
    });

    $("#stamps").innerHTML = WEEKS.map((w, i) => pp.done[i]
      ? `<div class="stamp on${i === justStamped ? " just" : ""}">SĂPT. ${i + 1}<br>${w.key.toUpperCase()}<br>${esc((pp.dates[i] || "").slice(0, 5))}</div>`
      : `<div class="stamp">săpt. ${i + 1}</div>`).join("");
    justStamped = -1;

    $$("#todo li").forEach((li) => li.classList.toggle("done", !!pp.done[+li.dataset.week]));
    renderPassportId();
    renderCert();
  }

  weeksEl.addEventListener("input", (e) => {
    const t = e.target.closest("textarea[data-w]");
    if (!t) return;
    pp.answers[+t.dataset.w] = t.value; savePP();
  });
  weeksEl.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-done]");
    if (!cb) return;
    const i = +cb.dataset.done;
    if (cb.checked && (pp.answers[i] || "").trim().length < 10) {
      cb.checked = false;
      alert("Scrie pe scurt ce ai făcut (măcar câteva cuvinte) înainte să bifezi săptămâna.");
      weeksEl.querySelector(`textarea[data-w="${i}"]`).focus();
      return;
    }
    pp.done[i] = cb.checked;
    if (cb.checked) { pp.dates[i] = today(); justStamped = i; }
    else for (let j = i; j < pp.done.length; j++) { if (j > i) pp.done[j] = false; pp.dates[j] = pp.done[j] ? pp.dates[j] : ""; }
    savePP(); renderWeeks();
  });
  weeksEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fill]");
    if (!b) return;
    const i = +b.dataset.fill;
    let text = "";
    if (WEEKS[i].fill === "calc") {
      const r = calcResult();
      text = `${calc.skill} – ${calc.service}. Preț: ${short(r.price)} lei, costuri: ${short(r.costs)} lei, timp: ${short(r.hours)} ${r.hours === 1 ? "oră" : "ore"}. Rămân ${deLei(round2(r.profit))}` + (r.hourly !== null ? ` (${nf.format(r.hourly)} lei pe oră).` : ".");
    } else {
      const a = sim ? sim.startedWith : plan.alloc;
      text = `Din ${deLei(num(pIncome.value))}: ` + CATS.map((c) => `${c.name} ${short(num(a[c.id]))}`).join(", ") + " lei.";
      const unexp = sim && sim.history.find((h) => h.title === "Neprevăzut");
      if (unexp) text += ` La cheltuiala neprevăzută: ${unexp.choice.toLowerCase()}.`;
    }
    pp.answers[i] = text; savePP(); renderWeeks();
  });

  function renderCert() {
    const all = pp.done.every(Boolean);
    $("#cert-wrap").hidden = !all;
    if (!all) return;
    $("#cert-name").textContent = pp.name.trim() || "Numele tău";
    $("#cert-skill").textContent = calc.skill ? `Abilitatea valorificată: ${calc.skill}` : "";
    $("#cert-date").textContent = longDate(pp.dates[WEEKS.length - 1]);
  }

  // =====================================================================
  // Fișe de lucru — save what students type, field by field, per sheet
  // =====================================================================
  const sheetData = store.get("s2b-sheets", {});
  const sheetFields = (ws) => $$("input, textarea", ws);
  $$(".worksheet").forEach((ws) => {
    const saved = Array.isArray(sheetData[ws.id]) ? sheetData[ws.id] : [];
    sheetFields(ws).forEach((f, i) => { if (typeof saved[i] === "string") f.value = saved[i]; });
    ws.addEventListener("input", () => {
      sheetData[ws.id] = sheetFields(ws).map((f) => f.value);
      store.set("s2b-sheets", sheetData);
    });
  });

  // =====================================================================
  // Cod QR
  // =====================================================================
  const qrUrl = $("#qr-url"), qrBox = $("#qr-code"), qrCap = $("#qr-caption");
  const here = location.protocol.startsWith("http") ? location.origin + location.pathname : "";
  qrUrl.value = store.get("s2b-qr", "") || here;

  // Accepts "site.ro/x" as well as "https://site.ro/x"; returns null for anything
  // that isn't a web link (spaces, no domain, other protocols).
  function webLink(raw) {
    let s = raw.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
    try {
      const u = new URL(s);
      if (!/^https?:$/.test(u.protocol)) return null;
      if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
      return u.href;
    } catch (e) { return null; }
  }

  function makeQR() {
    const raw = qrUrl.value.trim();
    qrBox.innerHTML = "";
    if (!raw) { qrCap.textContent = "scrie linkul site-ului publicat ca să generezi codul"; return; }
    const text = webLink(raw);
    if (!text) { qrCap.textContent = "asta nu pare un link; scrie adresa site-ului, de ex. https://site.ro"; return; }
    qrUrl.value = text;
    if (typeof QRCode === "undefined") { qrCap.textContent = "generatorul QR nu s-a putut încărca; verifică internetul"; return; }
    store.set("s2b-qr", text === here ? "" : text);
    new QRCode(qrBox, { text, width: 200, height: 200, colorDark: "#1E211E", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M });
    qrCap.textContent = text;
  }
  $("#qr-make").addEventListener("click", makeQR);
  $("#qr-download").addEventListener("click", () => {
    const canvas = qrBox.querySelector("canvas");
    if (!canvas) { makeQR(); return; }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "skill2budget-qr.png";
    a.click();
  });

  // ---------- first render ----------
  renderCostRows();
  recalc();
  renderAll();
  renderCompare();
  renderWeeks();
  makeQR();
})();
