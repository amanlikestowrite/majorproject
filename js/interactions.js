const UIInteractions = (function () {
  'use strict';
  let isListening = false;
  let recognitionInstance = null;
  function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('active');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('active');
    }, 2800);
  }
  function setupSpeechRecognition(onResultCallback) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = document.getElementById('micBtn');
    if (!micBtn) return;
    if (!SpeechRec) {
      micBtn.style.opacity = '0.4';
      micBtn.title = 'Speech recognition not supported in this browser';
      return;
    }
    recognitionInstance = new SpeechRec();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-IN';
    recognitionInstance.onstart = () => {
      isListening = true;
      micBtn.classList.add('recording');
      showToast('Listening... Speak now');
    };
    recognitionInstance.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (onResultCallback) {
        onResultCallback(text);
      }
    };
    recognitionInstance.onerror = () => {
      micBtn.classList.remove('recording');
      isListening = false;
      showToast('Voice input unavailable or permission denied');
    };
    recognitionInstance.onend = () => {
      micBtn.classList.remove('recording');
      isListening = false;
    };
    micBtn.addEventListener('click', () => {
      if (!isListening) {
        try {
          recognitionInstance.start();
        } catch (err) {
          console.warn(err);
        }
      } else {
        recognitionInstance.stop();
        micBtn.classList.remove('recording');
        isListening = false;
      }
    });
  }
  function setupMobileMenu() {
    const toggleBtn = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if (!toggleBtn || !navLinks) return;
    toggleBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('mobileOpen');
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobileOpen');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
  return {
    showToast,
    setupSpeechRecognition,
    setupMobileMenu,
    setupSmoothScroll
  };
})();
