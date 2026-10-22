// Private payment set-up page (asendify.co/pay). Clients in India set up a Razorpay eNACH bank mandate
// (Rs 0 authorisation, nothing charged). ?for=asendify|morningstarr|web|outbound records which company it is for.
// 2026-10-22: clients outside India save a card on Dodo Payments (card mandate only, nothing charged). The server
// (playbook.asendify.co/api/config?sc=start|confirm) makes the checkout and confirms the card with Dodo itself.
(function () {
  var FN = "https://pnokotvssodslxozepxe.supabase.co/functions/v1/mandate";
  var NAMES = { asendify: "Asendify", morningstarr: "MorningstarrAI", web: "Asendify Web", outbound: "Asendify Outbound" };
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var brand = (q.get("for") || "asendify").toLowerCase();
  if (!NAMES[brand]) brand = "asendify";
  $("payBrand").textContent = NAMES[brand];
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
  $("payIndia").addEventListener("click", function () { $("payGate").hidden = true; $("payMandate").hidden = false; });
  $("payOutside").addEventListener("click", function () { $("payGate").hidden = true; $("scForm").hidden = false; });
  $("payMandate").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("pmMsg"), go = $("pmGo");
    var say = function (t, bad) { msg.textContent = t; msg.style.color = bad ? "#b91c1c" : ""; };
    go.disabled = true; say("Starting…");
    Promise.all([loadCheckout(), post({ action: "start", brand: brand, source: "pay", name: $("pmName").value, email: $("pmEmail").value, contact: $("pmPhone").value, company: $("pmCompany").value })])
      .then(function (res) {
        var r = res[1];
        if (!r || r.error || !r.order_id) { go.disabled = false; return say((r && r.error) || "Something went wrong. Please try again.", true); }
        say("");
        var rzp = new window.Razorpay({
          key: r.key_id, order_id: r.order_id, customer_id: r.customer_id, recurring: "1",
          name: NAMES[brand], description: "Bank mandate (nothing charged now)",
          prefill: { name: r.name, email: r.email, contact: r.contact, method: "emandate" },
          theme: { color: "#1f2937" },
          handler: function (p) {
            say("Confirming your mandate…");
            post({ action: "done", order_id: r.order_id, payment_id: p.razorpay_payment_id }).then(function (d) {
              if (d && d.ok) { $("payMandate").hidden = true; $("payDone").hidden = false; }
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

  // ---------- Save your card (outside India): Dodo Payments card mandate, nothing charged ----------
  var SC = "https://playbook.asendify.co/api/config";
  var scMsg = $("scMsg"), scGo = $("scGo");
  var scSay = function (t, bad) { scMsg.textContent = t; scMsg.style.color = bad ? "#b91c1c" : ""; };
  function scPost(op, body) {
    return fetch(SC + "?sc=" + op, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).catch(function () { return { error: "Network error. Please try again." }; });
  }
  function scConfirm(n) {
    scPost("confirm", { ref: q.get("sref"), subscription_id: q.get("subscription_id") || "" }).then(function (d) {
      if (d && d.saved) { $("scForm").hidden = true; $("scDone").hidden = false; return; }
      if (d && d.pending && n < 6) { scSay("Confirming your card with Dodo Payments… Nothing has been charged."); return setTimeout(function () { scConfirm(n + 1); }, 3000); }
      if (d && d.pending) { scGo.disabled = false; return scSay("Your card is still being confirmed. You'll get an email once it's saved. Nothing has been charged."); }
      scGo.disabled = false; scSay((d && d.error) || "Your card was not saved. Nothing was charged. Please try again.", true);
    });
  }
  if (q.get("card") === "1" && q.get("sref")) { $("payGate").hidden = true; $("scForm").hidden = false; scGo.disabled = true; scSay("Confirming your card…"); scConfirm(0); }
  $("scForm").addEventListener("submit", function (e) {
    e.preventDefault();
    scGo.disabled = true; scSay("Opening the secure card page…");
    scPost("start", { name: $("scName").value, email: $("scEmail").value, brand: brand, hp: $("scHp").value }).then(function (r) {
      if (r && r.url) { location.href = r.url; return; }
      scGo.disabled = false; scSay((r && r.error) || "Something went wrong. Please try again.", true);
    });
  });
})();
