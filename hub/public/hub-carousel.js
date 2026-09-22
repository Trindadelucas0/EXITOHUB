(function () {
  function initCarousel(root) {
    var track = root.querySelector("[data-carousel-track]");
    var slides = Array.prototype.slice.call(root.querySelectorAll("[data-carousel-slide]"));
    var dotsWrap = root.querySelector("[data-carousel-dots]");
    var prev = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");
    if (!track || slides.length === 0) return;

    var index = 0;
    var autoplayMs = Number(root.getAttribute("data-autoplay") || 0);
    var timer = null;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var touchStartX = null;

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = "";
      slides.forEach(function (_slide, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hub-carousel__dot" + (i === index ? " is-active" : "");
        btn.setAttribute("aria-label", "Ir para slide " + (i + 1));
        btn.addEventListener("click", function () {
          go(i);
        });
        dotsWrap.appendChild(btn);
      });
    }

    function go(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
      });
      renderDots();
    }

    function start() {
      if (reduceMotion || !autoplayMs || slides.length < 2) return;
      stop();
      timer = window.setInterval(function () {
        go(index + 1);
      }, autoplayMs);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    if (prev) prev.addEventListener("click", function () { go(index - 1); start(); });
    if (next) next.addEventListener("click", function () { go(index + 1); start(); });

    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    track.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
      stop();
    }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (touchStartX == null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
      start();
    }, { passive: true });

    go(0);
    start();
  }

  document.querySelectorAll("[data-carousel]").forEach(initCarousel);
})();
