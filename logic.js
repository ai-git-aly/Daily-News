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
  adminComments: [],
  theme: "light"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const dom = {};

// Utility functions
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

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  initTheme();
  bindStaticEvents();

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

function cacheDom() {
  // Navigation & Theme
  dom.adminNavBtn = $("#adminNavBtn");
  dom.themeToggleBtn = $("#themeToggleBtn");
  dom.logoutBtn = $("#logoutBtn");
  dom.sessionLabel = $("#sessionLabel");
  dom.userHandle = $("#userHandle");
  dom.userAvatar = $("#userAvatar");

  // Main page
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
  dom.searchInput = $("#searchInput");
  dom.newsGrid = $("#newsGrid");
  dom.emptyState = $("#emptyState");

  // Modal
  dom.articleModal = $("#articleModal");
  dom.modalImage = $("#modalImage");
  dom.modalAuthor = $("#modalAuthor");
  dom.modalDate = $("#modalDate");
  dom.modalTitle = $("#modalTitle");
  dom.modalContent = $("#modalContent");
  dom.modalCommentCount = $("#modalCommentCount");
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
  dom.adminComments = $("#adminComments");
}

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

  // Rich text editor
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

// ================= THEME ENGINE =================
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
  const label = isLight ? "Dark Mode" : "White Mode";
  dom.themeToggleBtn.innerHTML = `<span class="theme-icon">${icon}</span><span class="nav-label">${label}</span>`;
}

// ================= AUTH & SESSION =================
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

  // Sidebar profile
  if (dom.logoutBtn) dom.logoutBtn.classList.toggle("hidden", !isLoggedIn);
  if (dom.sessionLabel) dom.sessionLabel.textContent = isLoggedIn ? fullName : "Sign in";
  if (dom.userHandle) dom.userHandle.textContent = isLoggedIn ? `@${handle.split("@")[0]}` : "";
  if (dom.userAvatar) dom.userAvatar.textContent = fullName.charAt(0).toUpperCase();

  // Auth panel on main page
  if (dom.authPanel) dom.authPanel.classList.toggle("hidden", isLoggedIn && state.page === "main");

  // Admin logic: ONLY show admin nav if user has is_admin=true OR matches admin email
  const isTargetUserEmail = state.user?.email === "kiyikokinini@gmail.com";
  const hasAdminPrivileges = Boolean(state.profile?.is_admin) || isTargetUserEmail;

  if (dom.adminNavBtn) {
    dom.adminNavBtn.classList.toggle("hidden", !hasAdminPrivileges);
  }

  // Admin page specific
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

// ================= AUTH HANDLERS =================
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
  closeArticleModal();
  setMessage("auth", "Signed out.");
  setMessage("admin", "Signed out.");
}

function setMessage(scope, message) {
  if (scope === "auth" && dom.authMessage) dom.authMessage.textContent = message;
  if (scope === "admin" && dom.adminGateMessage) dom.adminGateMessage.textContent = message;
}

// ================= ARTICLES =================
async function loadArticles() {
  const { data, error } = await supabase
    .from("news_articles")
    .select("id, title, content, category, image_url, image_path, author_name, author_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load articles error:", error);
    state.articles = [];
    state.filteredArticles = [];
    renderArticles();
    return;
  }

  state.articles = data || [];
  applySearchAndRender();

  if (state.page === "admin") {
    await renderAdminArea();
  }
}

function handleSearch() {
  state.search = dom.searchInput?.value.trim().toLowerCase() || "";
  applySearchAndRender();
}

function applySearchAndRender() {
  const query = state.search;
  state.filteredArticles = state.articles.filter((article) => {
    const haystack = `${article.title} ${article.content} ${article.author_name}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  renderArticles();
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
    const title = node.querySelector(".card-title");
    const text = node.querySelector(".card-text");
    const button = node.querySelector(".open-article");

    if (image) {
      image.src = article.image_url || PLACEHOLDER_IMAGE;
      image.alt = article.title;
    }
    if (author) author.textContent = article.author_name || "Daily News";
    if (date) date.textContent = formatDate(article.created_at);
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

// ================= MODAL & COMMENTS =================
async function openArticleModal(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article || !dom.articleModal) return;

  state.selectedArticle = article;

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
  if (dom.modalCommentCount) dom.modalCommentCount.textContent = state.comments.length;
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

// ================= ADMIN AREA =================
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

  const { data: commentsData, error: commentsError } = await supabase
    .from("article_comments")
    .select("id, article_id, user_id, user_name, body, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  state.adminComments = commentsError ? [] : commentsData || [];
  if (dom.statComments) dom.statComments.textContent = String(state.adminComments.length);

  renderAdminArticles();
  renderAdminComments();
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
  if (!dom.adminComments) return;

  if (!state.adminComments.length) {
    dom.adminComments.innerHTML = `<p class="muted">No comments to manage.</p>`;
    return;
  }

  const articleMap = new Map(state.articles.map((article) => [article.id, article.title]));
  dom.adminComments.innerHTML = state.adminComments
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

  $$("[data-delete-comment-admin]", dom.adminComments).forEach((button) => {
    button.addEventListener("click", () => deleteComment(button.dataset.deleteCommentAdmin));
  });
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
        .insert(payload);

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

// ================= STORAGE =================
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