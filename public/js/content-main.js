(() => {
  // src/content/event.ts
  function dispatchContentEvent({ type, detail }) {
    const event = new CustomEvent(type, { detail });
    document.dispatchEvent(event);
  }
  function addContentEventListener(type, handler) {
    document.addEventListener(type, handler);
  }

  // src/utils/dom.ts
  function query(selector) {
    if (typeof selector === "string") {
      if (selector.includes("/deep/")) {
        return queryShadowDom(document.documentElement, selector.split("/deep/"));
      } else {
        return document.querySelector(selector);
      }
    } else if (selector.xpath) {
      const result = document.evaluate(
        selector.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    }
    return null;
  }
  function queryShadowDom(el, parts) {
    if (parts.length == 1) {
      return el.querySelector(parts[0]);
    }
    const selector = parts[0];
    if (!selector) {
      return null;
    }
    for (let node of el.querySelectorAll(selector)) {
      if (!node.shadowRoot) {
        continue;
      }
      const value = queryShadowDom(node.shadowRoot, parts.slice(1));
      if (!value) {
        continue;
      }
      return value;
    }
    return null;
  }
  function querySome(selectors) {
    for (let selector of selectors) {
      const result = query(selector);
      if (result) {
        return result;
      }
    }
    return null;
  }
  function copyStyleSheets(pipWindow, document2) {
    ;
    [...document2.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
        const style = document2.createElement("style");
        style.textContent = cssRules;
        pipWindow.document.head.appendChild(style);
      } catch (e) {
        const link = document2.createElement("link");
        link.rel = "stylesheet";
        link.type = styleSheet.type;
        link.media = styleSheet.media;
        link.href = styleSheet.href;
        pipWindow.document.head.appendChild(link);
      }
    });
  }
  function getDomNonce(doc) {
    const nonce = { style: "", script: "" };
    const elements = doc.querySelectorAll("[nonce");
    const isLink = (el) => el.nodeName == "LINK";
    for (let element of elements) {
      const code = element.nonce;
      if (!code)
        continue;
      if (element.nodeName == "SCRIPT" && !nonce.script) {
        nonce.script = code;
        continue;
      }
      if (isLink(element) && element.as == "script" && !nonce.script) {
        nonce.script = code;
        continue;
      }
      if (element.nodeName == "STYLE" && !nonce.style) {
        nonce.style = code;
        continue;
      }
      if (isLink(element) && element.rel?.search("stylesheet") > -1 && !nonce.style) {
        nonce.style = code;
        continue;
      }
      if (isLink(element) && element.as == "style" && !nonce.style) {
        nonce.style = code;
        continue;
      }
    }
    return nonce;
  }
  function replaceHtmlNonce(html, nonce) {
    const replacer = (match, p1, p2) => {
      const isScript = p1 == "script" || p1 == "link" && match.search("script") > -1;
      const isStyle = p1 == "style" || p1 == "link" && match.search("style") > -1;
      let r = match;
      if (isScript) {
        r = match.replace(p2, nonce.script);
      }
      if (isStyle) {
        r = match.replace(p2, nonce.style);
      }
      return r;
    };
    let txt = html.replace(/<(script|style|link)\s[^>]*nonce="(.+?)"/g, replacer);
    return txt;
  }
  function removePrerenderRules(doc) {
    const rules = doc.querySelectorAll('script[type="speculationrules"]');
    if (rules) {
      rules.forEach((s) => s.remove());
    }
  }
  function getTrustedHTML(html) {
    if ("window" in globalThis) {
      const policy = window.trustedTypes.createPolicy("trustedPolicy", {
        createHTML: (str) => str
      });
      return policy.createHTML(html);
    }
    return html;
  }

  // src/content/pip.ts
  function fetchDoc(input, init) {
    const headers = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
      // "User-Agent":
      //   "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
    };
    return fetch(input, {
      ...init,
      headers: {
        ...headers,
        ...init?.headers
      }
    });
  }
  var initWindow = null;
  async function pip(options) {
    let { mode, selector, url, isCopyStyle } = options;
    url = url || location.href;
    let element = null;
    if (selector) {
      mode = "move-element";
      element = querySome(selector);
    }
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 420,
      height: 800
    });
    initWindow = { ...pipWindow };
    if (isCopyStyle) {
      copyStyleSheets(pipWindow, document);
    }
    if (mode === "iframe") {
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.id = "";
      iframe.setAttribute("style", "width: 100%; height: 100%; border: none;");
      pipWindow.document.body.append(iframe);
      return;
    }
    if (mode === "move-element") {
      if (element) {
        pipWindow.document.body.append(element);
        return;
      } else {
        throw Error("selector not found");
      }
    }
    if (mode === "write-html") {
      const res = await fetchDoc(url);
      const html = await res.text();
      writeHtml(pipWindow, html);
      navGuard(pipWindow);
      return;
    }
  }
  async function copilotNavigateTo(url) {
    const pipWindow = window.documentPictureInPicture.window;
    if (!pipWindow) {
      throw Error("pipWindow not found");
    }
    const res = await fetchDoc(url);
    const html = await res.text();
    pipWindow.history.replaceState(pipWindow.history.state, "", url);
    writeHtml(pipWindow, html);
  }
  function writeHtml(pipWindow, html) {
    const nonce = getDomNonce(document);
    let escaped = replaceHtmlNonce(html, nonce);
    escaped = getTrustedHTML(escaped);
    pipWindow.document.open();
    pipWindow.document.write(escaped);
    pipWindow.document.close();
    dispatchContentEvent({ type: "anything-copilot_pip-loaded" /* pipLoaded */, detail: {} });
    const base = document.createElement("base");
    base.target = "_blank";
    pipWindow.document.head.append(base);
    removePrerenderRules(pipWindow.document);
  }
  function navGuard(pipWindow) {
    const handleBeforeUnload = (e) => {
      console.log("before unload: ", e);
      e.preventDefault();
      e.returnValue = true;
    };
    const handleClick = (e) => {
      const target = e.target;
      if (!target)
        return;
      console.log("click ", e);
      const anchor = target.closest("a, [href]");
      if (!anchor)
        return;
      const href = anchor.getAttribute("href");
      if (!href)
        return;
      if (href.slice(0, 1) == "#") {
        e.preventDefault();
        pipWindow.location.hash = href;
        return;
      }
      console.log(">> href: ", href, e.defaultPrevented);
      if (href.startsWith(location.origin) || !href.startsWith(location.protocol)) {
        if (!e.defaultPrevented) {
          e.preventDefault();
          copilotNavigateTo(new URL(anchor.href, location.origin).href);
        }
        return;
      }
    };
    pipWindow.addEventListener("beforeunload", handleBeforeUnload);
    pipWindow.addEventListener("click", handleClick);
  }

  // src/content/main.ts
  function handlePipEvent(event) {
    if ("detail" in event) {
      pip(event.detail);
    }
  }
  function handlePipLoadDocEvent(event) {
    if ("detail" in event) {
      copilotNavigateTo(event.detail.url);
    }
  }
  async function handleEscapeLoadEvent(event) {
    if ("detail" in event) {
      const url = event.detail.url;
      const res = await fetchDoc(url);
      const html = await res.text();
      window.history.replaceState(window.history.state, "", url);
      writeHtml(window, html);
    }
  }
  addContentEventListener("anything-copilot_pip" /* pip */, handlePipEvent);
  addContentEventListener("anything-copilot_pip-load" /* pipLoad */, handlePipLoadDocEvent);
  addContentEventListener("anything-copilot_escape-load" /* escapeLoad */, handleEscapeLoadEvent);
  if (window.name.startsWith("anything-copilot_webview" /* webview */)) {
    window.parent = window;
    window.top = window;
  }
})();
