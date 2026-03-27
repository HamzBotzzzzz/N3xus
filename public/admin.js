async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const statusDiv = document.getElementById('status');

    if (data.connected) {
      statusDiv.innerHTML = `
        <p><span class="dot dot--on"></span> Connected as ${data.phone}</p>
        <button id="quickResetBtn" style="background-color: #dc3545; margin-top: 5px; padding: 5px 10px; font-size: 0.9rem;">
          🔄 Reset Connection
        </button>
      `;
      document.getElementById('quickResetBtn')?.addEventListener('click', async () => {
        if (confirm('Reset current connection?')) {
          const resetRes = await fetch('/api/reset', { method: 'POST' });
          const resetData = await resetRes.json();
          if (resetData.success) {
            alert('Reset successful!');
            checkStatus();
          } else {
            alert('Reset failed: ' + resetData.message);
          }
        }
      });
    } else {
      statusDiv.innerHTML = `<p><span class="dot dot--off"></span> Not connected. Please pair first.</p>`;
    }
  } catch (err) {
    console.error('Status check error:', err);
    document.getElementById('status').innerHTML = `<p><span class="dot dot--off"></span> Error checking status</p>`;
  }
}

document.getElementById('resetBtn')?.addEventListener('click', async () => {
  if (confirm('⚠️ WARNING: This will reset your current pairing. You will need to pair again. Continue?')) {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('✅ Pairing data has been reset! You can now pair again.');
        document.getElementById('pairCode').innerHTML = '';
        document.getElementById('pair-phone').value = '';
        checkStatus();
      } else {
        alert('❌ Reset failed: ' + data.message);
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  }
});

document.querySelectorAll('.word').forEach(el => {
  const text = el.dataset.text;
  el.innerHTML = [...text]
    .map((ch, i) => `<span style="--i:${i}">${ch}</span>`)
    .join('');
});

document.getElementById('pairBtn')?.addEventListener('click', async () => {
  const phone = document.getElementById('pair-phone').value;
  if (!phone) {
    alert('Please enter phone number');
    return;
  }

  const pairBtn = document.getElementById('pairBtn');
  pairBtn.disabled = true;
  pairBtn.textContent = 'Processing...';

  try {
    const res = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('pairCode').innerHTML = `
        <p>✅ Pairing code: <strong>${data.code}</strong><br>
        Enter this code in WhatsApp on the target device within 5 minutes.</p>
      `;
      checkStatus();
    } else {
      alert('Pairing failed: ' + data.message);
      document.getElementById('pairCode').innerHTML = `
        <p style="color: red;">❌ Pairing failed: ${data.message}<br>
        Click "Reset Pairing" to try again.</p>
      `;
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    pairBtn.disabled = false;
    pairBtn.textContent = 'Pair Device';
  }
});

document.getElementById('sendBtn')?.addEventListener('click', async () => {
  const target = document.getElementById('target').value;
  const bugType = document.getElementById('bug-type').value;

  if (!target) {
    alert('Please enter target number');
    return;
  }

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: target, bugType })
    });
    const data = await res.json();

    if (data.success) {
      alert(`✅ ${bugType} sent successfully to ${target}!`);
    } else {
      alert('❌ Failed: ' + data.message);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '▶ SEND BUG';
  }
});

checkStatus();
