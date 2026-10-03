(function () {
  var script = document.currentScript;
  if (!script) return;
  var slider = new URL("./", script.src);

  function embed(target, options) {
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) throw new Error("Web Slider embed target was not found.");
    var frame = document.createElement("iframe");
    frame.src = new URL("?embed=1", slider).href;
    frame.title = options.title || "Presentation";
    frame.style.width = options.width || "100%";
    frame.style.height = options.height || "720px";
    frame.style.border = "0";
    frame.setAttribute("allow", "fullscreen");
    host.appendChild(frame);

    frame.addEventListener("load", function () {
      send(options.src);
    });
    window.addEventListener("message", function (event) {
      if (event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== "web-slider:feedback") return;
      if (typeof options.onFeedback === "function") options.onFeedback(event.data);
    });

    function send(src) {
      if (!src) return;
      var url = new URL(src, window.location.href);
      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error("Deck failed to load (" + response.status + ").");
          if (url.pathname.endsWith(".zip")) return response.arrayBuffer().then(function (zip) { return { zip: zip }; });
          return response.text().then(function (yaml) { return { yaml: yaml }; });
        })
        .then(function (payload) {
          frame.contentWindow.postMessage(Object.assign({ type: "web-slider:load" }, payload), slider.origin);
        })
        .catch(function (error) {
          host.textContent = error instanceof Error ? error.message : String(error);
        });
    }
  }

  window.WebSlider = { embed: embed };
})();
