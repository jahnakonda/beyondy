/* beyondy.ru — редизайн 2026: фильтр сетки, лайтбокс галерей (нативный <dialog>),
   каскадное появление при прокрутке, подсветка активного раздела в навигации.
   Вся анимация гасится при prefers-reduced-motion. */
(function () {
  "use strict";

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* маркер «JS работает»: без него элементы с .reveal всегда видимы */
  document.documentElement.classList.add("js");

  /* ---------- данные галерей из build_beyondy.py ---------- */
  var GALS = {};
  try {
    GALS = JSON.parse(document.getElementById("galleries").textContent);
  } catch (e) { /* сборка без данных — лайтбокс просто не откроется */ }

  /* ---------- каскадное появление при прокрутке ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (!REDUCE && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        /* лёгкий шаг каскада: соседние карточки входят со сдвигом */
        var i = parseInt(el.getAttribute("data-index"), 10);
        if (!isNaN(i)) el.style.transitionDelay = (i % 4) * 70 + "ms";
        el.classList.add("in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- активный раздел в навигации ---------- */
  var navLinks = document.querySelectorAll(".top__nav a");
  var navMap = {};
  navLinks.forEach(function (l) { navMap[l.getAttribute("href").slice(1)] = l; });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var link = navMap[en.target.id];
        if (!link) return;
        if (en.isIntersecting) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["works", "about", "contact"].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* ---------- фильтр сетки ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var empty = document.querySelector(".grid__empty");

  function applyFilter(f) {
    var shown = 0;
    cards.forEach(function (c) {
      var tags = (c.getAttribute("data-tags") || "").split(/\s+/);
      var ok = f === "*" || tags.indexOf(f) !== -1;
      c.classList.toggle("is-hidden", !ok);
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }

  chips.forEach(function (ch) {
    ch.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("is-on"); });
      ch.classList.add("is-on");
      var f = ch.getAttribute("data-filter");
      applyFilter(f);
      /* выбранный фильтр пишем в URL — состояние можно отправить ссылкой */
      try {
        var u = new URL(window.location.href);
        if (f === "*") u.searchParams.delete("f");
        else u.searchParams.set("f", f);
        history.replaceState(null, "", u);
      } catch (e) { /* file:// или старый браузер — просто без синхронизации */ }
    });
  });

  /* ---------- лайтбокс ---------- */
  var lb = document.getElementById("lb");
  var lbTitle = document.getElementById("lb-title");
  var lbCount = document.getElementById("lb-count");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");
  var lbPrev = document.getElementById("lb-prev");
  var lbNext = document.getElementById("lb-next");
  var lbClose = document.getElementById("lb-close");
  var lbScroll = document.getElementById("lb-scroll");
  var lbNav = document.getElementById("lb-nav");
  var lbThumbs = document.getElementById("lb-thumbs");

  var cur = { id: null, i: 0, n: 0, caps: [] };

  /* полоса миниатюр между стрелками: строится при открытии галереи */
  function buildThumbs() {
    var g = GALS[cur.id];
    if (!lbThumbs) return;
    lbThumbs.textContent = "";
    (g.slides || []).forEach(function (src, i) {
      var b = document.createElement("button");
      b.className = "lb__thumb";
      b.type = "button";
      b.setAttribute("aria-label", "Слайд " + (i + 1));
      var im = document.createElement("img");
      im.src = (g.thumbs && g.thumbs[i]) || src;
      im.alt = "";
      im.loading = "lazy";
      b.appendChild(im);
      b.addEventListener("click", function () { show(i); });
      lbThumbs.appendChild(b);
    });
  }

  function openGallery(id) {
    var g = GALS[id];
    if (!g || !g.slides || !g.slides.length) return;
    cur = { id: id, i: 0, n: g.slides.length, caps: g.caps || [] };
    lbTitle.textContent = g.title || "";
    lb.setAttribute("data-n", String(g.slides.length));
    buildThumbs();
    if (typeof lb.showModal === "function") lb.showModal();
    else window.location.hash = "#";
    show(0);   /* после showModal — размеры уже посчитаны, прокрутка полосы точная */
  }

  function show(i) {
    var g = GALS[cur.id];
    if (!g) return;
    cur.i = (i + cur.n) % cur.n;
    lbImg.src = g.slides[cur.i];
    lbImg.alt = g.title ? g.title + ", изображение " + (cur.i + 1)
                        : "изображение " + (cur.i + 1);
    lbCap.textContent = cur.caps[cur.i] || "";
    lbCount.textContent = (cur.i + 1) + " / " + cur.n;
    var single = cur.n < 2;
    lbPrev.disabled = single;
    lbNext.disabled = single;
    if (lbNav) lbNav.hidden = single;
    /* активная миниатюра: подсветка + прокрутка к центру полосы */
    if (lbThumbs) {
      var kids = lbThumbs.children;
      for (var k = 0; k < kids.length; k++) kids[k].classList.toggle("is-cur", k === cur.i);
      var act = kids[cur.i];
      if (act && lbThumbs.scrollWidth > lbThumbs.clientWidth) {
        var left = act.offsetLeft - (lbThumbs.clientWidth - act.offsetWidth) / 2;
        lbThumbs.scrollTo({ left: left, behavior: REDUCE ? "auto" : "smooth" });
      }
    }
    lbScroll.scrollTop = 0;
  }

  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openGallery(btn.getAttribute("data-open"));
    });
  });

  if (lbPrev) lbPrev.addEventListener("click", function () { show(cur.i - 1); });
  if (lbNext) lbNext.addEventListener("click", function () { show(cur.i + 1); });
  if (lbClose) lbClose.addEventListener("click", function () { lb.close(); });
  if (lb) lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });

  document.addEventListener("keydown", function (e) {
    if (!lb.open) return;
    if (e.key === "ArrowLeft") show(cur.i - 1);
    else if (e.key === "ArrowRight") show(cur.i + 1);
  });

  /* первый фильтр активен по умолчанию; если в URL есть ?f= — включаем его */
  var start = null;
  try {
    var f0 = new URL(window.location.href).searchParams.get("f");
    if (f0) start = document.querySelector('.chip[data-filter="' + f0 + '"]');
  } catch (e) { /* нет URLSearchParams — обычный запуск */ }
  var first = start || document.querySelector('.chip[data-filter="*"]');
  if (first) {
    first.classList.add("is-on");
    if (start) applyFilter(f0);
  }
})();