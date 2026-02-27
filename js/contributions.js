(function(){
  const LS_PREFIX = 'xaytheon:contribs:';
  const MAX_RENDER = 100;
  const MAX_LOCAL_ROWS = 500;
  const MAX_RETRIES = 5;
  const BASE_DELAY = 500;
  let isSubmitting = false;

  function lsKey(userId){ return LS_PREFIX + (userId || 'guest'); }

  function lsRead(userId){
    try {
      const raw = localStorage.getItem(lsKey(userId));
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e){
      console.error('Local read error:', e);
      return [];
    }
  }

  function lsWrite(userId, rows){
    try {
      if (rows.length > MAX_LOCAL_ROWS){
        rows = rows.slice(0, MAX_LOCAL_ROWS);
      }
      localStorage.setItem(lsKey(userId), JSON.stringify(rows));
    } catch (e){
      console.error('Local write error:', e);
    }
  }

  function escapeHTML(str){
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function delay(ms){
    return new Promise(res => setTimeout(res, ms));
  }

  async function retryUpsert(client, row){
    let attempt = row._retries || 0;

    while (attempt < MAX_RETRIES){
      try {
        const { error } = await client
          .from('contributions')
          .upsert(row, { onConflict: 'id' });

        if (!error) return true;

        throw error;
      } catch (e){
        attempt++;
        row._retries = attempt;
        const backoff = BASE_DELAY * Math.pow(2, attempt);
        await delay(backoff);
      }
    }
    return false;
  }

  // UPDATED: Reliable client retrieval
  function supa(){
    try {
      return window.XAYTHEON_AUTH?.ensureClient?.() || null;
    } catch (e) {
      console.warn('Supabase client error:', e);
      return null;
    }
  }

  async function getUser(){
    try {
      const s = await window.XAYTHEON_AUTH?.getSession?.();
      return s?.user || null;
    } catch {
      return null;
    }
  }

  async function reconcileLocal(user, client){
    const rows = lsRead(user.id);
    if (!rows.length) return;

    const remaining = [];

    for (const row of rows){
      const success = await retryUpsert(client, row);
      if (!success){
        remaining.push(row);
      }
    }

    lsWrite(user.id, remaining);
  }

  async function saveContribution(e){
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const c = supa();
    const user = await getUser();
    if (!user){
      console.warn('Please sign in to save.');
      isSubmitting = false;
      return;
    }

    const data = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project: document.getElementById('cf-project').value.trim(),
      link: document.getElementById('cf-link').value.trim(),
      program: document.getElementById('cf-program').value.trim(),
      date: document.getElementById('cf-date').value,
      type: document.getElementById('cf-type').value.trim(),
      description: document.getElementById('cf-desc').value.trim(),
      tech: document.getElementById('cf-tech').value.trim(),
      created_at: new Date().toISOString(),
      _retries: 0
    };

    try {
      if (c){
        const { error } = await c
          .from('contributions')
          .upsert(data, { onConflict: 'id' });

        if (error) throw error;

        await reconcileLocal(user, c);
      } else {
        // Local Fallback
        const rows = lsRead(user.id);
        rows.unshift(data);
        lsWrite(user.id, rows);
      }

      document.getElementById('contrib-form')?.reset();
      await listContributions();
    } catch (err){
      console.error('Insert error:', err);

      // Fallback to local if remote fails
      const rows = lsRead(user.id);
      rows.unshift(data);
      lsWrite(user.id, rows);
    } finally {
      isSubmitting = false;
    }
  }

  async function listContributions(){
    const list = document.getElementById('contrib-list');
    const user = await getUser();
    if (!user){
      list.innerHTML = '';
      return;
    }

    let contribs = [];
    const c = supa();

    try {
      if (c){
        const { data, error } = await c
          .from('contributions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending:false })
          .limit(MAX_RENDER);

        if (error) throw error;
        contribs = data || [];
      } else {
        contribs = lsRead(user.id)
          .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
          .slice(0, MAX_RENDER);
      }

      list.innerHTML = contribs.map(r => `
        <div class="repo-item">
          <strong>${escapeHTML(r.project)}</strong> - ${escapeHTML(r.type)}
          <p>${escapeHTML(r.description)}</p>
        </div>
      `).join('');
    } catch (e){
      console.error('List error:', e);
      list.innerHTML = '<p>Failed to load contributions.</p>';
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('contrib-form')?.addEventListener('submit', saveContribution);
    listContributions();
  });

  window.addEventListener('xaytheon:authchange', listContributions);
})();
