// Step 1 of booking: the channel form. The answers go through the "human-gate" function (2026-10-20: calls are booked by
// people only), which checks the "you're a real person" hold, the honeypot and the time on the form, then saves the answers
// with the "strategy" function (which builds the client's tailored YouTube strategy PDF for the call) and only then returns
// the calendar. Then the usual booking gate (outside India / in India) appears, with the name and email carried over.
(function () {
  var form = document.getElementById("bookBrief");
  if (!form || !window.HumanCheck) return;
  var gate = document.getElementById("bookGate"), msg = document.getElementById("bfMsg"), go = document.getElementById("bfGo");
  var hc = HumanCheck.mount(document.getElementById("bfHuman"), "asendify");
  var fails = 0;
  var head = form.parentNode.querySelector("h3"), headText = head ? head.textContent : "";
  if (head) head.textContent = "About your channel:";
  gate.hidden = true;
  function say(t, bad) { msg.textContent = t; msg.style.color = bad ? "#b91c1c" : ""; }
  function next(d, cal) {
    window.ASD_BRIEF = { name: d.name, email: d.email };
    window.ASD_CAL = cal;
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
    if (!hc.ready()) { say("Please press and hold the button to confirm you're a person.", true); return; }
    var d = {};
    new FormData(form).forEach(function (v, k) { v = String(v).trim(); if (v) d[k] = v; });
    var hp = d.hp; delete d.hp;
    go.disabled = true; say("Saving your answers…");
    hc.submit({ form: d, hp: hp || "" }).then(function (r) {
      go.disabled = false;
      if (r && r.ok && r.cal) { say(""); return next(d, r.cal); }
      if (r && r.network && ++fails >= 2) return say("We can't reach our booking server. Please email manthanbhendkaar@gmail.com and we'll book you in.", true);
      say((r && r.error) || "Something went wrong. Please try again.", true);
    });
  });
})();
