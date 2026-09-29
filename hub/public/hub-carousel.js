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
    var pointerInside = false;
    var focusInside = false;

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = "";
      slides.forEach(function (_slide, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hub-carousel__dot" + (i === index ? " is-active" : "");
        btn.setAttribute("aria-label", "Ir para slide " + (i + 1));
        btn.addEventListener("click", function () {
          go(i, i < index ? -1 : 1);
          start();
        });
        dotsWrap.appendChild(btn);
      });
    }

    function placeEntering(slide, dir) {
      slide.classList.add("is-instant");
      slide.classList.toggle("is-prev", dir < 0);
      void slide.offsetWidth;
      slide.classList.remove("is-instant");
    }

    function go(nextIndex, dir) {
      var target = (nextIndex + slides.length) % slides.length;
      var leaving = slides[index];
      var entering = slides[target];
      if (target !== index) {
        placeEntering(entering, dir);
        leaving.classList.remove("is-active");
        leaving.classList.toggle("is-prev", dir >= 0);
        entering.classList.remove("is-prev");
      }
      entering.classList.add("is-active");
      slides.forEach(function (slide, i) {
        slide.setAttribute("aria-hidden", i === target ? "false" : "true");
      });
      index = target;
      renderDots();
    }

    function start() {
      stop();
      if (reduceMotion || !autoplayMs || slides.length < 2) return;
      if (pointerInside || focusInside) return;
      timer = window.setInterval(function () {
        go(index + 1, 1);
      }, autoplayMs);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    if (prev) prev.addEventListener("click", function () { go(index - 1, -1); start(); });
    if (next) next.addEventListener("click", function () { go(index + 1, 1); start(); });

    root.addEventListener("mouseenter", function () { pointerInside = true; stop(); });
    root.addEventListener("mouseleave", function () { pointerInside = false; start(); });
    root.addEventListener("focusin", function () { focusInside = true; stop(); });
    root.addEventListener("focusout", function (e) {
      if (root.contains(e.relatedTarget)) return;
      focusInside = false;
      start();
    });

    track.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
      stop();
    }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (touchStartX == null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1, dx < 0 ? 1 : -1);
      start();
    }, { passive: true });

    go(0, 1);
    start();
  }

  document.querySelectorAll("[data-carousel]").forEach(initCarousel);
})();
