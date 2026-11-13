const ChatUI = (function () {
  let activeConversationId = null;
  let conversations = [];
  let isSending = false;
  let activeUtterance = null;

  const dom = {
    chatContainer: document.querySelector(".chatContainer"),
    sidebar: document.getElementById("chatSidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    sidebarClose: document.getElementById("sidebarClose"),
    conversationList: document.getElementById("conversationList"),
    newChatBtn: document.getElementById("newChatBtn"),
    sidebarNewChatBtn: document.getElementById("sidebarNewChatBtn"),
    chatViewport: document.getElementById("chatViewport"),
    emptyState: document.getElementById("emptyState"),
    chatStream: document.getElementById("chatStream"),
    typingIndicator: document.getElementById("typingIndicator"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    micBtn: document.getElementById("micBtn"),
    activeChatTitle: document.getElementById("activeChatTitle"),
    activeChatSub: document.getElementById("activeChatSub"),
    heroInput: document.getElementById("heroInput"),
    heroSearchBtn: document.getElementById("heroSearchBtn"),
    startChatBtn: document.getElementById("startChatBtn"),
  };

  function showToast(message) {
    if (window.UIInteractions && window.UIInteractions.showToast) {
      window.UIInteractions.showToast(message);
    } else {
      let toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.classList.add("active");
        setTimeout(() => toast.classList.remove("active"), 2800);
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function scrollChatBottom() {
    if (dom.chatViewport) {
      dom.chatViewport.scrollTo({
        top: dom.chatViewport.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  function formatRelativeDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 7) return "Previous 7 Days";
    return "Older";
  }

  function groupConversationsByDate(convs) {
    const groups = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    convs.forEach((c) => {
      const groupKey = formatRelativeDate(c.updatedAt || c.createdAt);
      if (groups[groupKey]) {
        groups[groupKey].push(c);
      } else {
        groups["Older"].push(c);
      }
    });

    return groups;
  }

  async function loadConversations() {
    if (!dom.conversationList) return;
    try {
      conversations = await API.listConversations();
      renderSidebarConversations();
    } catch (err) {
      console.warn("Could not load conversations", err);
      dom.conversationList.innerHTML = `
        <div class="convEmptyNotice">
          Sign in or ask a question to begin saving conversation history.
        </div>
      `;
    }
  }

  function renderSidebarConversations() {
    if (!dom.conversationList) return;
    if (!conversations || conversations.length === 0) {
      dom.conversationList.innerHTML = `
        <div class="convEmptyNotice">
          No previous conversations yet.<br>Ask a legal question below to start.
        </div>
      `;
      return;
    }

    const grouped = groupConversationsByDate(conversations);
    let html = "";

    for (const [groupName, convList] of Object.entries(grouped)) {
      if (convList.length === 0) continue;
      html += `<div class="convGroupLabel">${groupName}</div>`;
      convList.forEach((c) => {
        const isActive = c.id === activeConversationId ? "active" : "";
        const title = escapeHtml(c.title || "Legal Inquiry");
        html += `
          <div class="convItem ${isActive}" data-id="${c.id}">
            <div class="convItemIcon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div class="convItemTitle" title="${title}">${title}</div>
            <button type="button" class="convDeleteBtn" title="Delete conversation" data-id="${c.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `;
      });
    }

    dom.conversationList.innerHTML = html;

    dom.conversationList.querySelectorAll(".convItem").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".convDeleteBtn")) return;
        const convId = el.getAttribute("data-id");
        switchConversation(convId);
      });
    });

    dom.conversationList.querySelectorAll(".convDeleteBtn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const convId = btn.getAttribute("data-id");
        if (!confirm("Are you sure you want to delete this conversation?")) return;
        try {
          await API.deleteConversation(convId);
          showToast("Conversation deleted.");
          if (activeConversationId === convId) {
            startNewChat();
          }
          await loadConversations();
        } catch (err) {
          showToast(err.message || "Could not delete conversation.");
        }
      });
    });
  }

  async function switchConversation(convId) {
    activeConversationId = convId;
    renderSidebarConversations();

    if (dom.activeChatTitle) {
      const match = conversations.find((c) => c.id === convId);
      dom.activeChatTitle.textContent = (match && match.title) || "Conversation";
    }

    dom.emptyState.style.display = "none";
    dom.chatStream.style.display = "flex";
    dom.chatStream.innerHTML = `
      <div class="loadingMessages">
        <div class="typingDot"></div>
        <div class="typingDot"></div>
        <div class="typingDot"></div>
        <span>Loading conversation history...</span>
      </div>
    `;

    try {
      const conv = await API.getConversation(convId);
      dom.chatStream.innerHTML = "";
      if (conv.messages && conv.messages.length > 0) {
        conv.messages.forEach((m) => {
          if (m.role === "user") {
            renderUserMessage(m.content);
          } else {
            const guidanceData = m.structuredResponse || {
              summary: m.content,
              citations: (m.citations || []).map((c) => ({
                chunk_id: c.chunkId,
                document: c.sourceDocument,
                source_url: c.sourceUrl,
                page_range: c.pageRange,
                fidelity_classification: c.fidelityClassification,
                data_as_of: c.dataAsOf,
              })),
            };
            renderAssistantResponse(guidanceData);
          }
        });
      } else {
        dom.emptyState.style.display = "block";
        dom.chatStream.style.display = "none";
      }
      scrollChatBottom();
    } catch (err) {
      dom.chatStream.innerHTML = `
        <div class="errorBanner">
          Failed to load conversation: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function startNewChat() {
    activeConversationId = null;
    if (dom.activeChatTitle) {
      dom.activeChatTitle.textContent = "Nyaya Sahayak";
    }
    dom.chatStream.innerHTML = "";
    dom.chatStream.style.display = "none";
    dom.emptyState.style.display = "block";
    renderSidebarConversations();
    if (dom.chatInput) dom.chatInput.focus();
  }

  function renderUserMessage(text) {
    if (dom.emptyState) dom.emptyState.style.display = "none";
    if (dom.chatStream) dom.chatStream.style.display = "flex";

    const row = document.createElement("div");
    row.className = "messageRow userRow";
    row.innerHTML = `<div class="userBubble">${escapeHtml(text)}</div>`;
    dom.chatStream.appendChild(row);
    scrollChatBottom();
  }

  function renderAssistantResponse(data) {
    if (dom.emptyState) dom.emptyState.style.display = "none";
    if (dom.chatStream) dom.chatStream.style.display = "flex";

    const row = document.createElement("div");
    row.className = "messageRow assistantRow";

    let bodyHtml = `<div class="directAnswer">${data.summary || "Legal guidance retrieved."}</div>`;

    if (data.steps && data.steps.length > 0) {
      bodyHtml += `
        <div class="sectionLabel">PROCEDURE &amp; GUIDANCE:</div>
        <ol class="stepsList">
          ${data.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
      `;
    }

    if (data.important) {
      bodyHtml += `
        <div class="importantBox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div><strong>Important:</strong> ${data.important}</div>
        </div>
      `;
    }

    if (data.portal && data.portal.url) {
      bodyHtml += `
        <div class="portalBox">
          <div class="portalInfo">
            <span class="portalLabel">OFFICIAL CITIZEN PORTAL</span>
            <div class="portalTitle">${escapeHtml(data.portal.title || "Government Portal")}</div>
          </div>
          <a href="${escapeHtml(data.portal.url)}" target="_blank" rel="noopener noreferrer" class="portalBtn">
            <span>Visit ${escapeHtml(data.portal.domain || "gov.in")}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      `;
    }

    if (data.citations && data.citations.length > 0) {
      bodyHtml += `
        <div class="citationsContainer">
          <button type="button" class="citationsToggleBtn" aria-expanded="false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span>Verified Legal Citations (${data.citations.length})</span>
            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div class="citationsDrawer" style="display: none;">
            ${data.citations
              .map(
                (c) => `
              <div class="citationCard">
                <div class="citationHeader">
                  <span class="citationDoc">${escapeHtml(c.document || "Official Document")}</span>
                  <span class="citationFidelity ${c.fidelity_classification || "verbatim"}">${escapeHtml(c.fidelity_classification || "verbatim")}</span>
                </div>
                ${c.page_range ? `<div class="citationPage">${escapeHtml(c.page_range)}</div>` : ""}
                ${
                  c.source_url
                    ? `<a href="${escapeHtml(c.source_url)}" target="_blank" rel="noopener noreferrer" class="citationLink">View Source Authority &rarr;</a>`
                    : ""
                }
                ${c.data_as_of ? `<div class="citationDate">Verified Data as of: ${escapeHtml(c.data_as_of)}</div>` : ""}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (data.followUps && data.followUps.length > 0) {
      bodyHtml += `
        <div class="followUpsWrapper">
          <div class="followUpsLabel">Related Inquiries:</div>
          <div class="followUpsList">
            ${data.followUps
              .map(
                (f) => `
              <button type="button" class="followUpChip" data-query="${escapeHtml(f)}">
                <span>${escapeHtml(f)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="assistantCard">
        <div class="assistantHeader">
          <div class="assistantIdentity">
            <div class="cardAvatar">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14.5" stroke="#142B4A" stroke-width="1.6"/>
                <path d="M16 7V23" stroke="#142B4A" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M10 12H22" stroke="#142B4A" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="16" cy="12" r="1.5" fill="#DFA04B"/>
                <path d="M10 12L7.5 17.5M10 12L12.5 17.5" stroke="#142B4A" stroke-width="0.9"/>
                <path d="M6.5 17.5C6.5 19 13.5 19 13.5 17.5H6.5Z" fill="#142B4A"/>
                <path d="M22 12L19.5 17.5M22 12L24.5 17.5" stroke="#142B4A" stroke-width="0.9"/>
                <path d="M18.5 17.5C18.5 19 25.5 19 25.5 17.5H18.5Z" fill="#142B4A"/>
                <path d="M12 24H20" stroke="#142B4A" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <div class="cardSender">Nyaya Sahayak</div>
              <div class="cardTime">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull; Ministry of Law &amp; Justice</div>
            </div>
          </div>
          <div class="cardTools">
            <button type="button" class="toolBtn listenBtn" title="Read Aloud" aria-label="Read guidance aloud">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <button type="button" class="toolBtn copyBtn" title="Copy Answer" aria-label="Copy guidance to clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <div class="assistantContent">
          ${bodyHtml}
        </div>
      </div>
    `;

    dom.chatStream.appendChild(row);

    const toggleBtn = row.querySelector(".citationsToggleBtn");
    const drawer = row.querySelector(".citationsDrawer");
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener("click", () => {
        const isClosed = drawer.style.display === "none";
        drawer.style.display = isClosed ? "block" : "none";
        toggleBtn.setAttribute("aria-expanded", isClosed ? "true" : "false");
        toggleBtn.classList.toggle("open", isClosed);
      });
    }

    row.querySelectorAll(".followUpChip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-query");
        if (q) handleDirectQuery(q);
      });
    });

    const copyBtn = row.querySelector(".copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const rawText = row.querySelector(".assistantContent").innerText;
        navigator.clipboard.writeText(rawText).then(() => {
          showToast("Guidance copied to clipboard.");
        });
      });
    }

    const listenBtn = row.querySelector(".listenBtn");
    if (listenBtn) {
      listenBtn.addEventListener("click", () => {
        if (!("speechSynthesis" in window)) {
          showToast("Speech audio is not supported in this browser.");
          return;
        }
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          listenBtn.classList.remove("active");
          return;
        }
        const textToSpeak = (data.summary || "").replace(/<[^>]*>/g, "");
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "en-IN";
        utterance.onend = () => listenBtn.classList.remove("active");
        utterance.onerror = () => listenBtn.classList.remove("active");
        listenBtn.classList.add("active");
        window.speechSynthesis.speak(utterance);
      });
    }

    scrollChatBottom();
  }

  async function handleDirectQuery(queryText) {
    if (!queryText || !queryText.trim() || isSending) return;
    const message = queryText.trim();

    renderUserMessage(message);

    if (dom.typingIndicator) {
      dom.typingIndicator.style.display = "flex";
      scrollChatBottom();
    }
    if (dom.chatInput) {
      dom.chatInput.value = "";
      dom.chatInput.style.height = "auto";
    }

    isSending = true;
    if (dom.sendBtn) dom.sendBtn.disabled = true;

    try {
      const guidance = await API.sendMessage(message, activeConversationId);
      if (dom.typingIndicator) dom.typingIndicator.style.display = "none";

      if (guidance.conversationId) {
        activeConversationId = guidance.conversationId;
      }

      renderAssistantResponse(guidance);
      await loadConversations();
    } catch (err) {
      if (dom.typingIndicator) dom.typingIndicator.style.display = "none";
      const errorRow = document.createElement("div");
      errorRow.className = "messageRow assistantRow";
      errorRow.innerHTML = `
        <div class="assistantCard errorCard">
          <div class="errorTitle">Unable to Retrieve Legal Guidance</div>
          <p>${escapeHtml(err.message || "The legal reasoning service is currently unavailable. Please check back shortly.")}</p>
        </div>
      `;
      dom.chatStream.appendChild(errorRow);
      scrollChatBottom();
    } finally {
      isSending = false;
      if (dom.sendBtn) dom.sendBtn.disabled = false;
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const query = dom.chatInput.value.trim();
    if (!query) return;
    handleDirectQuery(query);
  }

  function setupInputAutosize() {
    if (!dom.chatInput) return;
    dom.chatInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 160) + "px";
    });

    dom.chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        dom.chatForm.requestSubmit();
      }
    });
  }

  function setupSidebarToggle() {
    if (dom.sidebarToggle && dom.sidebar) {
      dom.sidebarToggle.addEventListener("click", () => {
        dom.sidebar.classList.toggle("open");
      });
    }
    if (dom.sidebarClose && dom.sidebar) {
      dom.sidebarClose.addEventListener("click", () => {
        dom.sidebar.classList.remove("open");
      });
    }
  }

  function setupQuickPromptButtons() {
    document.querySelectorAll(".suggestedBtn, .serviceTile").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const q = btn.getAttribute("query");
        if (q) {
          const chatSec = document.getElementById("chatbot");
          if (chatSec) chatSec.scrollIntoView({ behavior: "smooth" });
          handleDirectQuery(q);
        }
      });
    });

    if (dom.heroSearchBtn && dom.heroInput) {
      dom.heroSearchBtn.addEventListener("click", () => {
        const q = dom.heroInput.value.trim();
        if (q) {
          const chatSec = document.getElementById("chatbot");
          if (chatSec) chatSec.scrollIntoView({ behavior: "smooth" });
          handleDirectQuery(q);
          dom.heroInput.value = "";
        }
      });
      dom.heroInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          dom.heroSearchBtn.click();
        }
      });
    }

    if (dom.newChatBtn) {
      dom.newChatBtn.addEventListener("click", startNewChat);
    }
    if (dom.sidebarNewChatBtn) {
      dom.sidebarNewChatBtn.addEventListener("click", startNewChat);
    }
  }

  return {
    init: function () {
      setupInputAutosize();
      setupSidebarToggle();
      setupQuickPromptButtons();
      if (dom.chatForm) dom.chatForm.addEventListener("submit", handleFormSubmit);
      loadConversations();
    },
    loadConversations,
    startNewChat,
    handleDirectQuery,
  };
})();
