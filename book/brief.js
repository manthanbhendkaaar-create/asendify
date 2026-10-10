// Step 1 of booking: the channel form. The answers go to the "strategy" function, which builds the client's
// tailored YouTube strategy PDF for the call. Then the usual booking gate (outside India / in India) appears,
// with the name and email carried over to the calendar.
(function () {
  var FN = "https://pnokotvssodslxozepxe.supabase.co/functions/v1/strategy";
  var form = document.getElementById("bookBrief");
  if (!form) return;
  var gate = document.getElementById("bookGate"), msg = document.getElementById("bfMsg"), go = document.getElementById("bfGo");
  var fails = 0;
  var head = form.parentNode.querySelector("h3"), headText = head ? head.textContent : "";
  if (head) head.textContent = "About your channel:";
  gate.hidden = true;
  function say(t, bad) { msg.textContent = t; msg.style.color = bad ? "#b91c1c" : ""; }
  function next(d) {
    window.ASD_BRIEF = { name: d.name, email: d.email };
    var n = document.getElementById("bmName"), e = document.getElementById("bmEmail");
    if (n && !n.value) n.value = d.name;
    if (e && !e.value) e.value = d.email;
    form.hidden = true; gate.hidden = false;
    if (head) head.textContent = headText;
    gate.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var bad = Array.prototype.find.call(form.querySelectorAll("[required]"), function (el) {
      return !el.value.trim() || (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()));
    });
    if (bad) { say("Please fill in: " + bad.closest("label").childNodes[0].textContent.trim(), true); bad.focus(); return; }
    var d = {};
    new FormData(form).forEach(function (v, k) { v = String(v).trim(); if (v) d[k] = v; });
    var hp = d.hp; delete d.hp;
    go.disabled = true; say("Saving your answers…");
    fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", brand: "asendify", form: d, hp: hp || "" }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        go.disabled = false;
        if (r && r.ok) { say(""); return next(d); }
        say((r && r.error) || "Something went wrong. Please try again.", true);
      })
      .catch(function () {
        go.disabled = false; fails++;
        if (fails >= 2) { say(""); return next(d); }          // don't block booking on a network problem
        say("Network error. Please try again.", true);
      });
  });
})();
