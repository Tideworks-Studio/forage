// content.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltvkoanqbeiirvyicbjn.supabase.co';
const supabaseKey = 'sb_publishable_ywskaxwK_8IEzW4eUQKtUA_isbNrKUS';
const supabase = createClient(supabaseUrl, supabaseKey);

// Listen for the custom event from background.js
window.addEventListener('forageSaveImage', e => {
  const { imageUrl, pageUrl } = e.detail;
  openForageModal(imageUrl, pageUrl);
});

function openForageModal(imageUrl, pageUrl) {
  // Remove existing modal if present
  const existing = document.getElementById('forage-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'forage-modal';
  modal.innerHTML = `
    <div class="overlay-backdrop open">
      <div id="upload-modal">
        <div id="step2" class="visible">
          <div id="step2-inner">
            <div id="preview-col">
              <img src="${imageUrl}" />
            </div>
            <div id="form-col">
              <label class="form-label">Notes</label>
              <textarea id="notesField" placeholder="Add notes (optional)"></textarea>
              <label class="form-label">Tags (comma-separated)</label>
              <input id="tagsField" placeholder="e.g. inspiration, design" />
            </div>
          </div>
          <div id="step2-footer">
            <button id="saveButton" class="btn-upload">Save Image</button>
            <button id="cancelButton" class="btn-upload" style="background:#888; margin-top:6px;">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Cancel button closes modal
  modal.querySelector('#cancelButton').onclick = () => modal.remove();

  // Save button inserts into Supabase
  modal.querySelector('#saveButton').onclick = async () => {
    const notes = modal.querySelector('#notesField').value.trim();
    const tags = modal.querySelector('#tagsField').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean) || ['Unlabeled'];
    try {
      const { error } = await supabase.from('images').insert([
        { url: imageUrl, source_url: pageUrl, tags, notes }
      ]);
      if (error) throw error;
      alert('Image saved!');
      modal.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to save image: ' + err.message);
    }
  };
}