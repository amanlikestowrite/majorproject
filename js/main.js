(function () {
  'use strict';
  let isAwaitingResponse = false;
  let activeUtterance = null;
  let activeConversationId = null;
  const dom = {
    heroInput: document.getElementById('heroInput'),
    heroSearchBtn: document.getElementById('heroSearchBtn'),
    startChatBtn: document.getElementById('startChatBtn'),
    exploreBtn: document.getElementById('exploreBtn'),
    chatViewport: document.getElementById('chatViewport'),
    emptyState: document.getElementById('emptyState'),
    chatStream: document.getElementById('chatStream'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    micBtn: document.getElementById('micBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    typingIndicator: document.getElementById('typingIndicator')
  };
  function findBestKnowledgeMatch(query) {
    const raw = query.toLowerCase().trim();
    const tokens = new Set(raw.match(/[\w\u0900-\u097F]+/g) || []);
    const stopwords = new Set(['how', 'what', 'who', 'where', 'when', 'can', 'the', 'is', 'for', 'about', 'and', 'with', 'my', 'your', 'i', 'do']);
    let bestMatchKey = null;
    let highestScore = 0;
    for (const [key, item] of Object.entries(CHATBOT_KNOWLEDGE_BASE)) {
      let score = 0;
      const matchedTokens = new Set();
      for (const kw of item.keys) {
        const kwLower = kw.toLowerCase().trim();
        const kwWords = kwLower.split(/\s+/).length;
        if (raw === kwLower) {
          score += 120;
        }
        else if (new RegExp('(^|\\s|[.,!?])' + kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|\\s|[.,!?])').test(raw)) {
          score += (kwWords >= 2 ? 35 * kwWords : 20);
        } else {
          const kwTokens = kwLower.match(/[\w\u0900-\u097F]+/g) || [];
          for (const token of kwTokens) {
            if (token.length > 2 && !stopwords.has(token) && tokens.has(token) && !matchedTokens.has(token)) {
              matchedTokens.add(token);
              score += 5;
            }
          }
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatchKey = key;
      }
    }
    if (highestScore >= 12 && bestMatchKey) {
      return CHATBOT_KNOWLEDGE_BASE[bestMatchKey]['en'];
    }
    return CHATBOT_FALLBACK_RESPONSE['en'];
  }
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function getFormattedTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function renderUserMessage(text) {
    if (dom.emptyState && dom.emptyState.style.display !== 'none') {
      dom.emptyState.style.display = 'none';
      dom.chatStream.style.display = 'flex';
    }
    const row = document.createElement('div');
    row.className = 'messageRow userRow';
    row.innerHTML = `<div class="userBubble">${escapeHtml(text)}</div>`;
    dom.chatStream.appendChild(row);
    scrollChatBottom();
  }
  function renderAssistantResponse(data) {
    const row = document.createElement('div');
    row.className = 'messageRow assistantRow';
    let bodyHtml = `<div class="directAnswer">${data.summary}</div>`;
    if (data.steps && data.steps.length > 0) {
      bodyHtml += `
        <div class="sectionLabel">PROCEDURE &amp; GUIDANCE:</div>
        <ol class="stepsList">
          ${data.steps.map(s => `<li>${s}</li>`).join('')}
        </ol>
      `;
    }
    if (data.important) {
      bodyHtml += `
        <div class="importantBox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div><strong>IMPORTANT:</strong> ${escapeHtml(data.important)}</div>
        </div>
      `;
    }
    if (data.portal) {
      bodyHtml += `
        <a href="${data.portal.url}" target="_blank" rel="noopener noreferrer" class="portalLink">
          <div class="portalInfo">
            <span class="portalName">${escapeHtml(data.portal.title)}</span>
            <span class="portalDomain">${escapeHtml(data.portal.domain)} &nearr;</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      `;
    }
    if (data.source) {
      bodyHtml += `
        <div class="sourceTag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span><strong>SOURCE:</strong> ${escapeHtml(data.source)}</span>
        </div>
      `;
    }

    let citationsHtml = '';
    if (Array.isArray(data.citations) && data.citations.length > 0) {
      const citCards = data.citations.map(cit => {
        const doc = cit.document || cit.source_document || 'Official DoJ Document';
        const page = (cit.page_range || cit.page_number_or_range) ? ` (Section/Page: ${cit.page_range || cit.page_number_or_range})` : '';
        const url = cit.source_url || '#';
        const chunkId = cit.chunk_id ? `<span class="citationChunkId">${escapeHtml(cit.chunk_id)}</span>` : '';
        const dateBadge = cit.data_as_of ? `<span class="citationDateBadge">Official metric as of ${escapeHtml(cit.data_as_of)}</span>` : '';
        const link = (url && url !== '#')
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="citationLink">Verify on Official Portal &nearr;</a>`
          : '';

        return `
          <div class="citationCard">
            <div class="citationCardTop">
              <span class="citationDocTitle">${escapeHtml(doc)}${escapeHtml(page)}</span>
              ${dateBadge}
            </div>
            <div class="citationCardBottom">
              ${chunkId}
              ${link}
            </div>
          </div>
        `;
      }).join('');

      citationsHtml = `
        <div class="citationsContainer">
          <div class="citationsHeader">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Verified Legal Citations &amp; Statutory References</span>
          </div>
          <div class="citationsGrid">${citCards}</div>
        </div>
      `;
    }

    let followUpsHtml = '';
    if (data.followUps && data.followUps.length > 0) {
      const chips = data.followUps.map(q => `
        <button type="button" class="chipBtn" query="${escapeHtml(q)}">${escapeHtml(q)}</button>
      `).join('');
      followUpsHtml = `
        <div class="followupsWrap">
          <div class="followupsLabel">RELATED QUESTIONS</div>
          <div class="chipsWrap">${chips}</div>
        </div>
      `;
    }
    const utilitiesHtml = `
      <div class="utilitiesBar">
        <button type="button" class="utilBtn btnCopy" title="Copy answer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
        <button type="button" class="utilBtn btnListen" title="Read response aloud">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <span>Listen</span>
        </button>
        <button type="button" class="utilBtn btnHelpful" title="Mark response as helpful">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
          </svg>
          <span>Helpful</span>
        </button>
      </div>
    `;
    row.innerHTML = `
      <div class="assistantCard">
        <div class="cardHeader">
          <span class="officialBadge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Official Guidance
          </span>
          <span class="timestamp">${getFormattedTime()}</span>
        </div>
        ${bodyHtml}
        ${citationsHtml}
        ${followUpsHtml}
        ${utilitiesHtml}
      </div>
    `;
    dom.chatStream.appendChild(row);
    bindUtilityEvents(row, data);
    scrollChatBottom();
  }
  function bindUtilityEvents(rowElement, responseData) {
    const copyBtn = rowElement.querySelector('.btnCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const plainText = stripHtml(responseData.summary + ' ' + (responseData.steps ? responseData.steps.join(' ') : ''));
        navigator.clipboard.writeText(plainText).then(() => {
          UIInteractions.showToast('Official guidance copied to clipboard');
        }).catch(() => {
          UIInteractions.showToast('Copied to clipboard');
        });
      });
    }
    const listenBtn = rowElement.querySelector('.btnListen');
    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        if (!('speechSynthesis' in window)) {
          UIInteractions.showToast('Audio playback not supported in this browser');
          return;
        }
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          listenBtn.classList.remove('active');
          return;
        }
        const speakText = stripHtml(responseData.summary + '. ' + (responseData.steps ? responseData.steps.join('. ') : ''));
        activeUtterance = new SpeechSynthesisUtterance(speakText);
        activeUtterance.lang = 'en-IN';
        activeUtterance.rate = 0.95;
        listenBtn.classList.add('active');
        activeUtterance.onend = () => listenBtn.classList.remove('active');
        activeUtterance.onerror = () => listenBtn.classList.remove('active');
        window.speechSynthesis.speak(activeUtterance);
        UIInteractions.showToast('Reading guidance aloud...');
      });
    }
    const helpfulBtn = rowElement.querySelector('.btnHelpful');
    if (helpfulBtn) {
      helpfulBtn.addEventListener('click', () => {
        helpfulBtn.classList.toggle('active');
        UIInteractions.showToast('Thank you for your feedback');
      });
    }
  }
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  function scrollChatBottom() {
    if (dom.chatViewport) {
      dom.chatViewport.scrollTo({
        top: dom.chatViewport.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
  async function handleUserQuery(query) {
    if (!query || !query.trim() || isAwaitingResponse) return;
    const cleanQuery = query.trim();
    isAwaitingResponse = true;
    renderUserMessage(cleanQuery);
    if (dom.chatInput) {
      dom.chatInput.value = '';
      dom.chatInput.style.height = 'auto';
    }
    if (dom.typingIndicator) {
      dom.typingIndicator.style.display = 'flex';
      scrollChatBottom();
    }

    try {
      const baseUrl = window.AuthManager ? window.AuthManager.getBaseUrl() : '';
      const headers = window.AuthManager ? window.AuthManager.getAuthHeaders() : {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      const payload = {
        message: cleanQuery,
        language: 'en',
        top_k: 3,
      };
      if (activeConversationId) {
        payload.conversationId = activeConversationId;
      }

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Service returned status ${res.status}`);
      }

      const resBody = await res.json();
      if (resBody.status === 'success' && resBody.data) {
        if (resBody.data.conversationId) {
          activeConversationId = resBody.data.conversationId;
        }
        if (resBody.guestToken && window.AuthManager) {
          localStorage.setItem('nyaya_guest_token', resBody.guestToken);
          window.AuthManager.checkExistingSession();
        }
        if (window.ConversationManager) {
          window.ConversationManager.fetchConversations();
        }

        if (dom.typingIndicator) dom.typingIndicator.style.display = 'none';
        renderAssistantResponse(resBody.data);
      } else {
        throw new Error(resBody.message || 'Malformed response from AI service');
      }
    } catch (err) {
      console.warn('Live API request failed, falling back to cached knowledge base:', err.message);
      if (dom.typingIndicator) dom.typingIndicator.style.display = 'none';

      // Graceful offline fallback using validated cached knowledge base
      const localMatch = findBestKnowledgeMatch(cleanQuery);
      const enhancedFallback = {
        ...localMatch,
        important: `Notice (Offline Mode): Connected to local knowledge cache (${err.message}). ${localMatch.important || ''}`,
      };
      renderAssistantResponse(enhancedFallback);
    } finally {
      isAwaitingResponse = false;
      scrollChatBottom();
    }
  }
  function resetToNewConversation() {
    activeConversationId = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (dom.chatStream) {
      dom.chatStream.innerHTML = '';
      dom.chatStream.style.display = 'none';
    }
    if (dom.emptyState) {
      dom.emptyState.style.display = 'block';
    }
    if (dom.typingIndicator) {
      dom.typingIndicator.style.display = 'none';
    }
    if (dom.chatInput) {
      dom.chatInput.value = '';
      dom.chatInput.focus();
    }
    isAwaitingResponse = false;
    UIInteractions.showToast('Started a new conversation');
  }
  function setupChatEventListeners() {
    if (dom.chatForm) {
      dom.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (dom.chatInput) handleUserQuery(dom.chatInput.value);
      });
    }
    if (dom.chatInput) {
      dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleUserQuery(dom.chatInput.value);
        }
      });
      dom.chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }
    if (dom.newChatBtn) {
      dom.newChatBtn.addEventListener('click', resetToNewConversation);
    }
    document.querySelectorAll('.suggestedBtn').forEach(btn => {
      btn.addEventListener('click', function () {
        const query = this.getAttribute('query');
        if (query) {
          scrollToChatbot();
          handleUserQuery(query);
        }
      });
    });
    document.querySelectorAll('.serviceTile').forEach(tile => {
      tile.addEventListener('click', function () {
        const query = this.getAttribute('query');
        if (query) {
          scrollToChatbot();
          handleUserQuery(query);
        }
      });
    });
    if (dom.chatStream) {
      dom.chatStream.addEventListener('click', (e) => {
        const chip = e.target.closest('.chipBtn');
        if (chip) {
          const query = chip.getAttribute('query');
          if (query) handleUserQuery(query);
        }
      });
    }
    if (dom.heroSearchBtn && dom.heroInput) {
      dom.heroSearchBtn.addEventListener('click', () => {
        if (dom.heroInput.value.trim()) {
          const q = dom.heroInput.value.trim();
          dom.heroInput.value = '';
          scrollToChatbot();
          handleUserQuery(q);
        }
      });
      dom.heroInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (dom.heroInput.value.trim()) {
            const q = dom.heroInput.value.trim();
            dom.heroInput.value = '';
            scrollToChatbot();
            handleUserQuery(q);
          }
        }
      });
    }
    UIInteractions.setupSpeechRecognition((spokenText) => {
      if (dom.chatInput) {
        dom.chatInput.value = spokenText;
        handleUserQuery(spokenText);
      }
    });

    // Guest & Auth navigation listeners
    const guestTriggers = ['#navGuestBtn', '#mobileGuestBtn', '#heroGuestBtn', '#footerGuestLink'];
    guestTriggers.forEach(sel => {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.addEventListener('click', async () => {
          scrollToChatbot();
          if (dom.chatInput) dom.chatInput.focus();
          if (window.AuthManager && window.AuthManager.getState().sessionType === 'none') {
            try {
              await window.AuthManager.startGuestSession();
            } catch (err) {
              console.warn('Guest initialization deferred to first chat message:', err);
            }
          } else {
            UIInteractions.showToast('Citizen Guest Mode active — ask your judicial query below.');
          }
        });
      }
    });

    const loginTriggers = ['#navLoginBtn', '#mobileLoginBtn', '#heroLoginBtn'];
    loginTriggers.forEach(sel => {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.addEventListener('click', () => {
          if (window.AuthModal && typeof window.AuthModal.open === 'function') {
            window.AuthModal.open('signin');
          } else {
            UIInteractions.showToast('Citizen Sign In / Registration initialized');
          }
        });
      }
    });
  }
  function scrollToChatbot() {
    const el = document.getElementById('chatbot');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  window.renderAssistantResponse = renderAssistantResponse;
  window.resetToNewConversation = resetToNewConversation;
  Object.defineProperty(window, 'activeConversationId', {
    get: () => activeConversationId,
    set: (val) => { activeConversationId = val; },
  });

  document.addEventListener('DOMContentLoaded', () => {
    UIInteractions.setupMobileMenu();
    UIInteractions.setupSmoothScroll();
    setupChatEventListeners();
  });
})();
