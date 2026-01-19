const fileInput = document.getElementById('file-input');
const fileLabel = document.querySelector('.file-label');
const fileName = document.getElementById('file-name');
const convertBtn = document.getElementById('convert-btn');
const uploadSection = document.getElementById('upload-section');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const statusText = document.getElementById('status-text');
const resultSection = document.getElementById('result-section');
const downloadLink = document.getElementById('download-link');
const errorSection = document.getElementById('error-section');
const errorText = document.getElementById('error-text');
const retryBtn = document.getElementById('retry-btn');
const cancelBtn = document.getElementById('cancel-btn');
const convertMoreBtn = document.getElementById('convert-more-btn');

let selectedFile = null;
let currentJobId = null;
let isCancelled = false;

fileInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    fileName.textContent = selectedFile.name;
    fileLabel.classList.add('has-file');
    convertBtn.disabled = false;
  } else {
    fileName.textContent = 'Choose a video file';
    fileLabel.classList.remove('has-file');
    convertBtn.disabled = true;
  }
});

convertBtn.addEventListener('click', () => {
  if (selectedFile) {
    startConversion(selectedFile);
  }
});

retryBtn.addEventListener('click', reset);
cancelBtn.addEventListener('click', cancelConversion);
convertMoreBtn.addEventListener('click', reset);

function reset() {
  selectedFile = null;
  currentJobId = null;
  isCancelled = false;
  fileInput.value = '';
  fileName.textContent = 'Choose a video file';
  fileLabel.classList.remove('has-file');
  convertBtn.disabled = true;
  progressFill.style.width = '0%';

  uploadSection.hidden = false;
  progressSection.hidden = true;
  resultSection.hidden = true;
  errorSection.hidden = true;
}

async function cancelConversion() {
  isCancelled = true;
  if (currentJobId) {
    try {
      await fetch(`/api/cancel/${currentJobId}`, { method: 'POST' });
    } catch (e) {
      // Ignore errors during cancel
    }
  }
  reset();
}

async function startConversion(file) {
  uploadSection.hidden = true;
  progressSection.hidden = false;
  resultSection.hidden = true;
  errorSection.hidden = true;
  isCancelled = false;

  try {
    // Upload file
    const jobId = await uploadFile(file);
    if (isCancelled) return;

    currentJobId = jobId;

    // Poll for progress
    await pollStatus(jobId);

  } catch (err) {
    if (!isCancelled) {
      showError(err.message || 'An unexpected error occurred');
    }
  }
}

function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        updateProgress(percent / 2, 'Uploading...');
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.jobId);
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('POST', '/api/convert');
    xhr.send(formData);
  });
}

async function pollStatus(jobId) {
  while (true) {
    if (isCancelled) return;

    const response = await fetch(`/api/status/${jobId}`);
    const data = await response.json();

    if (data.status === 'completed') {
      showSuccess(jobId);
      return;
    } else if (data.status === 'error') {
      throw new Error(data.error || 'Conversion failed');
    }

    // Conversion progress is 50-100%
    const progress = 50 + (data.progress / 2);
    updateProgress(progress, `Converting... ${data.progress}%`);

    await new Promise(r => setTimeout(r, 1000));
  }
}

function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  statusText.textContent = text;
}

function showSuccess(jobId) {
  progressSection.hidden = true;
  resultSection.hidden = false;
  downloadLink.href = `/api/download/${jobId}`;
}

function showError(message) {
  progressSection.hidden = true;
  errorSection.hidden = false;
  errorText.textContent = message;
}
