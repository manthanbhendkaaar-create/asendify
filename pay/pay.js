// Private payment set-up page (asendify.co/pay). Clients in India set up a Razorpay eNACH bank mandate
// (Rs 0 authorisation, nothing charged). ?for=asendify|morningstarr|web|outbound records which company it is for.
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
  $("payOutside").addEventListener("click", function () { $("payGate").hidden = true; $("payOutsideMsg").hidden = false; });
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
})();
