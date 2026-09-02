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
});

// ── Utility ──
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}
