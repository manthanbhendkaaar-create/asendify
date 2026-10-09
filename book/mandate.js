// Booking gate for the free strategy call. Outside India: show the calendar straight away.
// In India: set up a Razorpay eNACH bank mandate first (Rs 0, nothing charged), then show the calendar.
(function () {
  var FN = "https://pnokotvssodslxozepxe.supabase.co/functions/v1/mandate";
  var CAL_LINK = "manthan-bhendkar-5bceko/asendify";   // Cal.com event (rescheduling is turned off there)
  var $ = function (id) { return document.getElementById(id); };
  function showCalendar(prefill) {
    $("bookGate").hidden = true; $("bookMandate").hidden = true;
    var wrap = $("bookCal"); wrap.hidden = false;
    wrap.innerHTML = '<div id="calInline" style="width:100%;min-width:300px;height:760px;overflow:auto"></div>';
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    var cfg = { layout: "month_view", theme: "light" };
    new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_/.test(k)) cfg[k] = v; });   // keeps per-inbox tracking
    if (prefill && prefill.name) cfg.name = prefill.name;
    if (prefill && prefill.email) cfg.email = prefill.email;
    Cal("init", "asendify", { origin: "https://cal.com" });
    Cal.ns.asendify("inline", { elementOrSelector: "#calInline", calLink: CAL_LINK, config: cfg });
    Cal.ns.asendify("ui", { theme: "light", hideEventTypeDetails: false, layout: "month_view" });
  }
  function loadCheckout() {
    return new Promise(function (ok, bad) {
      if (window.Razorpay) return ok();
      var s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = ok; s.onerror = function () { bad(new Error("Could not load Razorpay. Please check your connection.")); };
      document.head.appendChild(s);
    });
  }
  function post(body) {
    return fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).catch(function () { return { error: "Network error. Please try again." }; });
  }
  $("bookOutside").addEventListener("click", function () { showCalendar(); });
  $("bookIndia").addEventListener("click", function () { $("bookGate").hidden = true; $("bookMandate").hidden = false; });
  $("bookMandate").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("bmMsg"), go = $("bmGo");
    var say = function (t, bad) { msg.textContent = t; msg.style.color = bad ? "#b91c1c" : ""; };
    go.disabled = true; say("Starting…");
    Promise.all([loadCheckout(), post({ action: "start", brand: "asendify", name: $("bmName").value, email: $("bmEmail").value, contact: $("bmPhone").value, company: $("bmCompany").value })])
      .then(function (res) {
        var r = res[1];
        if (!r || r.error || !r.order_id) { go.disabled = false; return say((r && r.error) || "Something went wrong. Please try again.", true); }
        say("");
        var rzp = new window.Razorpay({
          key: r.key_id, order_id: r.order_id, customer_id: r.customer_id, recurring: "1",
          name: "Asendify", description: "Bank mandate for your strategy call (nothing charged now)",
          prefill: { name: r.name, email: r.email, contact: r.contact, method: "emandate" },
          theme: { color: "#1f2937" },
          handler: function (p) {
            say("Confirming your mandate…");
            post({ action: "done", order_id: r.order_id, payment_id: p.razorpay_payment_id }).then(function (d) {
              if (d && d.ok) { say(""); showCalendar({ name: $("bmName").value, email: $("bmEmail").value }); }
              else { go.disabled = false; say((d && d.error) || "The mandate wasn't completed. Please try again.", true); }
            });
          },
          modal: { ondismiss: function () { go.disabled = false; say("Mandate not set up. You can try again whenever you're ready.", true); } }
        });
        rzp.on("payment.failed", function (f) { go.disabled = false; say((f && f.error && f.error.description) || "The mandate didn't go through. Please try again.", true); });
        rzp.open();
      })
      .catch(function (err) { go.disabled = false; say(err.message || "Something went wrong.", true); });
  });
})();
