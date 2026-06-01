const state = {
  role: "student",
  user: JSON.parse(localStorage.getItem("urbannestUser") || "null"),
  token: localStorage.getItem("urbannestToken"),
  data: { pgs: [], jobs: [], applications: [], notifications: [], stats: {} },
};

const fields = {
  student: ["Full Name:name", "Email:email", "Phone Number:phone", "Password:password", "College Name:college", "Current Location:location"],
  owner: ["Owner Name:name", "Email:email", "Phone Number:phone", "Password:password", "PG Name:pgName", "PG Address:address"],
  recruiter: ["Recruiter Name:name", "Company/Store Name:company", "Email:email", "Phone Number:phone", "Password:password", "Company Address:address"],
  admin: ["Admin Name:name", "Email:email", "Phone Number:phone", "Password:password"],
};

const demoEmails = {
  student: "student@urbannest.test",
  owner: "owner@urbannest.test",
  recruiter: "recruiter@urbannest.test",
  admin: "admin@urbannest.test",
};

const rolePages = {
  student: "/student.html",
  owner: "/owner.html",
  recruiter: "/recruiter.html",
  admin: "/admin.html",
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  redirectLegacyHashRoutes();
  document.documentElement.dataset.theme = localStorage.getItem("urbannestTheme") || "light";
  injectMobileNav();
  bindCommon();
  await refreshData();
  bindPage();
  renderPage();
  setInterval(async () => {
    await refreshData();
    renderLiveSections();
  }, 3500);
});

function redirectLegacyHashRoutes() {
  const legacyRoutes = {
    "#student-dashboard": "/student.html",
    "#owner-dashboard": "/owner.html",
    "#recruiter-dashboard": "/recruiter.html",
    "#admin-dashboard": "/admin.html",
  };
  if (legacyRoutes[location.hash]) {
    location.replace(legacyRoutes[location.hash]);
  }
}

function injectMobileNav() {
  if (document.querySelector(".mobile-nav")) return;
  const path = location.pathname;
  const links = [
    ["/", "Home"],
    ["/explore.html", "Explore"],
    ["/student.html", "Saved"],
    ["/resume.html", "Resume"],
    ["/auth.html", "Profile"],
  ];
  const nav = document.createElement("nav");
  nav.className = "mobile-nav";
  nav.innerHTML = links.map(([href, label]) => `<a class="${path === href ? "active" : ""}" href="${href}">${label}</a>`).join("");
  document.body.appendChild(nav);
}

function bindCommon() {
  const themeToggle = $("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("urbannestTheme", next);
    });
  }
  const logout = $("logoutBtn");
  if (logout) logout.addEventListener("click", logoutUser);
}

function bindPage() {
  if ($("roleTabs")) {
    const requestedRole = new URLSearchParams(location.search).get("role");
    if (requestedRole && fields[requestedRole]) state.role = requestedRole;
    $("roleTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-role]");
      if (!button) return;
      state.role = button.dataset.role;
      document.querySelectorAll("#roleTabs button").forEach((b) => b.classList.toggle("active", b === button));
      renderAuthFields();
    });
    renderAuthFields();
    document.querySelectorAll("#roleTabs button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
  }

  if ($("authForm")) $("authForm").addEventListener("submit", submitAuth);
  if ($("demoLogin")) $("demoLogin").addEventListener("click", demoLogin);
  if ($("searchInput")) $("searchInput").addEventListener("input", renderListings);
  if ($("cityFilter")) $("cityFilter").addEventListener("change", renderListings);
  if ($("typeFilter")) $("typeFilter").addEventListener("change", renderListings);
  if ($("nearMeBtn")) {
    $("nearMeBtn").addEventListener("click", () => {
      $("searchInput").value = state.user?.location || "Koramangala";
      toast("Using your saved location.");
      renderListings();
    });
  }
  if ($("pgForm")) $("pgForm").addEventListener("submit", createListing);
  if ($("jobForm")) $("jobForm").addEventListener("submit", createListing);
  if ($("resumeForm")) $("resumeForm").addEventListener("submit", updateResume);
  if ($("referralBtn")) $("referralBtn").addEventListener("click", referral);
}

async function refreshData() {
  const res = await fetch("/api/bootstrap");
  state.data = await res.json();
}

function renderPage() {
  renderUserBadge();
  renderStats();
  renderListings();
  renderActivity();
  renderStudentDashboard();
  renderOwnerDashboard();
  renderRecruiterDashboard();
  renderAdminDashboard();
  if ($("resumeForm")) updateResume(new Event("submit"));
}

function renderLiveSections() {
  renderStats();
  renderListings();
  renderActivity();
  renderStudentDashboard();
  renderOwnerDashboard();
  renderRecruiterDashboard();
  renderAdminDashboard();
}

function renderAuthFields() {
  $("authFields").innerHTML = fields[state.role].map((item) => {
    const [label, name] = item.split(":");
    const type = name === "password" ? "password" : name === "email" ? "email" : "text";
    return `<label><span class="pill">${label}</span><input name="${name}" type="${type}" required></label>`;
  }).join("");
}

async function submitAuth(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  payload.role = state.role;
  const registered = await api("/api/auth/register", payload);
  if (registered.error) {
    const loggedIn = await api("/api/auth/login", payload);
    if (loggedIn.error) return toast(loggedIn.error);
    saveSession(loggedIn);
    return;
  }
  saveSession(registered);
}

async function demoLogin() {
  const payload = { email: demoEmails[state.role], password: "demo123" };
  const result = await api("/api/auth/login", payload);
  if (result.error) return toast(result.error);
  saveSession(result);
}

function saveSession(result) {
  state.user = result.user;
  state.token = result.token;
  localStorage.setItem("urbannestUser", JSON.stringify(state.user));
  localStorage.setItem("urbannestToken", state.token);
  toast("Welcome to UrbanNest.");
  location.href = rolePages[state.user.role] || "/student.html";
}

function logoutUser() {
  localStorage.removeItem("urbannestUser");
  localStorage.removeItem("urbannestToken");
  location.href = "/auth.html";
}

function requireRole(role) {
  if (!state.user) {
    location.href = `/auth.html?role=${role}`;
    return false;
  }
  if (state.user.role !== role && state.user.role !== "admin") {
    location.href = `/auth.html?role=${role}`;
    return false;
  }
  return true;
}

function renderUserBadge() {
  const node = $("userBadge");
  if (!node) return;
  node.textContent = state.user ? `${state.user.name || state.user.email} - ${state.user.role}` : "Guest";
}

function renderStats() {
  const node = $("stats");
  if (!node) return;
  const stats = state.data.stats;
  node.innerHTML = [
    ["Total Users", stats.users],
    ["Verified PGs", stats.pgs],
    ["Active Jobs", stats.jobs],
    ["Applications", stats.applications],
  ].map(([label, value]) => `<div class="stat"><strong>${value || 0}</strong><span>${label}</span></div>`).join("");
}

function renderListings() {
  const node = $("listingGrid");
  if (!node) return;
  const term = ($("searchInput")?.value || "").toLowerCase();
  const city = $("cityFilter")?.value || "";
  const type = $("typeFilter")?.value || "";
  const pgCards = state.data.pgs.filter((pg) => matches(pg, term, city)).map(pgCard);
  const jobCards = state.data.jobs.filter((job) => matches(job, term, "")).map(jobCard);
  const cards = type === "pg" ? pgCards : type === "job" ? jobCards : [...pgCards, ...jobCards];
  node.innerHTML = cards.join("") || `<p class="muted">No listings found. Try another city or keyword.</p>`;
  bindApplyButtons();
}

function matches(item, term, city) {
  const haystack = Object.values(item).join(" ").toLowerCase();
  return (!term || haystack.includes(term)) && (!city || item.city === city);
}

function pgCard(pg) {
  return `<article class="card">
    <img src="${pg.image || defaultPgImage()}" alt="${escapeHtml(pg.name || "PG listing")}">
    <div class="card-body">
      <p class="eyebrow">PG - ${pg.status || "Pending Approval"}</p>
      <h3>${escapeHtml(pg.name || "New PG")}</h3>
      <p class="muted">${escapeHtml(pg.area || "Area")}, ${escapeHtml(pg.city || "City")} - Owner: ${escapeHtml(pg.owner || "Owner")}</p>
      <div class="meta">
        <span class="pill">Rs ${escapeHtml(pg.rent || "0")}/mo</span><span class="pill">${escapeHtml(pg.distance || "2.4 km")}</span><span class="pill">${escapeHtml(pg.gender || "Unisex")}</span><span class="pill">Star ${escapeHtml(pg.rating || "4.6")}</span>
      </div>
      <p class="muted">${escapeHtml(pg.amenities || "Wi-Fi, meals, security")}</p>
      <div class="hero-actions">
        <button class="primary" data-apply="pg" data-id="${pg.id}" data-title="${escapeHtml(pg.name || "PG")}">Apply PG</button>
        <a class="secondary" target="_blank" href="https://www.google.com/maps?q=${pg.lat || ""},${pg.lng || ""}">Map</a>
      </div>
    </div>
  </article>`;
}

function jobCard(job) {
  return `<article class="card">
    <img src="${job.logo || defaultJobImage()}" alt="${escapeHtml(job.company || "Company")}">
    <div class="card-body">
      <p class="eyebrow">Job - ${escapeHtml(job.type || "Part-Time")}</p>
      <h3>${escapeHtml(job.title || "Part-time role")}</h3>
      <p class="muted">${escapeHtml(job.company || "Company")} - ${escapeHtml(job.location || "Location")}</p>
      <div class="meta">
        <span class="pill">Rs ${escapeHtml(job.salary || "0")}/mo</span><span class="pill">${escapeHtml(job.distance || "2 km")}</span><span class="pill">${escapeHtml(job.category || "General")}</span><span class="pill">${escapeHtml(job.hours || "Flexible")}</span>
      </div>
      <p class="muted">Recommended for students based on location, hours, and skills.</p>
      <div class="hero-actions">
        <button class="primary" data-apply="job" data-id="${job.id}" data-title="${escapeHtml(job.title || "Job")}">Apply Job</button>
        <button class="secondary" type="button" onclick="toast('Recruiter contact unlocks after application.')">Contact</button>
      </div>
    </div>
  </article>`;
}

function renderStudentDashboard() {
  if (!$("studentDashboard")) return;
  if (!requireRole("student")) return;
  $("studentDashboard").innerHTML = [
    card("Recommended PGs", `<div class="cards">${state.data.pgs.map(pgCard).join("")}</div>`),
    card("Nearby Jobs", `<div class="cards">${state.data.jobs.map(jobCard).join("")}</div>`),
    card("Referral Rewards", `<div class="dash-stat"><div><strong>${state.user?.referralCode || "UN-DEMO"}</strong><br><span class="muted">Referral code</span></div><div><strong>${state.user?.points || "0"}</strong><br><span class="muted">Points</span></div></div><button class="secondary" id="referralBtn">Generate Referral Code</button>`),
  ].join("");
  bindApplyButtons();
  const referralBtn = $("referralBtn");
  if (referralBtn) referralBtn.addEventListener("click", referral);
}

function renderOwnerDashboard() {
  if (!$("ownerListings")) return;
  if (!requireRole("owner")) return;
  $("ownerListings").innerHTML = state.data.pgs.map(pgCard).join("");
  $("ownerStats").innerHTML = `<div class="dash-stat"><div><strong>${state.data.pgs.length}</strong><br><span class="muted">PGs</span></div><div><strong>${state.data.applications.length}</strong><br><span class="muted">Applications</span></div><div><strong>82%</strong><br><span class="muted">Occupancy</span></div><div><strong>Rs 2.4L</strong><br><span class="muted">Revenue est.</span></div></div>`;
  bindApplyButtons();
}

function renderRecruiterDashboard() {
  if (!$("recruiterListings")) return;
  if (!requireRole("recruiter")) return;
  $("recruiterListings").innerHTML = state.data.jobs.map(jobCard).join("");
  $("recruiterStats").innerHTML = `<div class="dash-stat"><div><strong>${state.data.jobs.length}</strong><br><span class="muted">Jobs</span></div><div><strong>${state.data.applications.length}</strong><br><span class="muted">Applicants</span></div><div><strong>${state.data.jobs.length}</strong><br><span class="muted">Active</span></div><div><strong>1</strong><br><span class="muted">Closed</span></div></div>`;
  bindApplyButtons();
}

function renderAdminDashboard() {
  if (!$("adminDashboard")) return;
  if (!requireRole("admin")) return;
  $("adminDashboard").innerHTML = [
    card("Platform Analytics", `<div class="dash-stat"><div><strong>${state.data.stats.users}</strong><br><span class="muted">Users</span></div><div><strong>${state.data.stats.pgs}</strong><br><span class="muted">PGs</span></div><div><strong>${state.data.stats.jobs}</strong><br><span class="muted">Jobs</span></div><div><strong>${state.data.stats.applications}</strong><br><span class="muted">Applications</span></div></div>`),
    card("Moderation", `<ul><li>Approve PG listings</li><li>Approve job listings</li><li>Block users</li><li>View reports</li></ul>`),
    card("Recent Activity", state.data.notifications.map((n) => `<p><strong>${escapeHtml(n.title)}</strong><br><span class="muted">${escapeHtml(n.message)}</span></p>`).join("")),
  ].join("");
}

async function createListing(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const endpoint = form.dataset.create === "jobs" ? "/api/jobs" : "/api/pgs";
  const payload = Object.fromEntries(new FormData(form));
  payload.owner = state.user?.name || "UrbanNest Partner";
  payload.image = payload.image || defaultPgImage();
  payload.logo = payload.logo || defaultJobImage();
  const item = await api(endpoint, payload);
  if (item.error) return toast(item.error);
  await refreshData();
  renderLiveSections();
  form.reset();
  toast("Saved live. Students will see it automatically.");
}

async function applyToListing(event) {
  const button = event.currentTarget;
  const result = await api("/api/applications", {
    email: state.user?.email || "guest@student.local",
    listingId: button.dataset.id,
    listingType: button.dataset.apply,
    title: button.dataset.title,
  });
  if (!result.error) {
    await refreshData();
    renderLiveSections();
    toast(`Application submitted for ${button.dataset.title}.`);
  }
}

function bindApplyButtons() {
  document.querySelectorAll("[data-apply]").forEach((btn) => {
    btn.removeEventListener("click", applyToListing);
    btn.addEventListener("click", applyToListing);
  });
}

async function updateResume(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData($("resumeForm")));
  const result = await api("/api/resume", payload);
  $("resumePreview").innerHTML = result.preview + `<button class="secondary" onclick="window.print()">Download PDF</button>`;
}

async function referral() {
  const result = await api("/api/referrals", { email: state.user?.email || "" });
  toast(`Referral code: ${result.code}. Earnings: Rs ${result.earnings}.`);
}

function renderActivity() {
  const node = $("activity");
  if (!node) return;
  node.innerHTML = state.data.notifications.slice(0, 6).map((n) =>
    `<article class="activity-item"><p class="eyebrow">${escapeHtml(n.time)}</p><h3>${escapeHtml(n.title)}</h3><p class="muted">${escapeHtml(n.message)}</p></article>`
  ).join("");
}

function card(title, body) {
  return `<article class="dash-card"><h3>${title}</h3>${body}</article>`;
}

function defaultPgImage() {
  return "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80";
}

function defaultJobImage() {
  return "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=500&q=80";
}

async function api(url, payload) {
  const options = payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {};
  const res = await fetch(url, options);
  return res.json();
}

function toast(message) {
  const node = $("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}
