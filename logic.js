import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://yvcudmwdtnzqxdqzzlla.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HbCoeh5zfpepIMQjScPgbg_EWHFnqBj";
const BUCKET_NAME = "news-images";
const PLACEHOLDER_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  page: document.body.dataset.page || "main",
  session: null,
  user: null,
  profile: null,
  articles: [],
  filteredArticles: [],
  selectedArticle: null,
  comments: [],
  search: "",
  activeCategory: "all",
  activeFeedTab: "foryou",
  adminComments: [],
  adminReports: [],
  userVotes: {},
  userReports: {},
  theme: "light"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const dom = {};

function truncateText(text, maxLength = 160) {
  if (!text) return "";
  const clean = text.replace(/<[^>]*>/g, ' ');
  return clean.length > maxLength ? clean.substring(0, maxLength) + "..." : clean;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHTML(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  initTheme();
  bindStaticEvents();
  bindMobileAuthEvents();
  bindCategoryFilters();
  bindFeedTabs();
  bindExploreNav();

  const { data } = await supabase.auth.getSession();
  setSession(data.session);

  await refreshCurrentUser();
  await loadArticles();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session);
    await refreshCurrentUser();
    await loadArticles();

    if (state.page === "main" && state.selectedArticle) {
      await loadComments(state.selectedArticle.id);
    }

    if (state.page === "admin") {
      await renderAdminArea();
    }
  });
}

/* ================= DOM CACHE ================= */
function cacheDom() {
  // Navigation
  dom.adminNavBtn = $("#adminNavBtn");
  dom.themeToggleBtn = $("#themeToggleBtn");
  dom.logoutBtn = $("#logoutBtn");
  dom.sessionLabel = $("#sessionLabel");
  dom.userHandle = $("#userHandle");
  dom.userAvatar = $("#userAvatar");

  // Auth Panel (right sidebar)
  dom.authPanel = $("#authPanel");
  dom.authMessage = $("#authMessage");
  dom.signinForm = $("#signinForm");
  dom.signupForm = $("#signupForm");
  dom.signinEmail = $("#signinEmail");
  dom.signinPassword = $("#signinPassword");
  dom.signupName = $("#signupName");
  dom.signupEmail = $("#signupEmail");
  dom.signupPassword = $("#signupPassword");
  dom.authTabs = $$(".tab-btn");

  // Mobile Auth
  dom.mobileAuthSection = $("#mobileAuthSection");
  dom.mobileAuthGuest = $("#mobileAuthGuest");
  dom.mobileAuthUser = $("#mobileAuthUser");
  dom.mobileSigninBtn = $("#mobileSigninBtn");
  dom.mobileSignupBtn = $("#mobileSignupBtn");
  dom.mobileLogoutBtn = $("#mobileLogoutBtn");
  dom.mobileAuthForms = $("#mobileAuthForms");
  dom.mobileAuthBack = $("#mobileAuthBack");
  dom.mobileAuthMessage = $("#mobileAuthMessage");
  dom.mobileSigninForm = $("#mobileSigninForm");
  dom.mobileSignupForm = $("#mobileSignupForm");
  dom.mobileSigninEmail = $("#mobileSigninEmail");
  dom.mobileSigninPassword = $("#mobileSigninPassword");
  dom.mobileSignupName = $("#mobileSignupName");
  dom.mobileSignupEmail = $("#mobileSignupEmail");
  dom.mobileSignupPassword = $("#mobileSignupPassword");
  dom.mobileUserName = $("#mobileUserName");
  dom.mobileUserHandle = $("#mobileUserHandle");
  dom.mobileUserAvatar = $("#mobileUserAvatar");
  dom.mobileAuthTabs = $$(".mobile-tab-btn");

  // Search & Feed
  dom.searchInput = $("#searchInput");
  dom.explorePanel = $("#explorePanel");
  dom.exploreResults = $("#exploreResults");
  dom.exploreNavBtn = $("#exploreNavBtn");
  dom.newsGrid = $("#newsGrid");
  dom.emptyState = $("#emptyState");
  dom.categoryFilterBar = $("#categoryFilterBar");
  dom.feedTabs = $$("[data-feed-tab]");

  // Article Modal
  dom.articleModal = $("#articleModal");
  dom.modalImage = $("#modalImage");
  dom.modalAuthor = $("#modalAuthor");
  dom.modalDate = $("#modalDate");
  dom.modalTitle = $("#modalTitle");
  dom.modalContent = $("#modalContent");
  dom.modalViewCount = $("#modalViewCount");
  dom.modalLikeCount = $("#modalLikeCount");
  dom.modalDislikeCount = $("#modalDislikeCount");
  dom.modalLikeBtn = $("#modalLikeBtn");
  dom.modalDislikeBtn = $("#modalDislikeBtn");
  dom.modalReportBtn = $("#modalReportBtn");

  // Report Modal
  dom.reportModal = $("#reportModal");
  dom.reportForm = $("#reportForm");
  dom.reportDetails = $("#reportDetails");
  dom.reportMessage = $("#reportMessage");

  // Comments
  dom.commentsList = $("#commentsList");
  dom.commentForm = $("#commentForm");
  dom.commentBody = $("#commentBody");
  dom.commentHint = $("#commentHint");
  dom.charCount = $("#charCount");

  // Admin
  dom.adminGate = $("#adminGate");
  dom.adminGateMessage = $("#adminGateMessage");
  dom.adminSignInForm = $("#adminSignInForm");
  dom.adminEmail = $("#adminEmail");
  dom.adminPassword = $("#adminPassword");
  dom.adminDashboard = $("#adminDashboard");
  dom.adminNameLabel = $("#adminNameLabel");
  dom.adminRoleLabel = $("#adminRoleLabel");
  dom.statArticles = $("#statArticles");
  dom.statComments = $("#statComments");
  dom.statReports = $("#statReports");
  dom.statTotalViews = $("#statTotalViews");
  dom.statTotalLikes = $("#statTotalLikes");
  dom.articleForm = $("#articleForm");
  dom.articleModeLabel = $("#articleModeLabel");
  dom.articleId = $("#articleId");
  dom.articleTitle = $("#articleTitle");
  dom.articleCategory = $("#articleCategory");
  dom.articleContent = $("#articleContent");
  dom.articleContentHtml = $("#articleContentHtml");
  dom.articleImage = $("#articleImage");
  dom.imagePreview = $("#imagePreview");
  dom.imageHelp = $("#imageHelp");
  dom.cancelEditBtn = $("#cancelEditBtn");
  dom.saveArticleBtn = $("#saveArticleBtn");
  dom.adminArticles = $("#adminArticles");
  dom.adminCommentsList = $("#adminComments");
  dom.adminReportsList = $("#adminReports");
}

/* ================= EVENT BINDINGS ================= */
function bindStaticEvents() {
  if (dom.themeToggleBtn) dom.themeToggleBtn.addEventListener("click", toggleTheme);
  if (dom.logoutBtn) dom.logoutBtn.addEventListener("click", signOut);

  dom.authTabs.forEach((btn) => {
    btn.addEventListener("click", () => setAuthTab(btn.dataset.authTab));
  });

  if (dom.signinForm) dom.signinForm.addEventListener("submit", handleSignIn);
  if (dom.signupForm) dom.signupForm.addEventListener("submit", handleSignUp);
  if (dom.searchInput) dom.searchInput.addEventListener("input", handleSearch);

  if (dom.articleModal) {
    dom.articleModal.addEventListener("click", (event) => {
      if (event.target.hasAttribute?.("data-close-modal")) {
        closeArticleModal();
      }
    });
  }

  if (dom.reportModal) {
    dom.reportModal.addEventListener("click", (event) => {
      if (event.target.hasAttribute?.("data-close-modal")) {
        closeReportModal();
      }
    });
  }

  if (dom.modalLikeBtn) dom.modalLikeBtn.addEventListener("click", () => handleVote('like'));
  if (dom.modalDislikeBtn) dom.modalDislikeBtn.addEventListener("click", () => handleVote('dislike'));
  if (dom.modalReportBtn) dom.modalReportBtn.addEventListener("click", openReportModal);

  if (dom.reportForm) dom.reportForm.addEventListener("submit", handleReport);

  if (dom.commentForm) dom.commentForm.addEventListener("submit", handleAddComment);
  if (dom.commentBody && dom.charCount) {
    dom.commentBody.addEventListener("input", () => {
      dom.charCount.textContent = `${dom.commentBody.value.length}/500`;
    });
  }

  if (dom.adminSignInForm) dom.adminSignInForm.addEventListener("submit", handleAdminSignIn);
  if (dom.articleForm) dom.articleForm.addEventListener("submit", handleSaveArticle);
  if (dom.cancelEditBtn) dom.cancelEditBtn.addEventListener("click", resetArticleForm);

  if (dom.articleImage) {
    dom.articleImage.addEventListener("change", () => {
      const file = dom.articleImage.files?.[0];
      if (!file) {
        dom.imagePreview?.classList.add("hidden");
        dom.imagePreview?.removeAttribute("src");
        return;
      }
      if (dom.imagePreview) {
        dom.imagePreview.src = URL.createObjectURL(file);
        dom.imagePreview.classList.remove("hidden");
      }
    });
  }

  $$("[data-format]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const format = btn.dataset.format;

      if (format.startsWith("formatBlock-")) {
        const tag = format.replace("formatBlock-", "");
        document.execCommand("formatBlock", false, tag);
      } else if (format === "createLink") {
        const url = prompt("Enter URL:");
        if (url) document.execCommand("createLink", false, url);
      } else if (format === "foreColor") {
        const color = prompt("Enter color:", "#000000");
        if (color) document.execCommand("foreColor", false, color);
      } else {
        document.execCommand(format, false, null);
      }

      if (dom.articleContentHtml && dom.articleContent) {
        dom.articleContentHtml.value = dom.articleContent.innerHTML;
      }
    });
  });

  if (dom.articleContent && dom.articleContentHtml) {
    dom.articleContent.addEventListener("input", () => {
      dom.articleContentHtml.value = dom.articleContent.innerHTML;
    });
  }
}

/* ================= MOBILE AUTH EVENTS ================= */
function bindMobileAuthEvents() {
  if (dom.mobileSigninBtn) {
    dom.mobileSigninBtn.addEventListener("click", () => showMobileAuthForm("signin"));
  }
  if (dom.mobileSignupBtn) {
    dom.mobileSignupBtn.addEventListener("click", () => showMobileAuthForm("signup"));
  }

  if (dom.mobileAuthBack) {
    dom.mobileAuthBack.addEventListener("click", () => {
      if (dom.mobileAuthForms) dom.mobileAuthForms.classList.add("hidden");
      if (dom.mobileAuthSection) dom.mobileAuthSection.classList.remove("hidden");
    });
  }

  dom.mobileAuthTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.mobileTab;
      dom.mobileAuthTabs.forEach(b => b.classList.toggle("active", b === btn));
      if (dom.mobileSigninForm) dom.mobileSigninForm.classList.toggle("hidden", tab !== "signin");
      if (dom.mobileSignupForm) dom.mobileSignupForm.classList.toggle("hidden", tab !== "signup");
    });
  });

  if (dom.mobileSigninForm) {
    dom.mobileSigninForm.addEventListener("submit", handleMobileSignIn);
  }
  if (dom.mobileSignupForm) {
    dom.mobileSignupForm.addEventListener("submit", handleMobileSignUp);
  }

  if (dom.mobileLogoutBtn) {
    dom.mobileLogoutBtn.addEventListener("click", signOut);
  }
}

function showMobileAuthForm(type) {
  if (dom.mobileAuthSection) dom.mobileAuthSection.classList.add("hidden");
  if (dom.mobileAuthForms) dom.mobileAuthForms.classList.remove("hidden");

  dom.mobileAuthTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mobileTab === type);
  });

  if (dom.mobileSigninForm) dom.mobileSigninForm.classList.toggle("hidden", type !== "signin");
  if (dom.mobileSignupForm) dom.mobileSignupForm.classList.toggle("hidden", type !== "signup");
}

async function handleMobileSignIn(event) {
  event.preventDefault();
  const email = dom.mobileSigninEmail?.value.trim();
  const password = dom.mobileSigninPassword?.value;

  if (!email || !password) return;
  setMobileAuthMessage("Signing in...");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setMobileAuthMessage(error.message);
    return;
  }

  setMobileAuthMessage("Signed in successfully.");
  if (dom.mobileSigninForm) dom.mobileSigninForm.reset();

  setTimeout(() => {
    if (dom.mobileAuthForms) dom.mobileAuthForms.classList.add("hidden");
    if (dom.mobileAuthSection) dom.mobileAuthSection.classList.remove("hidden");
  }, 800);
}

async function handleMobileSignUp(event) {
  event.preventDefault();
  const fullName = dom.mobileSignupName?.value.trim();
  const email = dom.mobileSignupEmail?.value.trim();
  const password = dom.mobileSignupPassword?.value;

  if (!fullName || !email || !password) return;
  setMobileAuthMessage("Creating account...");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) {
    setMobileAuthMessage(error.message);
    return;
  }

  if (dom.mobileSignupForm) dom.mobileSignupForm.reset();
  setMobileAuthMessage(data.session ? "Account created and signed in!" : "Check your email to confirm, then sign in.");
}

function setMobileAuthMessage(msg) {
  if (dom.mobileAuthMessage) dom.mobileAuthMessage.textContent = msg;
}

/* ================= CATEGORY FILTERS ================= */
function bindCategoryFilters() {
  if (!dom.categoryFilterBar) return;

  const pills = dom.categoryFilterBar.querySelectorAll(".category-pill");
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.activeCategory = pill.dataset.category || "all";
      applySearchAndRender();
    });
  });
}

/* ================= FEED TABS ================= */
function bindFeedTabs() {
  if (!dom.feedTabs || dom.feedTabs.length === 0) return;

  dom.feedTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      dom.feedTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.activeFeedTab = tab.dataset.feedTab || "foryou";
      applySearchAndRender();
    });
  });
}

/* ================= EXPLORE NAV ================= */
function bindExploreNav() {
  if (!dom.exploreNavBtn) return;

  dom.exploreNavBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (dom.searchInput) {
      dom.searchInput.focus();
      dom.searchInput.scrollIntoView({ behavior: "smooth" });
    }
  });
}

/* ================= THEME ENGINE ================= */
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  state.theme = savedTheme;
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI();
}

function toggleTheme() {
  const newTheme = state.theme === "light" ? "dark" : "light";
  state.theme = newTheme;
  localStorage.setItem("theme", newTheme);
  document.documentElement.setAttribute("data-theme", newTheme);
  updateThemeUI();
}

function updateThemeUI() {
  if (!dom.themeToggleBtn) return;
  const isLight = state.theme === "light";
  const icon = isLight ? "🌙" : "☀️";
  const label = isLight ? "Dark Mode" : "Light Mode";
  dom.themeToggleBtn.innerHTML = `<span class="theme-icon">${icon}</span><span class="nav-label">${label}</span>`;
}

/* ================= AUTH & SESSION ================= */
function setAuthTab(tab) {
  const signinActive = tab === "signin";
  dom.authTabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.authTab === tab));
  if (dom.signinForm) dom.signinForm.classList.toggle("hidden", !signinActive);
  if (dom.signupForm) dom.signupForm.classList.toggle("hidden", signinActive);
  setMessage("auth", signinActive ? "Welcome back." : "Create your free account.");
}

function setSession(session) {
  state.session = session || null;
  state.user = session?.user || null;
  updateSessionUI();
}

async function refreshCurrentUser() {
  if (!state.user) {
    state.profile = null;
    updateSessionUI();
    return;
  }

  const profile = await ensureProfile();
  state.profile = profile;
  updateSessionUI();
}

async function ensureProfile() {
  if (!state.user) return null;

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id, full_name, is_admin")
    .eq("id", state.user.id)
    .maybeSingle();

  if (selectError) {
    console.error("Profile fetch error:", selectError);
    return null;
  }

  if (existing) return existing;

  const fallbackName =
    state.user.user_metadata?.full_name ||
    state.user.user_metadata?.name ||
    state.user.email?.split("@")[0] ||
    "Reader";

  const payload = { id: state.user.id, full_name: fallbackName };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(payload)
    .select("id, full_name, is_admin")
    .single();

  if (insertError) {
    console.error("Profile insert error:", insertError);
    return { id: state.user.id, full_name: fallbackName, is_admin: false };
  }

  return inserted;
}

function updateSessionUI() {
  const isLoggedIn = Boolean(state.user);
  const fullName = state.profile?.full_name || state.user?.email?.split("@")[0] || "Guest";
  const handle = state.user?.email || "";

  if (dom.logoutBtn) dom.logoutBtn.classList.toggle("hidden", !isLoggedIn);
  if (dom.sessionLabel) dom.sessionLabel.textContent = isLoggedIn ? fullName : "Sign in";
  if (dom.userHandle) dom.userHandle.textContent = isLoggedIn ? `@${handle.split("@")[0]}` : "";
  if (dom.userAvatar) dom.userAvatar.textContent = fullName.charAt(0).toUpperCase();

  if (dom.authPanel) dom.authPanel.classList.toggle("hidden", isLoggedIn && state.page === "main");

  if (dom.mobileAuthGuest) dom.mobileAuthGuest.classList.toggle("hidden", isLoggedIn);
  if (dom.mobileAuthUser) dom.mobileAuthUser.classList.toggle("hidden", !isLoggedIn);

  if (dom.mobileUserName) dom.mobileUserName.textContent = fullName;
  if (dom.mobileUserHandle) dom.mobileUserHandle.textContent = isLoggedIn ? `@${handle.split("@")[0]}` : "@user";
  if (dom.mobileUserAvatar) dom.mobileUserAvatar.textContent = fullName.charAt(0).toUpperCase();

  const isTargetUserEmail = state.user?.email === "kiyikokinini@gmail.com";
  const hasAdminPrivileges = Boolean(state.profile?.is_admin) || isTargetUserEmail;

  if (dom.adminNavBtn) {
    dom.adminNavBtn.classList.toggle("hidden", !hasAdminPrivileges);
  }

  if (state.page === "admin") {
    if (dom.adminGate) {
      const showGate = !isLoggedIn || !hasAdminPrivileges;
      dom.adminGate.classList.toggle("hidden", !showGate);
    }

    if (dom.adminDashboard) {
      dom.adminDashboard.classList.toggle("hidden", !hasAdminPrivileges);
    }

    if (!isLoggedIn) {
      setMessage("admin", "Please sign in to access the admin dashboard.");
    } else if (!hasAdminPrivileges) {
      setMessage("admin", "Your account does not have administrator privileges.");
    }
  }

  if (dom.adminNameLabel) dom.adminNameLabel.textContent = fullName;
  if (dom.adminRoleLabel) dom.adminRoleLabel.textContent = hasAdminPrivileges ? "Administrator" : "Reader";
}

/* ================= AUTH HANDLERS ================= */
async function handleSignIn(event) {
  event.preventDefault();
  const email = dom.signinEmail?.value.trim();
  const password = dom.signinPassword?.value;

  if (!email || !password) return;
  setMessage("auth", "Signing in...");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage("auth", error.message);
    return;
  }

  setMessage("auth", "Signed in successfully.");
  if (dom.signinForm) dom.signinForm.reset();
}

async function handleAdminSignIn(event) {
  event.preventDefault();
  const email = dom.adminEmail?.value.trim();
  const password = dom.adminPassword?.value;

  if (!email || !password) return;
  setMessage("admin", "Signing in...");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage("admin", error.message);
    return;
  }

  setMessage("admin", "Signed in successfully.");
  if (dom.adminSignInForm) dom.adminSignInForm.reset();
}

async function handleSignUp(event) {
  event.preventDefault();
  const fullName = dom.signupName?.value.trim();
  const email = dom.signupEmail?.value.trim();
  const password = dom.signupPassword?.value;

  if (!fullName || !email || !password) return;
  setMessage("auth", "Creating account...");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) {
    setMessage("auth", error.message);
    return;
  }

  if (dom.signupForm) dom.signupForm.reset();
  setMessage("auth", data.session ? "Account created and signed in!" : "Check your email to confirm, then sign in.");
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out error:", error);
    return;
  }
  state.profile = null;
  state.selectedArticle = null;
  state.userVotes = {};
  state.userReports = {};
  closeArticleModal();
  setMessage("auth", "Signed out.");
  setMessage("admin", "Signed out.");
  setMobileAuthMessage("");
}

function setMessage(scope, message) {
  if (scope === "auth" && dom.authMessage) dom.authMessage.textContent = message;
  if (scope === "admin" && dom.adminGateMessage) dom.adminGateMessage.textContent = message;
  if (scope === "report" && dom.reportMessage) dom.reportMessage.textContent = message;
}

/* ================= ARTICLES ================= */
async function loadArticles() {
  const { data, error } = await supabase
    .from("news_articles")
    .select("id, title, content, category, image_url, image_path, author_name, author_id, created_at, updated_at, view_count, like_count, dislike_count")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load articles error:", error);
    state.articles = [];
    state.filteredArticles = [];
    renderArticles();
    return;
  }

  state.articles = data || [];

  if (state.user) {
    await loadUserVotes();
    await loadUserReports();
  }

  applySearchAndRender();

  if (state.page === "admin") {
    await renderAdminArea();
  }
}

async function loadUserVotes() {
  if (!state.user) return;
  const { data, error } = await supabase
    .from("article_votes")
    .select("article_id, vote_type")
    .eq("user_id", state.user.id);

  if (!error && data) {
    state.userVotes = {};
    data.forEach(v => { state.userVotes[v.article_id] = v.vote_type; });
  }
}

async function loadUserReports() {
  if (!state.user) return;
  const { data, error } = await supabase
    .from("article_reports")
    .select("article_id")
    .eq("user_id", state.user.id);

  if (!error && data) {
    state.userReports = {};
    data.forEach(r => { state.userReports[r.article_id] = true; });
  }
}

function handleSearch() {
  state.search = dom.searchInput?.value.trim().toLowerCase() || "";

  if (dom.explorePanel) {
    const hasSearch = state.search.length > 0;
    dom.explorePanel.classList.toggle("hidden", !hasSearch);
  }

  applySearchAndRender();
}

function applySearchAndRender() {
  const query = state.search;
  let result = state.articles;

  if (state.activeCategory && state.activeCategory !== "all") {
    result = result.filter(a => a.category === state.activeCategory);
  }

  if (query) {
    result = result.filter((article) => {
      const haystack = `${article.title} ${article.content} ${article.author_name}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  if (state.activeFeedTab === "following" && state.user) {
    result = result.filter(a => a.author_id === state.user?.id);
  } else if (state.activeFeedTab === "following" && !state.user) {
    result = [];
  }

  state.filteredArticles = result;
  renderArticles();
  renderExploreResults();
}

function renderArticles() {
  if (!dom.newsGrid) return;
  dom.newsGrid.innerHTML = "";

  if (!state.filteredArticles.length) {
    if (dom.emptyState) dom.emptyState.classList.remove("hidden");
    return;
  }

  if (dom.emptyState) dom.emptyState.classList.add("hidden");

  const template = $("#cardTemplate");
  if (!template) return;

  state.filteredArticles.forEach((article) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".news-card");
    const image = node.querySelector(".card-image");
    const author = node.querySelector(".card-author");
    const date = node.querySelector(".card-date");
    const viewCount = node.querySelector(".card-view-count");
    const likeNum = node.querySelector(".like-num");
    const dislikeNum = node.querySelector(".dislike-num");
    const viewNum = node.querySelector(".view-num");
    const title = node.querySelector(".card-title");
    const text = node.querySelector(".card-text");
    const button = node.querySelector(".open-article");

    if (image) {
      image.src = article.image_url || PLACEHOLDER_IMAGE;
      image.alt = article.title;
    }
    if (author) author.textContent = article.author_name || "Daily News";
    if (date) date.textContent = formatDate(article.created_at);
    if (viewCount) viewCount.textContent = `${formatNumber(article.view_count || 0)} views`;
    if (likeNum) likeNum.textContent = formatNumber(article.like_count || 0);
    if (dislikeNum) dislikeNum.textContent = formatNumber(article.dislike_count || 0);
    if (viewNum) viewNum.textContent = formatNumber(article.view_count || 0);
    if (title) title.textContent = article.title;
    if (text) text.textContent = truncateText(article.content, 160);

    if (button) {
      button.dataset.articleId = article.id;
      button.dataset.action = "open-article";
    }

    if (card) {
      card.dataset.articleId = article.id;
      card.tabIndex = 0;
      card.addEventListener("click", (event) => {
        if (event.target.closest?.("[data-action='open-article']")) {
          openArticleModal(article.id);
        }
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openArticleModal(article.id);
        }
      });
    }

    dom.newsGrid.appendChild(node);
  });
}

function renderExploreResults() {
  if (!dom.exploreResults) return;

  const query = state.search;
  if (!query) {
    dom.exploreResults.innerHTML = "";
    return;
  }

  const results = state.articles.filter((article) => {
    const haystack = `${article.title} ${article.content} ${article.author_name}`.toLowerCase();
    return haystack.includes(query);
  }).slice(0, 5);

  if (!results.length) {
    dom.exploreResults.innerHTML = `<p class="muted" style="padding:12px;">No results found for "${escapeHTML(query)}"</p>`;
    return;
  }

  dom.exploreResults.innerHTML = results.map(article => `
    <div class="trend-item" data-explore-article="${article.id}" style="cursor:pointer;">
      <span class="trend-meta">${escapeHTML(article.category || 'News')} · ${formatDate(article.created_at)}</span>
      <span class="trend-title">${escapeHTML(article.title)}</span>
    </div>
  `).join("");

  dom.exploreResults.querySelectorAll("[data-explore-article]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.exploreArticle;
      openArticleModal(id);
      if (dom.searchInput) dom.searchInput.value = "";
      state.search = "";
      if (dom.explorePanel) dom.explorePanel.classList.add("hidden");
      applySearchAndRender();
    });
  });
}

/* ================= VIEWS ================= */
async function incrementViewCount(articleId) {
  try {
    await supabase.rpc('increment_article_views', { article_id: articleId });
  } catch (e) {
    const article = state.articles.find(a => a.id === articleId);
    if (article) {
      const newCount = (article.view_count || 0) + 1;
      await supabase.from("news_articles").update({ view_count: newCount }).eq("id", articleId);
    }
  }
  await loadArticles();
}

/* ================= VOTES ================= */
async function handleVote(voteType) {
  if (!state.user) {
    alert("Please sign in to vote.");
    return;
  }
  if (!state.selectedArticle) return;

  const articleId = state.selectedArticle.id;
  const currentVote = state.userVotes[articleId];

  try {
    if (currentVote === voteType) {
      await supabase.from("article_votes").delete()
        .eq("article_id", articleId)
        .eq("user_id", state.user.id);

      const field = voteType === 'like' ? 'like_count' : 'dislike_count';
      const current = state.selectedArticle[field] || 0;
      await supabase.from("news_articles").update({ [field]: Math.max(0, current - 1) }).eq("id", articleId);

      delete state.userVotes[articleId];
    } else {
      if (currentVote) {
        await supabase.from("article_votes").delete()
          .eq("article_id", articleId)
          .eq("user_id", state.user.id);

        const oldField = currentVote === 'like' ? 'like_count' : 'dislike_count';
        const oldCurrent = state.selectedArticle[oldField] || 0;
        await supabase.from("news_articles").update({ [oldField]: Math.max(0, oldCurrent - 1) }).eq("id", articleId);
      }

      await supabase.from("article_votes").insert({
        article_id: articleId,
        user_id: state.user.id,
        vote_type: voteType
      });

      const field = voteType === 'like' ? 'like_count' : 'dislike_count';
      const current = state.selectedArticle[field] || 0;
      await supabase.from("news_articles").update({ [field]: current + 1 }).eq("id", articleId);

      state.userVotes[articleId] = voteType;
    }

    await loadArticles();
    updateModalVoteUI();
  } catch (error) {
    console.error("Vote error:", error);
    alert("Failed to register vote. Please try again.");
  }
}

function updateModalVoteUI() {
  if (!state.selectedArticle) return;

  const articleId = state.selectedArticle.id;
  const currentVote = state.userVotes[articleId];

  if (dom.modalLikeBtn) {
    dom.modalLikeBtn.classList.toggle('active', currentVote === 'like');
  }
  if (dom.modalDislikeBtn) {
    dom.modalDislikeBtn.classList.toggle('active', currentVote === 'dislike');
  }

  const article = state.articles.find(a => a.id === articleId);
  if (article) {
    if (dom.modalLikeCount) dom.modalLikeCount.textContent = formatNumber(article.like_count || 0);
    if (dom.modalDislikeCount) dom.modalDislikeCount.textContent = formatNumber(article.dislike_count || 0);
    if (dom.modalViewCount) dom.modalViewCount.textContent = formatNumber(article.view_count || 0);
  }
}

/* ================= REPORT ================= */
function openReportModal() {
  if (!state.user) {
    alert("Please sign in to report content.");
    return;
  }
  if (!state.selectedArticle) return;

  if (state.userReports[state.selectedArticle.id]) {
    alert("You have already reported this article.");
    return;
  }

  if (dom.reportModal) {
    dom.reportModal.classList.remove("hidden");
    dom.reportModal.setAttribute("aria-hidden", "false");
  }
  if (dom.reportForm) dom.reportForm.reset();
  if (dom.reportMessage) dom.reportMessage.textContent = "";
}

function closeReportModal() {
  if (dom.reportModal) {
    dom.reportModal.classList.add("hidden");
    dom.reportModal.setAttribute("aria-hidden", "true");
  }
}

async function handleReport(event) {
  event.preventDefault();
  if (!state.user || !state.selectedArticle) return;

  const formData = new FormData(dom.reportForm);
  const reason = formData.get("reportReason");
  const details = dom.reportDetails?.value.trim() || "";

  if (!reason) {
    setMessage("report", "Please select a reason.");
    return;
  }

  try {
    const { error } = await supabase.from("article_reports").insert({
      article_id: state.selectedArticle.id,
      user_id: state.user.id,
      user_name: state.profile?.full_name || state.user.email || "Anonymous",
      reason: reason,
      details: details,
      status: "pending"
    });

    if (error) throw error;

    state.userReports[state.selectedArticle.id] = true;
    setMessage("report", "Report submitted successfully. Thank you for helping keep our community safe.");

    if (dom.modalReportBtn) {
      dom.modalReportBtn.classList.add('active');
      const span = dom.modalReportBtn.querySelector('span');
      if (span) span.textContent = 'Reported';
    }

    setTimeout(() => {
      closeReportModal();
    }, 1500);
  } catch (error) {
    console.error("Report error:", error);
    setMessage("report", "Failed to submit report. Please try again.");
  }
}

/* ================= MODAL & COMMENTS ================= */
async function openArticleModal(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article || !dom.articleModal) return;

  state.selectedArticle = article;

  await incrementViewCount(articleId);

  if (dom.modalImage) {
    dom.modalImage.src = article.image_url || PLACEHOLDER_IMAGE;
    dom.modalImage.alt = article.title;
  }
  if (dom.modalAuthor) dom.modalAuthor.textContent = article.author_name || "Daily News";
  if (dom.modalDate) dom.modalDate.textContent = formatDate(article.created_at);
  if (dom.modalTitle) dom.modalTitle.textContent = article.title;

  if (dom.modalContent) {
    if (typeof article.content === 'string' && article.content.includes('<')) {
      dom.modalContent.innerHTML = article.content;
    } else {
      dom.modalContent.textContent = article.content;
    }
  }

  updateModalVoteUI();

  if (dom.modalReportBtn) {
    const hasReported = state.userReports[articleId];
    dom.modalReportBtn.classList.toggle('active', hasReported);
    const span = dom.modalReportBtn.querySelector('span');
    if (span) span.textContent = hasReported ? 'Reported' : 'Report';
  }

  dom.articleModal.classList.remove("hidden");
  dom.articleModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (dom.commentBody) dom.commentBody.value = "";
  if (dom.charCount) dom.charCount.textContent = "0/500";

  if (dom.commentForm) {
    dom.commentForm.classList.toggle("hidden", !state.user);
  }

  if (dom.commentHint) {
    dom.commentHint.textContent = state.user
      ? `Posting as ${state.profile?.full_name || state.user.email}`
      : "Sign in to post a comment.";
  }

  await loadComments(article.id);
}

function closeArticleModal() {
  if (!dom.articleModal) return;
  dom.articleModal.classList.add("hidden");
  dom.articleModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  state.selectedArticle = null;
}

async function loadComments(articleId) {
  if (!dom.commentsList) return;

  const { data, error } = await supabase
    .from("article_comments")
    .select("id, article_id, user_id, user_name, body, parent_comment_id, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load comments error:", error);
    dom.commentsList.innerHTML = `<p class="muted">Could not load comments.</p>`;
    return;
  }

  state.comments = data || [];
  renderComments();
}

function renderComments() {
  if (!dom.commentsList) return;

  if (!state.comments.length) {
    dom.commentsList.innerHTML = `<p class="muted">No comments yet. Be the first to speak up.</p>`;
    return;
  }

  const commentMap = new Map();
  const topLevel = [];

  state.comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  state.comments.forEach((comment) => {
    if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
      commentMap.get(comment.parent_comment_id).replies.push(comment);
    } else {
      topLevel.push(comment);
    }
  });

  dom.commentsList.innerHTML = topLevel
    .map((comment) => renderCommentWithReplies(comment, commentMap))
    .join("");

  $$("[data-delete-comment]", dom.commentsList).forEach((button) => {
    button.addEventListener("click", () => deleteComment(button.dataset.deleteComment));
  });

  $$("[data-reply-comment]", dom.commentsList).forEach((button) => {
    button.addEventListener("click", () => showReplyForm(button.dataset.replyComment));
  });
}

function renderCommentWithReplies(comment, commentMap, level = 0) {
  const canDelete = canDeleteComment(comment);
  const replies = commentMap.get(comment.id)?.replies || [];

  return `
    <article class="comment-card ${level > 0 ? 'nested' : ''}" data-comment-id="${comment.id}">
      <div class="comment-meta">
        <strong>${escapeHTML(comment.user_name || "Reader")}</strong>
        <span>${formatDate(comment.created_at)}</span>
      </div>
      <p>${escapeHTML(comment.body)}</p>
      <div class="comment-actions">
        ${state.user ? `<button class="comment-btn" type="button" data-reply-comment="${comment.id}">Reply</button>` : ""}
        ${canDelete ? `<button class="comment-delete" type="button" data-delete-comment="${comment.id}">Delete</button>` : ""}
      </div>
      <div class="comment-reply-form hidden" data-reply-form="${comment.id}">
        <textarea class="comment-reply-input" placeholder="Write a reply..." maxlength="500"></textarea>
        <div class="comment-actions">
          <button class="x-btn-action primary btn-sm" type="button" data-submit-reply="${comment.id}">Post reply</button>
          <button class="x-btn-action secondary btn-sm" type="button" data-cancel-reply="${comment.id}">Cancel</button>
        </div>
      </div>
      ${replies.map((reply) => renderCommentWithReplies(reply, commentMap, level + 1)).join("")}
    </article>
  `;
}

function showReplyForm(commentId) {
  const form = $(`[data-reply-form="${commentId}"]`);
  if (!form) return;

  const isHidden = form.classList.contains("hidden");
  $$(".comment-reply-form").forEach(f => f.classList.add("hidden"));

  form.classList.toggle("hidden", !isHidden);

  if (!form.classList.contains("hidden")) {
    const input = form.querySelector(".comment-reply-input");
    if (input) input.focus();

    const submitBtn = $(`[data-submit-reply="${commentId}"]`);
    const cancelBtn = $(`[data-cancel-reply="${commentId}"]`);

    if (submitBtn) {
      submitBtn.onclick = async () => {
        const input = form.querySelector(".comment-reply-input");
        if (!input) return;
        await handleReplyComment(commentId, input.value);
        form.classList.add("hidden");
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => form.classList.add("hidden");
    }
  }
}

function canDeleteComment(comment) {
  if (!state.user) return false;
  const isTargetUserEmail = state.user.email === "kiyikokinini@gmail.com";
  return Boolean(state.profile?.is_admin) || isTargetUserEmail || state.user.id === comment.user_id;
}

async function handleAddComment(event) {
  event.preventDefault();
  if (!state.user || !state.selectedArticle) {
    setMessage("auth", "Sign in before posting a comment.");
    return;
  }

  const body = dom.commentBody?.value.trim();
  if (!body) return;

  const payload = {
    article_id: state.selectedArticle.id,
    user_id: state.user.id,
    user_name: state.profile?.full_name || state.user.email || "Reader",
    body,
    parent_comment_id: null
  };

  const { error } = await supabase.from("article_comments").insert(payload);
  if (error) {
    alert(error.message);
    return;
  }

  if (dom.commentBody) dom.commentBody.value = "";
  if (dom.charCount) dom.charCount.textContent = "0/500";
  await loadComments(state.selectedArticle.id);
  await loadArticles();
}

async function handleReplyComment(parentCommentId, replyText) {
  if (!state.user || !state.selectedArticle) {
    setMessage("auth", "Sign in before posting a reply.");
    return;
  }

  const body = replyText.trim();
  if (!body) return;

  const payload = {
    article_id: state.selectedArticle.id,
    user_id: state.user.id,
    user_name: state.profile?.full_name || state.user.email || "Reader",
    body,
    parent_comment_id: parentCommentId
  };

  const { error } = await supabase.from("article_comments").insert(payload);
  if (error) {
    alert(error.message);
    return;
  }

  await loadComments(state.selectedArticle.id);
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment permanently?")) return;
  const { error } = await supabase.from("article_comments").delete().eq("id", commentId);
  if (error) {
    alert(error.message);
    return;
  }

  if (state.selectedArticle) {
    await loadComments(state.selectedArticle.id);
  }
  await loadArticles();
}

/* ================= ADMIN AREA ================= */
async function renderAdminArea() {
  if (state.page !== "admin") return;

  const isTargetUserEmail = state.user?.email === "kiyikokinini@gmail.com";
  const hasAdminPrivileges = Boolean(state.profile?.is_admin) || isTargetUserEmail;

  if (!hasAdminPrivileges) {
    if (dom.adminDashboard) dom.adminDashboard.classList.add("hidden");
    if (dom.adminGate) dom.adminGate.classList.remove("hidden");
    return;
  }

  if (dom.adminDashboard) dom.adminDashboard.classList.remove("hidden");
  if (dom.adminGate) dom.adminGate.classList.add("hidden");

  if (dom.statArticles) dom.statArticles.textContent = String(state.articles.length);

  const totalViews = state.articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
  const totalLikes = state.articles.reduce((sum, a) => sum + (a.like_count || 0), 0);
  if (dom.statTotalViews) dom.statTotalViews.textContent = formatNumber(totalViews);
  if (dom.statTotalLikes) dom.statTotalLikes.textContent = formatNumber(totalLikes);

  const { data: commentsData, error: commentsError } = await supabase
    .from("article_comments")
    .select("id, article_id, user_id, user_name, body, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  state.adminComments = commentsError ? [] : commentsData || [];
  if (dom.statComments) dom.statComments.textContent = String(state.adminComments.length);

  const { data: reportsData, error: reportsError } = await supabase
    .from("article_reports")
    .select("id, article_id, user_id, user_name, reason, details, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  state.adminReports = reportsError ? [] : reportsData || [];
  if (dom.statReports) dom.statReports.textContent = String(state.adminReports.length);

  renderAdminArticles();
  renderAdminComments();
  renderAdminReports();
}

function renderAdminArticles() {
  if (!dom.adminArticles) return;
  dom.adminArticles.innerHTML = "";

  if (!state.articles.length) {
    dom.adminArticles.innerHTML = `<p class="muted">No articles yet. Publish the first one above.</p>`;
    return;
  }

  dom.adminArticles.innerHTML = state.articles
    .map((article) => {
      const preview = truncateText(article.content, 120);
      return `
        <article class="admin-item">
          <img src="${escapeHTML(article.image_url || PLACEHOLDER_IMAGE)}" alt="${escapeHTML(article.title)}" loading="lazy" />
          <div class="admin-item-body">
            <div class="admin-item-top">
              <div>
                <h3>${escapeHTML(article.title)}</h3>
                <p class="muted">${escapeHTML(preview)}</p>
              </div>
              <span class="pill">${formatDate(article.created_at)}</span>
            </div>
            <div class="admin-item-stats">
              <span class="pill">👁 ${formatNumber(article.view_count || 0)}</span>
              <span class="pill">❤️ ${formatNumber(article.like_count || 0)}</span>
              <span class="pill">👎 ${formatNumber(article.dislike_count || 0)}</span>
            </div>
            <div class="admin-item-actions">
              <button class="x-btn-action secondary btn-sm" type="button" data-edit-article="${article.id}">Edit</button>
              <button class="x-btn-action btn-sm" type="button" data-delete-article="${article.id}" style="background:var(--danger-light);color:var(--danger);border:none;">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  $$("[data-edit-article]", dom.adminArticles).forEach((button) => {
    button.addEventListener("click", () => editArticle(button.dataset.editArticle));
  });

  $$("[data-delete-article]", dom.adminArticles).forEach((button) => {
    button.addEventListener("click", () => deleteArticle(button.dataset.deleteArticle));
  });
}

function renderAdminComments() {
  if (!dom.adminCommentsList) return;

  if (!state.adminComments.length) {
    dom.adminCommentsList.innerHTML = `<p class="muted">No comments to manage.</p>`;
    return;
  }

  const articleMap = new Map(state.articles.map((article) => [article.id, article.title]));
  dom.adminCommentsList.innerHTML = state.adminComments
    .map((comment) => {
      const title = articleMap.get(comment.article_id) || "Unknown article";
      return `
        <article class="comment-card comment-admin">
          <div class="comment-meta">
            <strong>${escapeHTML(comment.user_name || "Reader")}</strong>
            <span>${formatDate(comment.created_at)}</span>
          </div>
          <p>${escapeHTML(comment.body)}</p>
          <div class="comment-admin-footer">
            <span class="pill">${escapeHTML(title)}</span>
            <button class="comment-delete" type="button" data-delete-comment-admin="${comment.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");

  $$("[data-delete-comment-admin]", dom.adminCommentsList).forEach((button) => {
    button.addEventListener("click", () => deleteComment(button.dataset.deleteCommentAdmin));
  });
}

function renderAdminReports() {
  if (!dom.adminReportsList) return;

  if (!state.adminReports.length) {
    dom.adminReportsList.innerHTML = `<p class="muted">No reports to review.</p>`;
    return;
  }

  const articleMap = new Map(state.articles.map((article) => [article.id, article.title]));

  dom.adminReportsList.innerHTML = state.adminReports
    .map((report) => {
      const title = articleMap.get(report.article_id) || "Unknown article";
      return `
        <article class="report-item">
          <div class="report-item-header">
            <strong>${escapeHTML(report.reason)}</strong>
            <span class="pill">${report.status || 'pending'}</span>
          </div>
          <p>${escapeHTML(report.details || 'No additional details')}</p>
          <div class="report-item-footer">
            <span>By ${escapeHTML(report.user_name || 'Anonymous')} · ${formatDate(report.created_at)}</span>
            <span class="pill">${escapeHTML(title)}</span>
          </div>
          <div class="admin-item-actions" style="margin-top:8px;">
            ${report.status !== 'resolved' ? `<button class="x-btn-action secondary btn-sm" type="button" data-resolve-report="${report.id}">Mark Resolved</button>` : ''}
            <button class="x-btn-action btn-sm" type="button" data-dismiss-report="${report.id}" style="background:var(--danger-light);color:var(--danger);border:none;">Dismiss</button>
          </div>
        </article>
      `;
    })
    .join("");

  $$("[data-resolve-report]", dom.adminReportsList).forEach((button) => {
    button.addEventListener("click", () => resolveReport(button.dataset.resolveReport));
  });

  $$("[data-dismiss-report]", dom.adminReportsList).forEach((button) => {
    button.addEventListener("click", () => dismissReport(button.dataset.dismissReport));
  });
}

async function resolveReport(reportId) {
  const { error } = await supabase.from("article_reports").update({ status: "resolved" }).eq("id", reportId);
  if (error) {
    alert(error.message);
    return;
  }
  await renderAdminArea();
}

async function dismissReport(reportId) {
  if (!confirm("Dismiss this report?")) return;
  const { error } = await supabase.from("article_reports").delete().eq("id", reportId);
  if (error) {
    alert(error.message);
    return;
  }
  await renderAdminArea();
}

function editArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return;

  if (dom.articleModeLabel) dom.articleModeLabel.textContent = "Editing article";
  if (dom.articleId) dom.articleId.value = article.id;
  if (dom.articleTitle) dom.articleTitle.value = article.title;
  if (dom.articleCategory) dom.articleCategory.value = article.category || "";

  if (dom.articleContent) dom.articleContent.innerHTML = article.content || "";
  if (dom.articleContentHtml) dom.articleContentHtml.value = article.content || "";

  if (dom.articleImage) dom.articleImage.value = "";
  if (dom.imagePreview) {
    dom.imagePreview.src = article.image_url || "";
    dom.imagePreview.classList.toggle("hidden", !article.image_url);
  }
  if (dom.imageHelp) dom.imageHelp.textContent = "Uploading a new image will replace the current one.";

  if (dom.saveArticleBtn) dom.saveArticleBtn.textContent = "Update article";
  if (dom.cancelEditBtn) dom.cancelEditBtn.classList.remove("hidden");

  if (dom.articleForm) dom.articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetArticleForm() {
  if (dom.articleForm) dom.articleForm.reset();
  if (dom.articleId) dom.articleId.value = "";
  if (dom.articleModeLabel) dom.articleModeLabel.textContent = "Create article";
  if (dom.saveArticleBtn) dom.saveArticleBtn.textContent = "Publish article";
  if (dom.cancelEditBtn) dom.cancelEditBtn.classList.add("hidden");
  if (dom.imagePreview) {
    dom.imagePreview.classList.add("hidden");
    dom.imagePreview.removeAttribute("src");
  }
  if (dom.imageHelp) dom.imageHelp.textContent = "Choose a JPG, PNG, or WebP image. It will be stored in Supabase Storage.";

  if (dom.articleContent) dom.articleContent.innerHTML = "";
  if (dom.articleContentHtml) dom.articleContentHtml.value = "";
  if (dom.articleCategory) dom.articleCategory.value = "";
}

async function handleSaveArticle(event) {
  event.preventDefault();

  const isTargetUserEmail = state.user?.email === "kiyikokinini@gmail.com";
  const hasAdminPrivileges = Boolean(state.profile?.is_admin) || isTargetUserEmail;

  if (!hasAdminPrivileges || !state.user) {
    alert("Admin access required.");
    return;
  }

  const articleId = dom.articleId?.value.trim();
  const title = dom.articleTitle?.value.trim();
  const category = dom.articleCategory?.value.trim() || "News";
  const content = dom.articleContent?.innerHTML?.trim() || "";

  if (!title || !content) {
    alert("Title and content are required.");
    return;
  }

  const file = dom.articleImage?.files?.[0];

  try {
    if (dom.saveArticleBtn) {
      dom.saveArticleBtn.disabled = true;
      dom.saveArticleBtn.textContent = articleId ? "Updating..." : "Publishing...";
    }

    let imageUrl = "";
    let imagePath = "";

    const current = articleId ? state.articles.find((item) => item.id === articleId) : null;
    if (current) {
      imageUrl = current.image_url || "";
      imagePath = current.image_path || "";
    }

    if (file) {
      const uploaded = await uploadImage(file);
      imageUrl = uploaded.publicUrl;
      imagePath = uploaded.path;
    } else if (!articleId && !imageUrl) {
      alert("Please choose an image for the new article.");
      return;
    }

    const payload = {
      title,
      content,
      category,
      image_url: imageUrl,
      image_path: imagePath,
      author_id: state.user.id,
      author_name: state.profile?.full_name || state.user.email || "Admin"
    };

    if (articleId) {
      const { error: updateError } = await supabase
        .from("news_articles")
        .update(payload)
        .eq("id", articleId);

      if (updateError) throw updateError;

      if (file && current?.image_path && current.image_path !== imagePath) {
        await removeImage(current.image_path);
      }
    } else {
      const { error: insertError } = await supabase
        .from("news_articles")
        .insert({ ...payload, view_count: 0, like_count: 0, dislike_count: 0 });

      if (insertError) {
        if (/row-level security/i.test(insertError.message || "")) {
          insertError.message += " — Check your Supabase RLS policies.";
        }
        throw insertError;
      }
    }

    resetArticleForm();
    await loadArticles();
    alert(articleId ? "Article updated successfully." : "Article published successfully.");
  } catch (error) {
    console.error("Save article error:", error);
    alert(error.message || "Failed to save article.");
  } finally {
    if (dom.saveArticleBtn) {
      dom.saveArticleBtn.disabled = false;
      dom.saveArticleBtn.textContent = dom.articleId?.value?.trim() ? "Update article" : "Publish article";
    }
  }
}

async function deleteArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return;
  if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;

  const { error } = await supabase.from("news_articles").delete().eq("id", articleId);
  if (error) {
    alert(error.message);
    return;
  }

  if (article.image_path) {
    await removeImage(article.image_path);
  }

  if (dom.articleId?.value === articleId) resetArticleForm();
  await loadArticles();
}

/* ================= STORAGE ================= */
async function uploadImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileName = `${uuid}.${ext}`;
  const now = new Date();
  const folder = `news/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const path = `${folder}/${fileName}`;

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "application/octet-stream"
        });

      if (uploadError) {
        lastError = uploadError;
        if (attempt < maxAttempts && /fetch|network|http2/i.test(uploadError.message)) {
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
          continue;
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      return { path, publicUrl: data.publicUrl };
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) throw err;
    }
  }
  throw lastError || new Error("Image upload failed");
}

async function removeImage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) console.warn("Could not remove image:", error.message);
}