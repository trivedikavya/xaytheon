(function(){
  const LS_PREFIX = 'xaytheon:contribs:';
  function lsKey(userId){ return LS_PREFIX + (userId || 'guest'); }
  function lsRead(userId){ try { return JSON.parse(localStorage.getItem(lsKey(userId))||'[]') || []; } catch { return []; } }
  function lsWrite(userId, rows){ try { localStorage.setItem(lsKey(userId), JSON.stringify(rows)); } catch {} }

  // UPDATED: Reliable client retrieval
  function supa(){
    try {
      return window.XAYTHEON_AUTH?.ensureClient();
    } catch (e) {
      console.warn('Supabase client error:', e);
      return null;
    }
  }

  async function getUser(){
    const s = await window.XAYTHEON_AUTH.getSession();
    return s?.user || null;
  }

  async function saveContribution(e){
    e.preventDefault();
    const c = supa();
    const user = await getUser();
    if (!user){ alert('Please sign in to save.'); return; }

    const data = {
      user_id: user.id,
      project: document.getElementById('cf-project').value,
      link: document.getElementById('cf-link').value,
      program: document.getElementById('cf-program').value,
      date: document.getElementById('cf-date').value,
      type: document.getElementById('cf-type').value,
      description: document.getElementById('cf-desc').value,
      tech: document.getElementById('cf-tech').value
    };

    if (c) {
      const { error } = await c.from('contributions').insert(data);
      if (error) console.error('Insert error:', error);
    } else {
      // Local Fallback
      const rows = lsRead(user.id);
      rows.unshift({ id: Date.now().toString(), ...data });
      lsWrite(user.id, rows);
    }

    document.getElementById('contrib-form').reset();
    listContributions();
  }

  async function listContributions(){
    const list = document.getElementById('contrib-list');
    const user = await getUser();
    if (!user){ list.innerHTML = ''; return; }

    let contribs = [];
    const c = supa();
    if (c) {
      const { data } = await c.from('contributions').select('*').eq('user_id', user.id);
      contribs = data || [];
    } else {
      contribs = lsRead(user.id);
    }

    list.innerHTML = contribs.map(r => `
      <div class="repo-item">
        <strong>${r.project}</strong> - ${r.type}
        <p>${r.description}</p>
      </div>
    `).join('');
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('contrib-form')?.addEventListener('submit', saveContribution);
    listContributions();
  });
  window.addEventListener('xaytheon:authchange', listContributions);
})();