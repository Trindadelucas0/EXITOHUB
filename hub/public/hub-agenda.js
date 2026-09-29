(function () {
  var TZ = "America/Sao_Paulo";
  var HINT = "Clique em um dia ou evento para ver os detalhes.";
  var ERROR = "Não foi possível carregar a agenda.";

  var root = document.getElementById("hub-agenda");
  if (!root || typeof FullCalendar === "undefined") return;

  var feed = root.getAttribute("data-agenda-feed");
  var detail = document.querySelector("[data-agenda-detail]");
  var statusEl = detail && detail.querySelector("[data-agenda-status]");
  var bodyEl = detail && detail.querySelector("[data-agenda-detail-body]");
  var headingEl = detail && detail.querySelector("[data-agenda-detail-heading]");
  var itemsEl = detail && detail.querySelector("[data-agenda-detail-items]");
  var closeBtn = detail && detail.querySelector("[data-agenda-detail-close]");

  function nowInSaoPaulo() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(new Date());
    var pick = function (type) { return parts.find(function (p) { return p.type === type; }).value; };
    var hour = pick("hour") === "24" ? "00" : pick("hour");
    return pick("year") + "-" + pick("month") + "-" + pick("day") + "T" + hour + ":" + pick("minute") + ":" + pick("second");
  }

  // Sem plugin de fuso, o FullCalendar entrega datas "UTC-coerced": a parede de SP vive nos campos UTC.
  function fmt(date, options) {
    return new Intl.DateTimeFormat("pt-BR", Object.assign({ timeZone: "UTC" }, options)).format(date);
  }

  function sameDay(a, b) {
    return a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate();
  }

  function whenText(event) {
    var start = event.start;
    var end = event.end;
    var day = fmt(start, { weekday: "short", day: "numeric", month: "short" });
    var hour = fmt(start, { hour: "2-digit", minute: "2-digit" });
    if (!end) return day + " · " + hour;
    if (sameDay(start, end)) return day + " · " + hour + "–" + fmt(end, { hour: "2-digit", minute: "2-digit" });
    return day + " " + hour + " – " + fmt(end, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function closeDetail() {
    if (!bodyEl) return;
    bodyEl.hidden = true;
    if (statusEl) statusEl.hidden = false;
  }

  function paragraph(label, text) {
    var p = document.createElement("p");
    if (label) {
      var strong = document.createElement("strong");
      strong.textContent = label + " ";
      p.appendChild(strong);
    }
    p.appendChild(document.createTextNode(text));
    return p;
  }

  function renderItem(event) {
    var item = document.createElement("div");
    item.className = "hub-agenda-detail__item";
    var title = document.createElement("strong");
    title.textContent = event.title;
    item.appendChild(title);
    var place = event.extendedProps.place;
    item.appendChild(paragraph("", whenText(event) + (place ? " · " + place : "")));
    var names = (event.extendedProps.attendees || []).map(function (a) { return a.name; }).join(", ");
    if (names) item.appendChild(paragraph("Quem vai:", names));
    return item;
  }

  function openDetail(heading, events) {
    if (!bodyEl || !itemsEl) return;
    headingEl.textContent = heading;
    itemsEl.innerHTML = "";
    if (!events.length) {
      itemsEl.appendChild(paragraph("", "Nada neste dia."));
    } else {
      events.forEach(function (ev) { itemsEl.appendChild(renderItem(ev)); });
    }
    if (statusEl) statusEl.hidden = true;
    bodyEl.hidden = false;
  }

  function eventsOnDay(calendar, day) {
    var dayStart = day.getTime();
    var dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return calendar.getEvents().filter(function (ev) {
      var s = ev.start.getTime();
      var e = ev.end ? ev.end.getTime() : s;
      return s < dayEnd && e >= dayStart;
    });
  }

  var calendar = new FullCalendar.Calendar(root, {
    initialView: "dayGridMonth",
    locale: "pt-br",
    timeZone: TZ,
    now: nowInSaoPaulo,
    firstDay: 1,
    editable: false,
    eventStartEditable: false,
    eventDurationEditable: false,
    selectable: false,
    height: "auto",
    fixedWeekCount: false,
    dayMaxEvents: 2,
    displayEventEnd: false,
    eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    headerToolbar: { left: "prev", center: "title", right: "next" },
    buttonHints: { prev: "Mês anterior", next: "Próximo mês" },
    events: function (info, success, failure) {
      var url = feed
        + "?start=" + encodeURIComponent(info.startStr.slice(0, 10))
        + "&end=" + encodeURIComponent(info.endStr.slice(0, 10));
      fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          success(data);
          setStatus(HINT, false);
        })
        .catch(function (err) {
          failure(err);
          setStatus(ERROR, true);
          closeDetail();
        });
    },
    eventClick: function (info) {
      info.jsEvent.preventDefault();
      openDetail(info.event.title, [info.event]);
    },
    dateClick: function (info) {
      var heading = fmt(info.date, { weekday: "long", day: "numeric", month: "long" });
      openDetail(heading, eventsOnDay(calendar, info.date));
    },
  });

  calendar.render();

  if (closeBtn) closeBtn.addEventListener("click", closeDetail);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && bodyEl && !bodyEl.hidden) closeDetail();
  });
})();
