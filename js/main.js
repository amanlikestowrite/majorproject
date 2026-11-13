(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (window.UIInteractions) {
      window.UIInteractions.setupMobileMenu();
      window.UIInteractions.setupSmoothScroll();
      window.UIInteractions.setupSpeechRecognition(function (transcribedText) {
        if (window.ChatUI && window.ChatUI.handleDirectQuery) {
          window.ChatUI.handleDirectQuery(transcribedText);
        }
      });
    }

    if (window.AuthUI) {
      window.AuthUI.init();
    }

    if (window.ChatUI) {
      window.ChatUI.init();
    }
  });
})();
