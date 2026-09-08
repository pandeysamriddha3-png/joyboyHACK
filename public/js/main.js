// ── JoyBoy Client-Side JavaScript ──

document.addEventListener('DOMContentLoaded', () => {
  // ── Dropdown Menu ──
  const avatarBtn = document.getElementById('avatar-btn');
  const dropdownMenu = document.getElementById('dropdown-menu');

  if (avatarBtn && dropdownMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && !avatarBtn.contains(e.target)) {
        dropdownMenu.classList.remove('open');
      }
    });
  }

  // ── Flash Messages Auto-dismiss ──
  const flashMessage = document.getElementById('flash-message');
  if (flashMessage) {
    setTimeout(() => {
      flashMessage.style.opacity = '0';
      flashMessage.style.transform = 'translateY(-20px)';
      setTimeout(() => flashMessage.remove(), 300);
    }, 4000);
  }

  // ── File Upload: Drag & Drop + Preview ──
  const dropZone = document.getElementById('drop-zone');
  const videoInput = document.getElementById('video-input');
  const filePreview = document.getElementById('file-preview');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const fileRemove = document.getElementById('file-remove');

  if (dropZone && videoInput) {
    // Click to browse
    dropZone.addEventListener('click', () => videoInput.click());

    // Drag events
    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        videoInput.files = files;
        showFilePreview(files[0]);
      }
    });

    videoInput.addEventListener('change', () => {
      if (videoInput.files.length > 0) {
        showFilePreview(videoInput.files[0]);
      }
    });

    if (fileRemove) {
      fileRemove.addEventListener('click', () => {
        videoInput.value = '';
        filePreview.style.display = 'none';
        dropZone.style.display = '';
      });
    }
  }

  function showFilePreview(file) {
    if (!filePreview || !fileName || !fileSize) return;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    filePreview.style.display = 'flex';
    dropZone.style.display = 'none';

    // Auto-fill title if empty
    const titleInput = document.getElementById('title');
    if (titleInput && !titleInput.value) {
      // Remove extension and clean up
      let name = file.name.replace(/\.[^/.]+$/, '');
      name = name.replace(/[-_]/g, ' ');
      name = name.replace(/\b\w/g, l => l.toUpperCase());
      titleInput.value = name;
    }
  }

  // ── Upload Form with Progress ──
  const uploadForm = document.getElementById('upload-form');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const btnUploadSubmit = document.getElementById('btn-upload-submit');

  if (uploadForm && progressContainer) {
    uploadForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const formData = new FormData(this);
      const xhr = new XMLHttpRequest();

      // Show progress
      progressContainer.style.display = 'flex';
      if (btnUploadSubmit) {
        btnUploadSubmit.disabled = true;
        btnUploadSubmit.textContent = 'Uploading...';
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = percent + '%';
          progressText.textContent = percent + '%';
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 400) {
          // Follow redirect
          progressText.textContent = 'Processing...';
          window.location.href = xhr.responseURL;
        } else {
          progressText.textContent = 'Upload failed';
          if (btnUploadSubmit) {
            btnUploadSubmit.disabled = false;
            btnUploadSubmit.textContent = 'Upload Video';
          }
        }
      });

      xhr.addEventListener('error', () => {
        progressText.textContent = 'Upload failed';
        if (btnUploadSubmit) {
          btnUploadSubmit.disabled = false;
          btnUploadSubmit.textContent = 'Upload Video';
        }
      });

      xhr.open('POST', '/videos/upload');
      xhr.send(formData);
    });
  }

  // ── Avatar Preview on Edit Profile ──
  const avatarInput = document.getElementById('avatar');
  const avatarPreview = document.getElementById('avatar-preview');

  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (avatarPreview.tagName === 'IMG') {
            avatarPreview.src = e.target.result;
          } else {
            // Replace default avatar div with img
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'avatar-upload-img';
            img.id = 'avatar-preview';
            avatarPreview.parentNode.replaceChild(img, avatarPreview);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ── Navbar scroll effect ──
  const navbar = document.getElementById('main-nav');
  if (navbar) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    });
  }

  // ── Mobile Search Experience & Recent Searches History ──
  const mobileSearchBtn = document.getElementById('mobile-search-btn');
  const mobileSearchOverlay = document.getElementById('mobile-search-overlay');
  const mobileSearchBackBtn = document.getElementById('mobile-search-back-btn');
  const mobileSearchForm = document.getElementById('mobile-search-form');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const mobileSearchClearBtn = document.getElementById('mobile-search-clear-btn');
  const mobileRecentSearches = document.getElementById('mobile-recent-searches');
  const recentSearchesList = document.getElementById('recent-searches-list');
  const recentClearAllBtn = document.getElementById('recent-clear-all-btn');

  const STORAGE_KEY = 'joyboy_recent_searches';
  const MAX_RECENT_SEARCHES = 8;

  function getRecentSearches() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecentSearch(query) {
    if (!query || !query.trim()) return;
    const trimmed = query.trim();
    let searches = getRecentSearches();
    // Remove if already exists to bump to top (newest first)
    searches = searches.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
    searches.unshift(trimmed);
    if (searches.length > MAX_RECENT_SEARCHES) {
      searches = searches.slice(0, MAX_RECENT_SEARCHES);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (e) {}
  }

  function removeRecentSearch(query) {
    let searches = getRecentSearches();
    searches = searches.filter(item => item !== query);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (e) {}
    renderRecentSearches();
  }

  function clearAllRecentSearches() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    renderRecentSearches();
  }

  function renderRecentSearches() {
    if (!mobileRecentSearches || !recentSearchesList) return;
    const searches = getRecentSearches();
    if (!searches || searches.length === 0) {
      mobileRecentSearches.style.display = 'none';
      recentSearchesList.innerHTML = '';
      return;
    }

    mobileRecentSearches.style.display = 'flex';
    recentSearchesList.innerHTML = '';

    searches.forEach(query => {
      const li = document.createElement('li');
      li.className = 'recent-search-item';

      const queryBtn = document.createElement('button');
      queryBtn.type = 'button';
      queryBtn.className = 'recent-search-query-btn';
      queryBtn.innerHTML = `
        <svg class="recent-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="recent-search-text"></span>
      `;
      queryBtn.querySelector('.recent-search-text').textContent = query;
      queryBtn.addEventListener('click', () => {
        saveRecentSearch(query);
        if (mobileSearchInput) mobileSearchInput.value = query;
        if (mobileSearchForm) mobileSearchForm.submit();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'recent-search-remove-btn';
      removeBtn.setAttribute('aria-label', `Remove "${query}" from history`);
      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      `;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeRecentSearch(query);
      });

      li.appendChild(queryBtn);
      li.appendChild(removeBtn);
      recentSearchesList.appendChild(li);
    });
  }

  function updateClearBtnState() {
    if (!mobileSearchInput || !mobileSearchClearBtn) return;
    if (mobileSearchInput.value.length > 0) {
      mobileSearchClearBtn.classList.add('visible');
    } else {
      mobileSearchClearBtn.classList.remove('visible');
    }
  }

  function openMobileSearch(pushState = true) {
    if (!mobileSearchOverlay) return;
    mobileSearchOverlay.classList.add('open');
    mobileSearchOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('search-overlay-open');
    renderRecentSearches();
    updateClearBtnState();

    if (pushState) {
      history.pushState({ joyboyMobileSearch: true }, '');
    }

    setTimeout(() => {
      if (mobileSearchInput) {
        mobileSearchInput.focus();
        if (mobileSearchInput.value) {
          mobileSearchInput.select();
        }
      }
    }, 50);
  }

  function closeMobileSearch(popHistory = false) {
    if (!mobileSearchOverlay) return;
    mobileSearchOverlay.classList.remove('open');
    mobileSearchOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('search-overlay-open');

    if (popHistory && history.state && history.state.joyboyMobileSearch) {
      history.back();
    }
  }

  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener('click', () => {
      openMobileSearch(true);
    });
  }

  if (mobileSearchBackBtn) {
    mobileSearchBackBtn.addEventListener('click', () => {
      if (history.state && history.state.joyboyMobileSearch) {
        history.back();
      } else {
        closeMobileSearch(false);
      }
    });
  }

  window.addEventListener('popstate', (e) => {
    if (mobileSearchOverlay && mobileSearchOverlay.classList.contains('open')) {
      if (!e.state || !e.state.joyboyMobileSearch) {
        closeMobileSearch(false);
      }
    }
  });

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', updateClearBtnState);
  }

  if (mobileSearchClearBtn) {
    mobileSearchClearBtn.addEventListener('click', () => {
      if (mobileSearchInput) {
        mobileSearchInput.value = '';
        updateClearBtnState();
        mobileSearchInput.focus();
      }
    });
  }

  if (recentClearAllBtn) {
    recentClearAllBtn.addEventListener('click', clearAllRecentSearches);
  }

  if (mobileSearchForm) {
    mobileSearchForm.addEventListener('submit', () => {
      if (mobileSearchInput && mobileSearchInput.value.trim()) {
        saveRecentSearch(mobileSearchInput.value.trim());
      }
    });
  }

  // Save query to localStorage when desktop search is used
  const desktopSearchForm = document.getElementById('search-form');
  const desktopSearchInput = document.getElementById('search-input');
  if (desktopSearchForm && desktopSearchInput) {
    desktopSearchForm.addEventListener('submit', () => {
      if (desktopSearchInput.value.trim()) {
        saveRecentSearch(desktopSearchInput.value.trim());
      }
    });
  }
});

// ── Utility ──
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}
