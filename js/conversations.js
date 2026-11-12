/**
 * Nyaya Sahayak — Conversation History & Thread Manager
 * Interacts with Express /api/conversations endpoints.
 * Handles listing, switching, and deleting conversation threads.
 */

const ConversationManager = (function () {
  'use strict';

  let conversations = [];
  let isLoading = false;
  let isSidebarOpen = true;

  function getBaseUrl() {
    return window.AuthManager ? window.AuthManager.getBaseUrl() : '';
  }

  function getHeaders() {
    return window.AuthManager ? window.AuthManager.getAuthHeaders() : {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async function fetchConversations() {
    const listEl = document.getElementById('conversationList');
    if (!listEl) return [];

    isLoading = true;
    listEl.innerHTML = `
      <div class="convLoadingState">
        <div class="convSpinner"></div>
        <span>Loading inquiries...</span>
      </div>
    `;

    try {
      const res = await fetch(`${getBaseUrl()}/api/conversations`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        // If unauthorized, user has no session yet
        if (res.status === 401 || res.status === 403) {
          renderEmptyState('Start an inquiry or sign in to save your history.');
          conversations = [];
          return [];
        }
        throw new Error(`Failed to load conversations (${res.status})`);
      }

      const body = await res.json();
      conversations = (body.status === 'success' && Array.isArray(body.data)) ? body.data : [];
      renderConversationList(conversations);
      return conversations;
    } catch (err) {
      console.warn('Failed to load conversation history:', err.message);
      renderEmptyState('Inquiry history unavailable offline.');
      return [];
    } finally {
      isLoading = false;
    }
  }

  function renderEmptyState(message = 'No saved inquiries yet.') {
    const listEl = document.getElementById('conversationList');
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="convEmptyState">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function renderConversationList(items) {
    const listEl = document.getElementById('conversationList');
    if (!listEl) return;

    if (!items || items.length === 0) {
      renderEmptyState('No past inquiries found. Inquiries you submit will appear here.');
      return;
    }

    const currentId = window.activeConversationId || null;
    listEl.innerHTML = items.map(c => {
      const isActive = c.id === currentId;
      const title = c.title || 'Legal Inquiry';
      const dateStr = formatRelativeDate(c.updatedAt || c.createdAt);
      return `
        <div class="convItem ${isActive ? 'active' : ''}" data-id="${escapeHtml(c.id)}">
          <div class="convItemContent" onclick="ConversationManager.loadConversation('${escapeHtml(c.id)}')">
            <span class="convItemTitle" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
            <span class="convItemDate">${escapeHtml(dateStr)}</span>
          </div>
          <button type="button" class="convDeleteBtn" onclick="ConversationManager.deleteConversation('${escapeHtml(c.id)}', event)" title="Delete inquiry">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  }

  async function loadConversation(id) {
    if (!id) return;
    try {
      const res = await fetch(`${getBaseUrl()}/api/conversations/${id}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Unable to load requested inquiry.');
      }

      const body = await res.json();
      if (body.status === 'success' && body.data) {
        window.activeConversationId = body.data.id;
        renderLoadedMessages(body.data.messages || []);
        renderConversationList(conversations);
        if (window.innerWidth < 768) {
          toggleSidebar(false);
        }
      }
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Failed to open inquiry');
      }
    }
  }

  function renderLoadedMessages(messages) {
    const stream = document.getElementById('chatStream');
    const empty = document.getElementById('emptyState');
    if (!stream) return;

    if (empty) empty.style.display = 'none';
    stream.style.display = 'flex';
    stream.innerHTML = '';

    messages.forEach(msg => {
      if (msg.role === 'user') {
        const row = document.createElement('div');
        row.className = 'messageRow userRow';
        row.innerHTML = `<div class="userBubble">${escapeHtml(msg.content)}</div>`;
        stream.appendChild(row);
      } else if (msg.role === 'assistant') {
        const data = msg.structuredResponse || {
          summary: msg.content,
          citations: (msg.citations || []).map(c => ({
            chunk_id: c.chunkId,
            document: c.sourceDocument,
            source_url: c.sourceUrl,
          })),
        };
        if (window.renderAssistantResponse) {
          window.renderAssistantResponse(data);
        }
      }
    });

    const viewport = document.getElementById('chatViewport');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }

  async function deleteConversation(id, event) {
    if (event) event.stopPropagation();
    if (!id) return;

    if (!confirm('Are you sure you want to delete this inquiry from your history?')) {
      return;
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/conversations/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Could not delete inquiry.');
      }

      conversations = conversations.filter(c => c.id !== id);
      renderConversationList(conversations);

      if (window.activeConversationId === id) {
        if (window.resetToNewConversation) {
          window.resetToNewConversation();
        }
      }

      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast('Inquiry deleted from history');
      }
    } catch (err) {
      if (window.UIInteractions && window.UIInteractions.showToast) {
        window.UIInteractions.showToast(err.message || 'Delete failed');
      }
    }
  }

  function toggleSidebar(forceState) {
    const sidebar = document.getElementById('chatSidebar');
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    if (!sidebar) return;

    if (typeof forceState === 'boolean') {
      isSidebarOpen = forceState;
    } else {
      isSidebarOpen = !isSidebarOpen;
    }

    if (isSidebarOpen) {
      sidebar.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.classList.add('active');
      fetchConversations();
    } else {
      sidebar.classList.add('collapsed');
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  }

  function formatRelativeDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
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

  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    const sidebarNewBtn = document.getElementById('sidebarNewChatBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => toggleSidebar());
    }
    if (sidebarNewBtn) {
      sidebarNewBtn.addEventListener('click', () => {
        if (window.resetToNewConversation) window.resetToNewConversation();
        if (window.innerWidth < 768) toggleSidebar(false);
      });
    }

    // Default collapse on small screens
    if (window.innerWidth < 768) {
      toggleSidebar(false);
    } else {
      fetchConversations();
    }
  });

  return {
    fetchConversations,
    loadConversation,
    deleteConversation,
    toggleSidebar,
  };
})();

window.ConversationManager = ConversationManager;

