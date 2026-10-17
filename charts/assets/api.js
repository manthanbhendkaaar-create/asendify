/* Chart Reader: API helper shared by /paid/, /login/ and /app/. Sessions are long random tokens kept in this browser only. */
(function () {
  'use strict';
  var H = location.hostname, Q = new URLSearchParams(location.search);
  var PREVIEW = /\.vercel\.app$/.test(H) || /^(localhost|127\.0\.0\.1)$/.test(H);
  var ov = PREVIEW && /^https?:\/\/([a-z0-9-]+\.vercel\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/.test(Q.get('api') || '') ? Q.get('api') : '';
  try { if (ov) sessionStorage.setItem('cr_api', ov); else if (PREVIEW) ov = sessionStorage.getItem('cr_api') || ''; } catch (e) {}
  var API = (PREVIEW ? (ov || 'https://ironclad-git-automate-charts-manthan-s-projects23.vercel.app') : 'https://playbook.asendify.co') + '/api/config?cr=';
  function api(op, body) {
    return fetch(API + op, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: PREVIEW ? 'include' : 'omit', body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); })
      .catch(function () { return { _status: 0, error: 'We could not reach the server. Please check your connection and try again.' }; });
  }
  function getS() { try { return localStorage.getItem('cr_s') || ''; } catch (e) { return ''; } }
  function setS(s) { try { if (s) localStorage.setItem('cr_s', s); else localStorage.removeItem('cr_s'); } catch (e) {} }
  window.CR = { API: API, PREVIEW: PREVIEW, api: api, getS: getS, setS: setS };
})();
