(() => {
  const $ = (id) => document.getElementById(id);
  let socket;
  let context;
  let actionId = "";
  let actionSettings = {};
  let globalSettings = {};

  const strings = {
    en: { connection:"Arena Connection",host:"Host",arenaPort:"Arena input port",replyPort:"Plugin reply port",connectionHelp:"Enable OSC input in Resolume and configure OSC output to send replies to this computer and reply port.",monitoring:"Monitoring",override:"Override shared target",target:"Target",layer:"Layer",clip:"Clip",display:"Display",showClipName:"Show clip name",warning:"Warning seconds",critical:"Critical seconds",hours:"Show hours",milliseconds:"Show milliseconds",sign:"Show T− sign",trigger:"Trigger Clip",triggerTarget:"Trigger target",adjustment:"Adjustment",step:"Step per press",holdDelay:"Hold delay (ms)",repeatInterval:"Repeat interval (ms)",stepHelp:"Resolume relative value; 0.05 equals 5% of the parameter range.",custom:"Custom OSC",pressAddress:"Press address",pressArguments:"Press arguments",releaseEnabled:"Send on release",releaseAddress:"Release address",releaseArguments:"Release arguments",argumentHelp:"Arguments are a JSON array. Types: int, float, string, boolean.",save:"Save",saved:"Saved",invalidHost:"Enter a hostname or IP address.",invalidPort:"Ports must be between 1 and 65535.",invalidIndex:"Layer and clip must be positive integers.",invalidStep:"Step must be greater than 0 and no more than 1.",invalidRepeat:"Hold delay must be 100–2000ms and repeat interval must be 50–1000ms.",invalidThreshold:"Critical seconds cannot exceed warning seconds.",invalidAddress:"OSC addresses must begin with /.",invalidArguments:"Arguments must be a JSON array of typed values." },
    zh_TW: { connection:"Arena 連線",host:"主機",arenaPort:"Arena 輸入 Port",replyPort:"插件回覆 Port",connectionHelp:"請在 Resolume 啟用 OSC input，並將 OSC output 設為傳送至本電腦與回覆 Port。",monitoring:"監看目標",override:"覆寫共用目標",target:"目標類型",layer:"Layer",clip:"Clip",display:"顯示",showClipName:"顯示片段名稱",warning:"警告秒數",critical:"危急秒數",hours:"顯示小時",milliseconds:"顯示毫秒",sign:"顯示 T−",trigger:"觸發片段",triggerTarget:"觸發目標",adjustment:"增量／減量",step:"每次按下的幅度",holdDelay:"長按延遲（ms）",repeatInterval:"連續間隔（ms）",stepHelp:"Resolume 相對值；0.05 代表參數範圍的 5%。",custom:"自訂 OSC",pressAddress:"按下 Address",pressArguments:"按下參數",releaseEnabled:"放開時傳送",releaseAddress:"放開 Address",releaseArguments:"放開參數",argumentHelp:"參數為 JSON 陣列；支援 int、float、string、boolean。",save:"儲存",saved:"已儲存",invalidHost:"請輸入主機名稱或 IP。",invalidPort:"Port 必須介於 1–65535。",invalidIndex:"Layer 與 Clip 必須是正整數。",invalidStep:"調整幅度必須大於 0 且不超過 1。",invalidRepeat:"長按延遲須為 100–2000ms，連續間隔須為 50–1000ms。",invalidThreshold:"危急秒數不可大於警告秒數。",invalidAddress:"OSC address 必須以 / 開頭。",invalidArguments:"參數必須是含型別值的 JSON 陣列。" }
  };
  let text = strings.en;

  window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
    context = uuid;
    const app = JSON.parse(info);
    text = strings[app.application.language] || strings.en;
    document.documentElement.lang = app.application.language;
    document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = text[element.dataset.i18n]; });
    const action = JSON.parse(actionInfo);
    actionId = action.action;
    actionSettings = action.payload.settings || {};
    socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen = () => {
      send({ event: registerEvent, uuid });
      send({ event: "getGlobalSettings", context });
      configureSections();
      fillActionSettings();
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.event === "didReceiveGlobalSettings") {
        globalSettings = message.payload.settings || {};
        fillGlobalSettings();
      }
    };
  };

  function send(message) { socket.send(JSON.stringify(message)); }
  function number(id, fallback) { const value = Number($(id).value); return Number.isFinite(value) ? value : fallback; }
  function isMonitor() { return /time-remaining|clip-name|clip-progress/.test(actionId); }
  function isTransport() { return /\.play$|\.pause$|\.restart$/.test(actionId); }
  function isNudge() { return /\.(speed|volume)-(increase|decrease)$/.test(actionId); }

  function configureSections() {
    const monitorRelated = isMonitor() || isTransport();
    $("monitorSettings").classList.toggle("hidden", !monitorRelated);
    $("displaySettings").classList.toggle("hidden", !isMonitor());
    $("timeNameRow").classList.toggle("hidden", !isMonitor());
    $("triggerSettings").classList.toggle("hidden", !actionId.endsWith(".trigger"));
    $("clearSettings").classList.toggle("hidden", !actionId.endsWith(".clear-composition"));
    $("nudgeSettings").classList.toggle("hidden", !isNudge());
    $("customSettings").classList.toggle("hidden", !actionId.endsWith(".custom-osc"));
    $("overrideRow").classList.toggle("hidden", !monitorRelated);
    updateTargetFields();
  }

  function fillGlobalSettings() {
    $("host").value = globalSettings.host ?? "127.0.0.1";
    $("arenaPort").value = globalSettings.arenaPort ?? 7000;
    $("replyPort").value = globalSettings.replyPort ?? 7001;
    if (!actionSettings.overrideMonitoring) {
      $("monitorMode").value = globalSettings.monitorMode ?? "specificLayer";
      $("layer").value = globalSettings.layer ?? 1;
      $("clip").value = globalSettings.clip ?? 1;
    }
    $("warningSeconds").value = globalSettings.warningSeconds ?? 30;
    $("criticalSeconds").value = globalSettings.criticalSeconds ?? 10;
    $("showHours").checked = globalSettings.showHours ?? false;
    $("showMilliseconds").checked = globalSettings.showMilliseconds ?? false;
    $("showSign").checked = globalSettings.showSign ?? true;
    updateTargetFields();
  }

  function fillActionSettings() {
    $("overrideMonitoring").checked = actionSettings.overrideMonitoring ?? false;
    $("showClipName").checked = actionSettings.showClipName ?? true;
    const legacyStyle = actionId.endsWith(".clip-progress") ? "bar" : actionId.endsWith(".clip-name") ? "square" : "circle";
    $("displayStyle").value = actionSettings.displayStyle ?? legacyStyle;
    if (actionSettings.overrideMonitoring) {
      $("monitorMode").value = actionSettings.monitorMode ?? "specificLayer";
      $("layer").value = actionSettings.layer ?? 1;
      $("clip").value = actionSettings.clip ?? 1;
    }
    $("triggerLayer").value = actionSettings.layer ?? 1;
    $("triggerClip").value = actionSettings.clip ?? 1;
    $("triggerMode").value = actionSettings.triggerMode ?? "selectedClip";
    $("clearTarget").value = actionSettings.clearTarget ?? "composition";
    $("clearLayer").value = actionSettings.layer ?? 1;
    $("nudgeStep").value = actionSettings.step ?? 0.05;
    $("holdDelayMs").value = actionSettings.holdDelayMs ?? 400;
    $("repeatIntervalMs").value = actionSettings.repeatIntervalMs ?? 120;
    $("pressAddress").value = actionSettings.pressAddress ?? "/composition/bypassed";
    $("pressArguments").value = actionSettings.pressArguments ?? '[{"type":"int","value":1}]';
    $("releaseEnabled").checked = actionSettings.releaseEnabled ?? false;
    $("releaseAddress").value = actionSettings.releaseAddress ?? "/composition/bypassed";
    $("releaseArguments").value = actionSettings.releaseArguments ?? '[{"type":"int","value":0}]';
    updateTargetFields();
  }

  function updateTargetFields() {
    const mode = $("monitorMode").value;
    document.querySelectorAll(".layerField").forEach((element) => element.classList.toggle("hidden", !/specific/.test(mode)));
    document.querySelectorAll(".clipField").forEach((element) => element.classList.toggle("hidden", mode !== "specificClip"));
    document.querySelectorAll(".triggerSpecific").forEach((element) => element.classList.toggle("hidden", $("triggerMode").value !== "specificClip"));
    $("clearLayerRow").classList.toggle("hidden", $("clearTarget").value !== "layer");
  }

  function validateArguments(value) {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) && parsed.every((arg) => ["int","float","string","boolean"].includes(arg.type) && Object.hasOwn(arg, "value"));
  }

  function validate() {
    if (!$("host").value.trim() || /\s/.test($("host").value)) return text.invalidHost;
    if (![number("arenaPort", 0), number("replyPort", 0)].every((port) => Number.isInteger(port) && port >= 1 && port <= 65535)) return text.invalidPort;
    if ([number("layer", 0), number("clip", 0), number("triggerLayer", 0), number("triggerClip", 0), number("clearLayer", 0)].some((value) => !Number.isInteger(value) || value < 1)) return text.invalidIndex;
    if (isNudge() && (number("nudgeStep", 0) <= 0 || number("nudgeStep", 0) > 1)) return text.invalidStep;
    if (isNudge() && (number("holdDelayMs", 0) < 100 || number("holdDelayMs", 0) > 2000 || number("repeatIntervalMs", 0) < 50 || number("repeatIntervalMs", 0) > 1000)) return text.invalidRepeat;
    if (number("criticalSeconds", 0) > number("warningSeconds", 0)) return text.invalidThreshold;
    if (actionId.endsWith(".custom-osc")) {
      if (!$("pressAddress").value.startsWith("/") || ($("releaseEnabled").checked && !$("releaseAddress").value.startsWith("/"))) return text.invalidAddress;
      try { if (!validateArguments($("pressArguments").value) || ($("releaseEnabled").checked && !validateArguments($("releaseArguments").value))) return text.invalidArguments; } catch { return text.invalidArguments; }
    }
  }

  $("monitorMode").addEventListener("change", updateTargetFields);
  $("triggerMode").addEventListener("change", updateTargetFields);
  $("clearTarget").addEventListener("change", updateTargetFields);
  $("save").addEventListener("click", () => {
    const error = validate();
    $("error").style.display = error ? "block" : "none";
    $("error").textContent = error || "";
    if (error) return;
    globalSettings = {
      ...globalSettings,
      host: $("host").value.trim(), arenaPort: number("arenaPort", 7000), replyPort: number("replyPort", 7001),
      monitorMode: actionSettings.overrideMonitoring ? globalSettings.monitorMode : $("monitorMode").value,
      layer: actionSettings.overrideMonitoring ? globalSettings.layer : number("layer", 1),
      clip: actionSettings.overrideMonitoring ? globalSettings.clip : number("clip", 1),
      warningSeconds: number("warningSeconds", 30), criticalSeconds: number("criticalSeconds", 10),
      showHours: $("showHours").checked, showMilliseconds: $("showMilliseconds").checked, showSign: $("showSign").checked
    };
    if (isMonitor() || isTransport()) actionSettings = { ...actionSettings, overrideMonitoring: $("overrideMonitoring").checked, monitorMode: $("monitorMode").value, layer: number("layer", 1), clip: number("clip", 1), showClipName: $("showClipName").checked, displayStyle: $("displayStyle").value };
    if (actionId.endsWith(".trigger")) actionSettings = { ...actionSettings, triggerMode: $("triggerMode").value, layer: number("triggerLayer", 1), clip: number("triggerClip", 1) };
    if (actionId.endsWith(".clear-composition")) actionSettings = { ...actionSettings, clearTarget: $("clearTarget").value, layer: number("clearLayer", 1) };
    if (isNudge()) actionSettings = { ...actionSettings, step: number("nudgeStep", 0.05), holdDelayMs: number("holdDelayMs", 400), repeatIntervalMs: number("repeatIntervalMs", 120) };
    if (actionId.endsWith(".custom-osc")) actionSettings = { ...actionSettings, pressAddress: $("pressAddress").value, pressArguments: $("pressArguments").value, releaseEnabled: $("releaseEnabled").checked, releaseAddress: $("releaseAddress").value, releaseArguments: $("releaseArguments").value };
    send({ event: "setGlobalSettings", context, payload: globalSettings });
    send({ event: "setSettings", context, payload: actionSettings });
    $("saved").textContent = text.saved;
    setTimeout(() => { $("saved").textContent = ""; }, 1200);
  });
})();
