let sawUserInteraction = false, sawAutomationBehavior = false;

function queryOnePermission(permName) {
	if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
		return Promise.resolve(`${permName}: (not supported)`);
	}
	const qOpts = { name: permName };
	if (permName === "top-level-storage-access") qOpts.requestedOrigin = window.location.origin;
	return Promise.race([
		navigator.permissions.query(qOpts),
		new Promise((_, reject) => setTimeout(() => reject(new Error("permission query timeout")), 3000)),
	])
		.then(r => `${permName}: ${r && r.state}`)
		.catch(() => `${permName}: (not supported)`);
}

async function buildPermissionsReport() {
	const permListRaw = [
		"accelerometer","accessibility-events","ambient-light-sensor","background-sync","camera","clipboard-read","clipboard-write","geolocation","gyroscope","local-fonts","magnetometer","microphone","midi","notifications","payment-handler","persistent-storage","push","screen-wake-lock","storage-access","top-level-storage-access","window-management","nfc","idle-detection","display-capture",
	];
	const list = [...new Set(permListRaw)];
	const answers = new Array(list.length);
	let cursor = 0;
	const nextItem = () => (cursor < list.length ? { idx: cursor, name: list[cursor++] } : null);
	async function workerLoop() {
		for (;;) {
			const item = nextItem();
			if (!item) break;
			const { idx, name } = item;
			answers[idx] = await queryOnePermission(name).catch(() => `${name}: (not supported)`);
		}
	}
	await Promise.all(Array.from({ length: Math.min(5, Math.max(1, list.length)) }, workerLoop));
	return answers.join("\n") + "\n";
}

function collectEnvLines() {
	const lowerCaseStrings = true, omitNullish = false, returnAsObject = false, lines = [], objOut = {};
	const nav = (typeof navigator !== "undefined") ? navigator : {};
	const win = (typeof window !== "undefined") ? window : {};
	const doc = (typeof document !== "undefined") ? document : {};
	const scr = (typeof screen !== "undefined") ? screen : {};
	function pushKV(k, v, toLower) {
		let val = (typeof v === "function") ? v() : v;
		if (toLower && lowerCaseStrings && typeof val === "string") val = val.toLowerCase();
		if (omitNullish && (val === undefined || val === null)) return;
		returnAsObject ? (objOut[k] = val) : lines.push(`${k}: ${val}`);
	}
	const perfs = (typeof performance !== "undefined") ? performance : {};
	const navProps = [
		["userAgent", () => nav.userAgent],["appName", () => nav.appName],["appVersion", () => nav.appVersion],["appCodeName", () => nav.appCodeName],
		["product", () => nav.product],["productSub", () => nav.productSub],["nav-vendor", () => nav.vendor],["nav-vendorSub", () => nav.vendorSub],
		["platform", () => nav.platform],["webdriver", () => nav.webdriver, false],["pdfViewerEnabled", () => nav.pdfViewerEnabled, false],
		["cookieEnabled", () => nav.cookieEnabled, false],["onLine", () => nav.onLine, false],["hardwareConcurrency", () => nav.hardwareConcurrency, false],
		["deviceMemory", () => nav.deviceMemory, false],["language", () => nav.language, false],
		["deprecatedRunAdAuctionEnforcesKAnonymity", () => nav.deprecatedRunAdAuctionEnforcesKAnonymity, false],
		["languages", () => Array.isArray(nav.languages) ? nav.languages.join(", ") : nav.languages],
		["application/pdf", () => ("application/pdf" in nav), false],["virtualKeyboard", () => ("virtualKeyboard" in nav), false],
		["geolocation", () => ("geolocation" in nav), false],["maxTouchPoints", () => nav.maxTouchPoints, false],
		["mediaDevices", () => ("mediaDevices" in nav), false],["mediaSession", () => ("mediaSession" in nav), false],
		["serviceWorker", () => ("serviceWorker" in nav), false],["storage", () => ("storage" in nav), false],
		["bluetooth", () => ("bluetooth" in nav), false],["usb", () => ("usb" in nav), false],
		["serial", () => ("serial" in nav), false],["hid", () => ("hid" in nav), false],
		["xr", () => ("xr" in nav), false],["wakeLock", () => ("wakeLock" in nav), false],
		["keyboard", () => ("keyboard" in nav), false],["clipboard", () => ("clipboard" in nav), false],
		["credentials", () => ("credentials" in nav), false],["presentation", () => ("presentation" in nav), false],
		["standalone", () => nav.standalone, false],["doNotTrack", () => nav.doNotTrack, false],
		["mimeTypes", () => nav.mimeTypes ? nav.mimeTypes.length : undefined, false],
		["window.chrome", () => (!!win.chrome == false || typeof win.chrome === "undefined"), false],
		["window.opr", () => (!!win.opr), false],["window.safari", () => (!!win.safari), false],
		["window.external", () => (!!win.external), false],
		["media", () => (typeof win.matchMedia === "function" ? win.matchMedia("(width <= 480px)").matches : undefined), false],
		["document-url", () => ((win.location && doc.URL) ? `${win.location.href} | ${doc.URL}` : undefined), false],
	];
	for (let i = 0; i < navProps.length; i++) {
		const [key, getter, toLower = true] = navProps[i];
		pushKV(key, getter, toLower);
	}
	const uaData = nav.userAgentData;
	if (!uaData) {
		pushKV("ua", () => undefined, false);
	} else {
		pushKV("ua", () => "(present)", false);
		pushKV("ua-platform", () => (uaData.platform || undefined));
		pushKV("ua-brands", () => Array.isArray(uaData.brands) ? uaData.brands.map(b => b.brand).join(", ") : undefined);
		pushKV("ua-mobile", () => (uaData.mobile !== undefined ? uaData.mobile : undefined), false);
		pushKV("ua-architecture", () => (uaData.architecture || undefined));
		pushKV("ua-bitness", () => (uaData.bitness || undefined));
		pushKV("ua-model", () => (uaData.model || undefined));
	}
	pushKV("plugins", () => {
		const list = nav.plugins;
		if (!list) return undefined;
		const names = Array.isArray(list)
			? list.map(p => p && p.name).filter(Boolean)
			: Array.from({ length: list.length || 0 }, (_, j) => list[j] && list[j].name).filter(Boolean);
		return names.join(", ");
	});
	pushKV("pluginsLength", () => nav.plugins ? nav.plugins.length : 0, false);
	pushKV("canvas", () => {
		if (!doc || typeof doc.createElement !== "function") return undefined;
		const node = doc.createElement("canvas");
		return !!(node && typeof node.getContext === "function" && node.getContext);
	}, false);
	pushKV("connection", () => {
		const c = nav.connection || nav.mozConnection || nav.webkitConnection;
		if (!c) return undefined;
		return `effectiveType-${c.effectiveType || "unknown"} rtt-${c.rtt || "unknown"} downlink-${c.downlink || "unknown"} saveData-${c.saveData || "unknown"} type-${c.type || "unknown"}`;
	}, false);
	pushKV("devicePosture", () => nav.devicePosture ? `type-${nav.devicePosture.type}` : undefined, false);
	pushKV("userActivation", () => nav.userActivation ? `hasBeenActive-${nav.userActivation.hasBeenActive} isActive-${nav.userActivation.isActive}` : undefined, false);
	pushKV("windowSize", () => {
		if (!win) return undefined;
		const { outerWidth, outerHeight, innerWidth, innerHeight, screenX, screenY } = win;
		return `outerWidth-${outerWidth} outerHeight-${outerHeight} innerWidth-${innerWidth} innerHeight-${innerHeight} screenX-${screenX || 0} screenY-${screenY || 0}`;
	}, false);
	pushKV("screenSize", () => {
		if (!scr) return undefined;
		const { availWidth, availHeight, availLeft, availTop, width, height, colorDepth, pixelDepth, isExtended, orientation } = scr;
		let orientStr = "";
		if (orientation) {
			orientStr = `angle-${orientation.angle || "na"} type-${orientation.type || "na"}`;
		}
		return `availWidth-${availWidth} availHeight-${availHeight} availLeft-${availLeft} availTop-${availTop} width-${width} height-${height} colorDepth-${colorDepth} pixelDepth-${pixelDepth} isExtended-${isExtended} ${orientStr}`.trim();
	}, false);
	pushKV("timezone", () => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || new Date().getTimezoneOffset();
		} catch { return new Date().getTimezoneOffset(); }
	}, false);
	pushKV("timezoneOffset", () => new Date().getTimezoneOffset(), false);
	pushKV("locale", () => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().locale || nav.language;
		} catch { return nav.language; }
	});
	pushKV("numberFormat", () => {
		try {
			const nf = new Intl.NumberFormat().resolvedOptions();
			return `${nf.locale}-${nf.numberingSystem || "default"}-${nf.style || "default"}`;
		} catch { return "unknown"; }
	});
	pushKV("dateTimeFormat", () => {
		try {
			const dtf = new Intl.DateTimeFormat().resolvedOptions();
			return `${dtf.locale}-${dtf.calendar || "default"}-${dtf.numberingSystem || "default"}`;
		} catch { return "unknown"; }
	});
	pushKV("relativeTimeFormat", () => {
		try {
			return typeof Intl.RelativeTimeFormat === "function" ? "supported" : "not supported";
		} catch { return "unknown"; }
	});
	pushKV("battery", () => {
		if (nav.getBattery && typeof nav.getBattery === "function") {
			return "api-present";
		} else if ("battery" in nav) {
			return "prop-present";
		}
		return "not-available";
	}, false);
	pushKV("audioContext", () => {
		try {
			const AC = win.AudioContext || win.webkitAudioContext;
			if (!AC) return "not-supported";
			const ctx = new AC();
			const dest = ctx.destination;
			const osc = ctx.createOscillator();
			osc.connect(dest);
			osc.start();
			osc.stop();
			const sampleRate = ctx.sampleRate;
			const channelCount = dest.maxChannelCount || dest.numberOfChannels;
			ctx.close();
			return `sampleRate-${sampleRate} maxChannels-${channelCount}`;
		} catch { return "err"; }
	}, false);
	pushKV("webgl2", () => {
		try {
			const canvas = doc.createElement("canvas");
			return !!(canvas.getContext("webgl2"));
		} catch { return false; }
	}, false);
	pushKV("performanceTiming", () => {
		if (!perfs.timing) return "not-available";
		const pt = perfs.timing;
		const navStart = pt.navigationStart || 0;
		const loadTime = pt.loadEventEnd - navStart;
		const domReady = pt.domContentLoadedEventEnd - navStart;
		return `loadTime-${loadTime} domReady-${domReady} navType-${pt.type || "unknown"}`;
	}, false);
	pushKV("performanceNavigation", () => {
		if (!perfs.navigation) return "not-available";
		return `type-${perfs.navigation.type} redirectCount-${perfs.navigation.redirectCount}`;
	}, false);
	pushKV("memory", () => {
		if (perfs.memory) {
			const m = perfs.memory;
			return `jsHeapSizeLimit-${m.jsHeapSizeLimit || "na"} totalJSHeapSize-${m.totalJSHeapSize || "na"} usedJSHeapSize-${m.usedJSHeapSize || "na"}`;
		}
		return "not-available";
	}, false);
	pushKV("crypto", () => {
		if (!win.crypto && !win.msCrypto) return "not-available";
		const crypto = win.crypto || win.msCrypto;
		let info = "";
		if (crypto.getRandomValues) info += "getRandomValues-";
		if (crypto.subtle) info += "subtle-";
		if (crypto.randomUUID) info += "randomUUID-";
		return info || "basic";
	}, false);
	pushKV("cryptoRandomUUID", () => {
		try {
			if (win.crypto && win.crypto.randomUUID) {
				const uuid = win.crypto.randomUUID();
				return uuid ? "supported" : "not-supported";
			}
			return "not-available";
		} catch { return "err"; }
	}, false);
	pushKV("localStorage", () => {
		try {
			if (typeof win.localStorage !== "undefined") {
				return `quota-${win.localStorage.length || 0}`;
			}
			return "not-available";
		} catch { return "not-available"; }
	}, false);
	pushKV("sessionStorage", () => {
		try {
			if (typeof win.sessionStorage !== "undefined") {
				return `quota-${win.sessionStorage.length || 0}`;
			}
			return "not-available";
		} catch { return "not-available"; }
	}, false);
	pushKV("indexedDB", () => {
		try {
			return (typeof win.indexedDB !== "undefined" || typeof win.IDBFactory !== "undefined") ? "available" : "not-available";
		} catch { return "unknown"; }
	}, false);
	pushKV("webGLParams", () => {
		try {
			const canvas = doc.createElement("canvas");
			const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
			if (!gl) return "not-supported";
			const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
			const params = {
				vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
				renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
				version: gl.getParameter(gl.VERSION),
				shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
				maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
				maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
				aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
				aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
			};
			return Object.entries(params).map(([k, v]) => `${k}-${String(v).substring(0, 50)}`).join(" | ");
		} catch { return "err"; }
	}, false);
	pushKV("webGL2Params", () => {
		try {
			const canvas = doc.createElement("canvas");
			const gl = canvas.getContext("webgl2");
			if (!gl) return "not-supported";
			const params = {
				maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
				maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
				maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
				maxArrayTextureLayers: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
			};
			return Object.entries(params).map(([k, v]) => `${k}-${v}`).join(" | ");
		} catch { return "err"; }
	}, false);
	pushKV("mediaDevicesEnum", () => {
		if (!nav.mediaDevices || !nav.mediaDevices.enumerateDevices) return "not-available";
		return "api-available";
	}, false);
	pushKV("speechSynthesis", () => {
		return (typeof win.speechSynthesis !== "undefined") ? "available" : "not-available";
	}, false);
	pushKV("speechRecognition", () => {
		const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
		return (typeof SpeechRecognition !== "undefined") ? "available" : "not-available";
	}, false);
	pushKV("documentCharset", () => doc.characterSet || doc.charset || "unknown", false);
	pushKV("documentCompatMode", () => doc.compatMode || "unknown", false);
	pushKV("documentContentType", () => doc.contentType || "unknown", false);
	pushKV("documentDesignMode", () => doc.designMode || "unknown", false);
	pushKV("documentDir", () => doc.dir || "unknown", false);
	pushKV("documentDomain", () => doc.domain || "unknown", false);
	pushKV("documentLastModified", () => doc.lastModified ? doc.lastModified.substring(0, 20) : "unknown", false);
	pushKV("documentReferrer", () => doc.referrer ? doc.referrer.substring(0, 100) : "none", false);
	pushKV("documentVisibilityState", () => doc.visibilityState || "unknown", false);
	pushKV("documentHidden", () => doc.hidden !== undefined ? doc.hidden : "unknown", false);
	pushKV("windowHistoryLength", () => win.history ? win.history.length : 0, false);
	pushKV("windowName", () => win.name || "empty", false);
	pushKV("windowScreenAvailWidth", () => scr ? scr.availWidth : "na", false);
	pushKV("windowScreenAvailHeight", () => scr ? scr.availHeight : "na", false);
	pushKV("windowDevicePixelRatio", () => win.devicePixelRatio || "na", false);
	pushKV("windowOrientation", () => {
		if (typeof win.orientation !== "undefined") return win.orientation;
		if (scr && scr.orientation) return scr.orientation.angle;
		return "na";
	}, false);
	pushKV("windowMatchMedia", () => {
		if (!win.matchMedia) return "not-available";
		try {
			const tests = ["(prefers-color-scheme: dark)", "(pointer: fine)", "(hover: hover)"];
			return tests.map(q => win.matchMedia(q).matches ? "1" : "0").join("-");
		} catch { return "err"; }
	}, false);
	pushKV("mediaCapabilities", () => {
		if (!nav.mediaCapabilities || !nav.mediaCapabilities.decodingInfo) return "not-available";
		return "api-available";
	}, false);
	pushKV("share", () => nav.share ? "api-available" : "not-available", false);
	pushKV("vibrate", () => nav.vibrate ? "api-available" : "not-available", false);
	pushKV("getGamepads", () => nav.getGamepads ? "api-available" : "not-available", false);
	pushKV("webkitTemporaryStorage", () => nav.webkitTemporaryStorage ? "available" : "not-available", false);
	pushKV("webkitPersistentStorage", () => nav.webkitPersistentStorage ? "available" : "not-available", false);
	pushKV("webkitStorageInfo", () => nav.webkitStorageInfo ? "available" : "not-available", false);
	return returnAsObject ? objOut : (lines.join("\n") + "\n");
}

function makeTextCanvas(str) {
	const c = document.createElement("canvas");
	c.width = 500; c.height = 150;
	const g = c.getContext("2d");
	g.font = "14px 'Courier New', serif";
	g.textBaseline = "alphabetic";
	g.fillStyle = "#f55";
	g.fillRect(60, 1, 62, 20);
	g.fillStyle = "#02f";
	g.fillText(str, 2, 15);
	g.fillStyle = "rgba(200, 10, 10, 0.8)";
	g.fillText(str, 4, 17);
	return c;
}
function pixelSumForCanvas(node) {
	const data = node.getContext("2d").getImageData(0, 0, node.width, node.height).data;
	let s = 0;
	for (let i = 0; i < data.length; i++) s += data[i];
	return s;
}
function hashForCanvas(node) {
	const buf = node.getContext("2d").getImageData(0, 0, node.width, node.height).data;
	let h = 0;
	for (let i = 0; i < buf.length; i++) h = (h * 31 + buf[i]) >>> 0;
	return h;
}
function canvasMetricsForText(s) {
	const cnode = makeTextCanvas(s);
	return { url: cnode.toDataURL(), sum: pixelSumForCanvas(cnode), hash: hashForCanvas(cnode) };
}
function readWebGLDetails() {
	const c = document.createElement("canvas");
	const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
	if (!gl) return { vendor: "webgl: not supported", renderer: "webgl: not supported" };
	const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
	let vendor = "unknown", renderer = "unknown";
	if (debugInfo) {
		vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "unknown";
		renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown";
	}
	return {
		vendor: `webgl-vendor: ${String(vendor).toLowerCase()}`,
		renderer: `webgl-renderer: ${String(renderer).toLowerCase()}`
	};
}
function buildCanvasReport() {
	const textFP = canvasMetricsForText("Bittensor RedTeam ab_sniffer_v2");
	const emojiFP = canvasMetricsForText("🙂🔥🚀🍕❤️");
	const glInfo = readWebGLDetails();
	return [
		`text-dataurl: ${textFP.url}`,
		`text-pixelsum: ${textFP.sum}`,
		`text-hash: ${textFP.hash}`,
		`emoji-dataurl: ${emojiFP.url}`,
		`emoji-pixelsum: ${emojiFP.sum}`,
		`emoji-hash: ${emojiFP.hash}`,
		glInfo.vendor,
		glInfo.renderer
	].join("\n") + "\n";
}

class FontProbe {
	constructor() {
		this.referenceFamilies = ["monospace", "sans-serif", "serif"];
		this.sampleText = "Bittensor RedTeam ab_sniffer_v2";
		this.sampleSize = "72px";
		this.baseWidth = {};
		this.baseHeight = {};
		this._tmpSpan = document.createElement("span");
		this._tmpSpan.style.fontSize = this.sampleSize;
		this._tmpSpan.textContent = this.sampleText;
		this._measureBaselines();
	}
	_measureBaselines() {
		const body = document.body;
		for (let i = 0; i < this.referenceFamilies.length; i++) {
			const fam = this.referenceFamilies[i];
			this._tmpSpan.style.fontFamily = fam;
			body.appendChild(this._tmpSpan);
			this.baseWidth[fam] = this._tmpSpan.offsetWidth;
			this.baseHeight[fam] = this._tmpSpan.offsetHeight;
			body.removeChild(this._tmpSpan);
		}
	}
	detected(fontName) {
		const body = document.body;
		for (let i = 0; i < this.referenceFamilies.length; i++) {
			const fam = this.referenceFamilies[i];
			this._tmpSpan.style.fontFamily = `"${fontName}",${fam}`;
			body.appendChild(this._tmpSpan);
			const w = this._tmpSpan.offsetWidth, h = this._tmpSpan.offsetHeight;
			const w0 = this.baseWidth[fam], h0 = this.baseHeight[fam];
			body.removeChild(this._tmpSpan);
			if (w !== w0 || h !== h0) return true;
		}
		return false;
	}
}

function grabExtraSignals() {
	const fontsToCheck = [
		"Arial","Arial Black","Bahnschrift","Calibri","Cambria","Cambria Math","Candara","Comic Sans MS","Consolas","Constantia","Corbel","Courier New","Ebrima","Franklin Gothic Medium","Gabriola","Gadugi","Georgia","HoloLens MDL2 Assets","Impact","Ink Free","Javanese Text","Leelawadee UI","Lucida Console","Lucida Sans Unicode","Malgun Gothic","Marlett","Microsoft Himalaya","Microsoft JhengHei","Microsoft New Tai Lue","Microsoft PhagsPa","Microsoft Sans Serif","Microsoft Tai Le","Microsoft YaHei","Microsoft Yi Baiti","MingLiU-ExtB","Mongolian Baiti","MS Gothic","MV Boli","Myanmar Text","Nirmala UI","Palatino Linotype","Segoe MDL2 Assets","Segoe Print","Segoe Script","Segoe UI","Segoe UI Historic","Segoe UI Emoji","Segoe UI Symbol","SimSun","Sitka","Sylfaen","Symbol","Tahoma","Times New Roman","Trebuchet MS","Verdana","Webdings","Wingdings","Yu Gothic","American Typewriter","Andale Mono","Arial Narrow","Arial Rounded MT Bold","Arial Unicode MS","Avenir","Avenir Next","Avenir Next Condensed","Baskerville","Big Caslon","Bodoni 72","Bodoni 72 Oldstyle","Bodoni 72 Smallcaps","Bradley Hand","Brush Script MT","Chalkboard","Chalkboard SE","Chalkduster","Charter","Cochin","Courier","Didot","DIN Alternate","DIN Condensed","Futura","Geneva","Gill Sans","Helvetica","Helvetica Neue","Herculanum","Hoefler Text","Lucida Grande","Luminari","Marker Felt","Menlo","Monaco","Noteworthy","Optima","Palatino","Papyrus","Phosphate","Rockwell","Savoye LET","SignPainter","Skia","Snell Roundhand","Times","Trattatello","Zapfino"
	];
	const probe = new FontProbe();
	const detectedFonts = Array.from(new Set(fontsToCheck)).sort().filter(f => probe.detected(f)).map(f => `"${f}"`);
	let report = "";
	report += `fontLength: ${detectedFonts.length}\nfonts: ${detectedFonts.join(", ")}\n`;
	report += `document.$cdc_asdjflasutopfhvcZLmcfl_: ${document.$cdc_asdjflasutopfhvcZLmcfl_}\n`;
	report += `document.$chrome_asyncScriptInfo: ${document.$chrome_asyncScriptInfo}\n`;
	report += `window.cdc_adoQpoasnfa76pfcZLmcfl: ${window.cdc_adoQpoasnfa76pfcZLmcfl}\n`;
	const loginBtn = document.getElementById("login-button");
	if (loginBtn) {
		const r = loginBtn.getBoundingClientRect();
		const absTop = r.top + window.scrollY, absLeft = r.left + window.scrollX;
		report += `login-button: left-${r.left}, top-${r.top}, width-${r.width}, height-${r.height}, absoluteLeft-${absLeft}, absoluteTop-${absTop}\n`;
	} else {
		report += "login-button: not found\n";
	}
	return report;
}

/* =========================
 * TRACE / INPUT CAPTURE
 * =========================*/

function describeDomNode(node) {
	if (!node) return "null";
	if (node === window) return "window";
	if (node === document) return "document";
	if (node === document.documentElement) return "<html>";
	if (node === document.body) return "<body>";
	if (node.tagName) {
		let build = `<${node.tagName.toLowerCase()}`;
		if (node.id) build += `#${node.id}`;
		if (node.className && typeof node.className === "string") {
			build += "." + node.className.trim().split(/\s+/).slice(0, 3).join(".");
		}
		return build + ">";
	}
	return "[unknown-target]";
}

function initUserMotionRecorder() {
	const START_MARK = performance.now();
	if (!window.__botTrace) window.__botTrace = { challengeLog: [], clickStream: [] };
	const recentPtr = [];
	function recordPtr(evtType, nowAbs) {
		const stamp = nowAbs || performance.now();
		recentPtr.push({ tAbs: stamp, type: evtType });
		const cutoff = stamp - 1000;
		while (recentPtr.length && recentPtr[0].tAbs < cutoff) recentPtr.shift();
	}
	["mousemove","mousedown","mouseup","pointermove","pointerdown","pointerup"].forEach(evName => {
		window.addEventListener(evName, e => recordPtr(e.type, performance.now()), { passive: true });
	});
	window.addEventListener("click", e => {
		const nowAbs = performance.now();
		let hadDown = false, hadUp = false, hadMove = false;

		markUserInteractionTrusted(e);

		for (let i = recentPtr.length - 1; i >= 0; i--) {
			const row = recentPtr[i], age = nowAbs - row.tAbs;
			if (age > 300) break;
			if (row.type === "mousemove" || row.type === "pointermove") hadMove = true;
		}
		for (let j = recentPtr.length - 1; j >= 0; j--) {
			const row = recentPtr[j], age = nowAbs - row.tAbs;
			if (age > 100) break;
			if (row.type === "mousedown" || row.type === "pointerdown") hadDown = true;
			if (row.type === "mouseup" || row.type === "pointerup") hadUp = true;
		}
		let targetAtPointDesc = "err";
		const realEl = document.elementFromPoint(e.clientX, e.clientY);
		if (realEl) targetAtPointDesc = describeDomNode(realEl);
		const injectedClick = (!hadDown && !hadUp);
		window.__botTrace.clickStream.push({
			t: performance.now() - START_MARK,
			x: e.clientX,
			y: e.clientY,
			targetDesc: describeDomNode(e.target),
			hadDown,
			hadUp,
			hadMove,
			targetAtPoint: targetAtPointDesc,
			noPointerClick: injectedClick,
			isTrusted: !!e.isTrusted
		});

		if (injectedClick) {
			sawAutomationBehavior = true;
		}
	}, { capture: true, passive: true });

	function spawnDragChallenge() {
		const box = document.createElement("div"), playfield = document.createElement("div"), slider = document.createElement("div");
		Object.assign(box.style, {
			position: "fixed", zIndex: "999999", right: "20px", bottom: "20px", padding: "10px", background: "rgba(0,0,0,0.7)",
			color: "#fff", fontSize: "12px", borderRadius: "6px", userSelect: "none", width: "200px", cursor: "default"
		});
		box.innerHTML = `<div style="margin-bottom:6px;font-family:sans-serif;">Quick check: drag the gray square slightly.</div>`;
		Object.assign(playfield.style, {
			position: "relative", width: "180px", height: "60px", border: "1px solid #999", background: "#222", overflow: "hidden"
		});
		Object.assign(slider.style, {
			position: "absolute", left: "10px", top: "20px", width: "20px", height: "20px",
			background: "#888", border: "1px solid #aaa", cursor: "grab"
		});
		let active = false, sx = 0, sy = 0, baseL = 0, baseT = 0;
		const logDrag = (evtType, extra) => window.__botTrace.challengeLog.push({ t: performance.now() - START_MARK, kind: "dragBox", evtType, ...extra });
		slider.addEventListener("mousedown", ev => {
			active = true; slider.style.cursor = "grabbing";
			sx = ev.clientX; sy = ev.clientY; baseL = parseFloat(slider.style.left); baseT = parseFloat(slider.style.top);
			logDrag("mousedown", { x: ev.clientX, y: ev.clientY });
		});
		window.addEventListener("mousemove", ev => {
			if (!active) return;
			let newLeft = baseL + (ev.clientX - sx), newTop = baseT + (ev.clientY - sy);
			if (newLeft < 0) newLeft = 0;
			if (newTop < 0) newTop = 0;
			if (newLeft > 160) newLeft = 160;
			if (newTop > 40) newTop = 40;
			slider.style.left = newLeft + "px";
			slider.style.top = newTop + "px";
			logDrag("dragmove", { x: ev.clientX, y: ev.clientY, newLeft, newTop });
		});
		window.addEventListener("mouseup", ev => {
			if (!active) return;
			active = false; slider.style.cursor = "grab";
			logDrag("mouseup", { x: ev.clientX, y: ev.clientY });
		});
		playfield.appendChild(slider); box.appendChild(playfield); document.body.appendChild(box);
		window.__botTrace.challengeLog.push({ t: performance.now() - START_MARK, kind: "dragBox", evtType: "spawned" });
	}
	setTimeout(spawnDragChallenge, 5000);
}

function detectPlatformSpoofMismatch() {
	const platform = (navigator.platform || "").toLowerCase();
	const appVersion = (navigator.appVersion || "").toLowerCase();
	const platIsWin = /win/.test(platform);
	const platIsLinux = /(linux|x11|unix)/.test(platform);
	const platIsMac = /(mac|macintel|macppc|mac68k)/.test(platform);
	const verSaysWin = /(windows nt|win64|win32|wow64)/.test(appVersion);
	const verSaysLinux = /(linux|x11)/.test(appVersion);
	const verSaysMac = /(macintosh|mac os x)/.test(appVersion);
	const verSaysCrOS = /(cros)/.test(appVersion); // ChromeOS often spoofed
	const verSaysAndroid = /android/.test(appVersion);
	let mismatch = false;
	if (
		(platIsWin && (verSaysLinux || verSaysAndroid || verSaysCrOS)) ||
		(platIsLinux && (verSaysWin || verSaysMac)) ||
		(platIsMac && (verSaysWin || verSaysLinux || verSaysAndroid)) ||
		(verSaysCrOS && (platIsWin || platIsMac))
	) {
		mismatch = true;
	}
	return mismatch;
}

(function runSpoofCheckEarly() {
	if (detectPlatformSpoofMismatch()) {
		sawUserInteraction = false;
		sawAutomationBehavior = true;
	}
})();

function markUserInteractionTrusted(e) {
	if (detectPlatformSpoofMismatch()) {
		return;
	}
	if (e && e.isTrusted === true) {
		sawUserInteraction = true;
	}
}

const DRIVER_NAMES = [
	"seleniumdriverless","seleniumbase","nodriver","patchright","zendriver","puppeteerextra","botasaurus","pydoll","camoufox"
];
const driverScores = Object.fromEntries(DRIVER_NAMES.map(x => [x, 0]));
const driverFingerprints = Object.fromEntries(DRIVER_NAMES.map(x => [x, ""]));

function everyClickHasFlag(flagKey, expectedVal) {
	if (!window.__botTrace || !Array.isArray(window.__botTrace.clickStream)) return true;
	return window.__botTrace.clickStream.every(c => c[flagKey] === expectedVal);
}

async function interpretEnvironment() {
	await new Promise((res) => setTimeout(res, 10000));
	let block = await buildPermissionsReport();
	block += collectEnvLines();
	block += buildCanvasReport();
	block += grabExtraSignals();

	const pickLineAfter = (prefixStr) => {
		const rows = block.split("\n");
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].startsWith(prefixStr)) {
				const idx = rows[i].indexOf(":"); if (idx === -1) return "";
				return rows[i].substring(idx + 1).trim();
			}
		}
		return "";
	};
	const bumpScore = (driverKey, msg, amt) => {
		const s = (typeof amt === "number") ? amt : 1;
		driverScores[driverKey] += s;
		if (msg) driverFingerprints[driverKey] += msg + ", ";
	};

	const ua = pickLineAfter("userAgent:").toLowerCase();
	if (ua.indexOf("x11; linux x86_64") !== -1) bumpScore("seleniumbase", `userAgent: ${ua}`);
	if (ua.includes("macintosh") || ua.includes("mac os x") || ua.includes("rv:")) bumpScore("camoufox", `userAgent: ${ua}`);

	const langsVal = pickLineAfter("languages:");
	if (langsVal.indexOf("en-us") !== -1 && langsVal.indexOf("en-us, en") === -1) bumpScore("patchright", "languages: en-us");
	if (block.indexOf("pdfViewerEnabled: false") !== -1) bumpScore("patchright", "pdfViewerEnabled: false");

	if (block.indexOf("platform: win32") !== -1) {
		["puppeteerextra"].forEach(d => bumpScore(d, "platform: win32"));
	}
	if (block.indexOf("platform: macintel") !== -1) bumpScore("camoufox", "platform: macintel");

	const hwcMatch = block.match(/hardwareConcurrency: (\d+)/);
	const hwcNum = hwcMatch ? Number(hwcMatch[1]) : NaN;
	if (hwcNum === 4) bumpScore("puppeteerextra", `hardwareConcurrency: ${hwcNum}`);
	if (hwcNum === 12) bumpScore("camoufox", `hardwareConcurrency: ${hwcNum}`);

	const winSizeRow = block.split("\n").find(line => line.startsWith("windowSize:"));
	function distributeSizes(fieldName, targetsMap) {
		if (!winSizeRow) return;
		const m = new RegExp(fieldName + "-(\\d+)").exec(winSizeRow);
		const maybeNum = m ? Number(m[1]) : null;
		if (!maybeNum) return;
		for (const label of Object.keys(targetsMap)) {
			if (targetsMap[label].includes(maybeNum)) bumpScore(label, `${fieldName}: ${maybeNum}`, 0.25);
		}
	}
	distributeSizes("outerWidth", {
		"nodriver":[800,1560],"patchright":[800,780],"seleniumbase":[1440],"seleniumdriverless":[780,1560],
		"zendriver":[780],"puppeteerextra":[780],"botasaurus":[800],"pydoll":[780],"camoufox":[1421,1936]
	});
	distributeSizes("outerHeight", {
		"nodriver":[600,1160],"patchright":[600,580,600],"seleniumbase":[1880],"seleniumdriverless":[580,1160],
		"zendriver":[580],"botasaurus":[600],"pydoll":[580],"puppeteerextra":[578,493],"camoufox":[919,1056]
	});
	distributeSizes("innerWidth", {
		"nodriver":[800,1560],"patchright":[800,780],"seleniumbase":[1440],"seleniumdriverless":[780,1560],
		"zendriver":[780],"botasaurus":[800],"pydoll":[780],"puppeteerextra":[780],"camoufox":[1421,1936]
	});
	distributeSizes("innerHeight", {
		"nodriver":[513,1073],"patchright":[493,600],"seleniumbase":[1741],"seleniumdriverless":[493,1073],
		"botasaurus":[513],"zendriver":[493],"puppeteerextra":[493],"pydoll":[580],"camoufox":[858,995]
	});

	const emojiPixelMatch = block.match(/emoji-pixelsum: (\d+)/);
	const emojiPx = emojiPixelMatch ? Number(emojiPixelMatch[1]) : NaN;
	if (emojiPx === 943656) bumpScore("seleniumbase", `emoji-pixelsum: ${emojiPx}`, 0.5);
	if (emojiPx !== 943656 && emojiPx !== 961691) { bumpScore("camoufox", `emoji-pixelsum: ${emojiPx}`, 0.5); bumpScore("pydoll", `emoji-pixelsum: ${emojiPx}`, 0.5);  }

	const emojiHashMatch = block.match(/emoji-hash: (\d+)/);
	const emojiHashNum = emojiHashMatch ? Number(emojiHashMatch[1]) : NaN;
	if (emojiHashNum === 370831538) bumpScore("seleniumbase", `emoji-hash: ${emojiHashNum}`, 0.5);
	if (emojiHashNum !== 370831538 && emojiHashNum !== 2807816363) { bumpScore("camoufox", `emoji-hash: ${emojiHashNum}`, 0.5); bumpScore("pydoll", `emoji-hash: ${emojiHashNum}`, 0.5); }

	const textPixelMatch = block.match(/text-pixelsum: (\d+)/);
	const textPx = textPixelMatch ? Number(textPixelMatch[1]) : NaN;
	if (textPx !== 1374895) { bumpScore("camoufox", `text-pixelsum: ${textPx}`, 0.5); bumpScore("pydoll", `text-pixelsum: ${textPx}`, 0.5); }

	const textHashMatch = block.match(/text-hash: (\d+)/);
	const textHashNum = textHashMatch ? Number(textHashMatch[1]) : NaN;
	if (textHashNum !== 2778945889) { bumpScore("camoufox", `text-hash: ${textHashNum}`, 0.5); bumpScore("pydoll", `text-hash: ${textHashNum}`, 0.5); }

	const glVendorStr = pickLineAfter("webgl-vendor:").toLowerCase();
	if (glVendorStr.includes("intel inc.")) bumpScore("puppeteerextra", `webgl-vendor: ${glVendorStr}`, 0.5);
	if (glVendorStr.includes("apple") || glVendorStr.includes("nvidia")) bumpScore("camoufox", `webgl-vendor: ${glVendorStr}`, 0.5);

	const glRendererStr = pickLineAfter("webgl-renderer:").toLowerCase();
	if (glRendererStr.includes("intel iris")) bumpScore("puppeteerextra", `webgl-renderer: ${glRendererStr}`, 0.5);
	if (glRendererStr.includes("apple") || glRendererStr.includes("nvidia")) bumpScore("camoufox", `webgl-renderer: ${glRendererStr}`, 0.5);

	if (pickLineAfter("document-url:").indexOf("?") === -1) {
		bumpScore("patchright", "document-url: x?")
		bumpScore("seleniumdriverless", "document-url: x?")
	};
	if (pickLineAfter("ua-platform:").indexOf("undefined") !== -1) bumpScore("zendriver", "ua-platform: ", 0.5);
	if (pickLineAfter("ua-brands:").indexOf("undefined") !== -1) bumpScore("zendriver", "ua-brands: ", 0.5);
	if (!pickLineAfter("plugins:")) bumpScore("patchright", "plugins: , ");

	const mtpMatch = block.match(/maxTouchPoints: (\d+)/);
	const mtpNum = mtpMatch ? Number(mtpMatch[1]) : NaN;
	if (mtpNum === 2) bumpScore("camoufox", `maxTouchPoints: ${mtpNum}`, 0.5);

	const productSubMatch = block.match(/productSub: (\d+)/);
	const productSubNum = productSubMatch ? Number(productSubMatch[1]) : NaN;
	if (productSubNum === 20100101) bumpScore("camoufox", `productSub: ${productSubNum}`, 0.5);

	const fLenMatch = block.match(/fontLength: (\d+)/);
	const fontLenNum = fLenMatch ? Number(fLenMatch[1]) : NaN;
	if (fontLenNum > 50) bumpScore("camoufox", `fontLength: ${fontLenNum}`, 0.5);

	if (pickLineAfter("window.chrome:").indexOf("true") !== -1) bumpScore("camoufox", "window.chrome: true", 0.5);
	if (pickLineAfter("connection:").indexOf("undefined") !== -1) bumpScore("camoufox", "connection: undefined", 0.5);
	if (pickLineAfter("nav-vendor:").indexOf("google inc.") === -1) bumpScore("camoufox", "nav-vendor: ", 0.5);

	const traceObj = window.__botTrace || null;
	const haveChallenge = !!(traceObj && traceObj.challengeLog && traceObj.challengeLog.length > 0);
	const haveClicks = !!(traceObj && traceObj.clickStream && traceObj.clickStream.length > 0);
	if (haveChallenge) bumpScore("camoufox", "hasChallengeLog", 0.25);
	if (haveClicks) {
		if (everyClickHasFlag("hadMove", false)) bumpScore("seleniumbase", "allClicksFlag(false)", 0.25);
	}

	// Analyze trace data for additional bot indicators
	function analyzeTraceData() {
		if (!traceObj) return;

		// Check mouseStream
		const mouseStream = traceObj.mouseStream || [];
		if (mouseStream.length > 0) {
			const moveEvents = mouseStream.filter(m => m.type === "mousemove" || m.type === "pointermove");
			const hasMove = moveEvents.length > 0;
			const hasTrustedMove = moveEvents.some(m => m.isTrusted === true);

			if (!hasMove && haveClicks) {
				bumpScore("seleniumbase", "mouseStream: no moves with clicks", 0.3);
			}
			if (hasMove && !hasTrustedMove && moveEvents.length > 5) {
				bumpScore("pydoll", "mouseStream: untrusted moves", 0.2);
			}

			// Check for suspiciously uniform movement patterns
			if (moveEvents.length >= 3) {
				const deltas = [];
				for (let i = 1; i < moveEvents.length; i++) {
					const dx = Math.abs(moveEvents[i].x - moveEvents[i-1].x);
					const dy = Math.abs(moveEvents[i].y - moveEvents[i-1].y);
					const dist = Math.sqrt(dx * dx + dy * dy);
					deltas.push(dist);
				}
				const avgDist = deltas.reduce((a, b) => a + b, 0) / deltas.length;
				const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / deltas.length;
				if (variance < 10 && avgDist > 0) {
					bumpScore("seleniumdriverless", "mouseStream: uniform pattern", 0.25);
				}
			}
		} else if (haveClicks) {
			bumpScore("seleniumbase", "mouseStream: empty with clicks", 0.3);
		}

		// Check scrollStream
		const scrollStream = traceObj.scrollStream || [];
		if (scrollStream.length > 0) {
			const wheelEvents = scrollStream.filter(s => s.type === "wheel");
			const windowScrolls = scrollStream.filter(s => s.type === "window-scroll");

			// If we have window scrolls but no wheel events, likely programmatic
			if (windowScrolls.length > 0 && wheelEvents.length === 0) {
				bumpScore("puppeteerextra", "scrollStream: no wheel events", 0.25);
				bumpScore("patchrighter", "scrollStream: no wheel events", 0.25);
			}

			// Check for very rapid scroll changes (programmatic)
			if (windowScrolls.length >= 2) {
				for (let i = 1; i < windowScrolls.length; i++) {
					const dt = windowScrolls[i].t - windowScrolls[i-1].t;
					const dScrollY = Math.abs(windowScrolls[i].scrollY - windowScrolls[i-1].scrollY);
					if (dt < 50 && dScrollY > 100) {
						bumpScore("pydolle", "scrollStream: rapid jumps", 0.2);
						break;
					}
				}
			}
		}

		// Check typingBursts
		const typingBursts = traceObj.typingBursts || [];
		if (typingBursts.length > 0) {
			typingBursts.forEach(burst => {
				// Very fast typing (avg delta time < 50ms) suggests automation
				if (burst.avgDt && burst.avgDt < 50 && burst.len > 3) {
					bumpScore("pydolle", "typingBursts: too fast", 0.2);
					bumpScore("seleniumbase", "typingBursts: too fast", 0.15);
				}
				// Very uniform typing (low variance) suggests bot
				if (burst.avgDt && burst.avgDt > 0 && burst.avgDt < 100) {
					// Check if all keys are the same or very similar pattern
					const keys = burst.keysSample || [];
					if (keys.length >= 3) {
						const allSame = keys.every(k => k === keys[0]);
						if (allSame && burst.len > 5) {
							bumpScore("pydolle", "typingBursts: repetitive", 0.2);
						}
					}
				}
			});
		}

		// Check viewportSamples
		const viewportSamples = traceObj.viewportSamples || [];
		if (viewportSamples.length > 0) {
			// Check if window never had focus
			const allNoFocus = viewportSamples.every(v => v.hasFocus === false);
			if (allNoFocus) {
				bumpScore("botasaurus", "viewportSamples: no focus", 0.3);
				bumpScore("nodriver", "viewportSamples: no focus", 0.3);
				bumpScore("zendriver", "viewportSamples: no focus", 0.3);
			}

			// Check for unusual visibility patterns
			const hiddenCount = viewportSamples.filter(v => v.visibilityState === "hidden").length;
			if (hiddenCount > viewportSamples.length * 0.5 && viewportSamples.length > 3) {
				bumpScore("puppeteerextra", "viewportSamples: often hidden", 0.2);
			}

			// Check for viewport size changes that suggest headless
			if (viewportSamples.length >= 2) {
				const sizes = viewportSamples.map(v => `${v.innerW}x${v.innerH}`);
				const uniqueSizes = new Set(sizes);
				if (uniqueSizes.size === 1 && haveClicks) {
					// Same size throughout with interactions suggests bot
					const firstSample = viewportSamples[0];
					if (firstSample.innerW === 800 && firstSample.innerH === 600) {
						bumpScore("puppeteerextra", "viewportSamples: static 800x600", 0.25);
					}
				}
			}
		}

		// Check botActionRhythm
		const botActionRhythm = traceObj.botActionRhythm || [];
		if (botActionRhythm.length > 0) {
			bumpScore("seleniumbase", "botActionRhythm: present", 0.4);

			// Check timing patterns
			const dtValues = botActionRhythm
				.filter(r => r.dtPrevAction !== null)
				.map(r => r.dtPrevAction);

			if (dtValues.length >= 3) {
				const avgDt = dtValues.reduce((a, b) => a + b, 0) / dtValues.length;
				const variance = dtValues.reduce((sum, d) => sum + Math.pow(d - avgDt, 2), 0) / dtValues.length;

				if (variance < 100 && avgDt > 0) {
					bumpScore("seleniumbase", "botActionRhythm: uniform timing", 0.3);
				}

				if (avgDt < 100) {
					bumpScore("pydolle", "botActionRhythm: too fast", 0.25);
				}
			}

			// Check action types
			const instantValueSets = botActionRhythm.filter(r => r.kind === "instantValueSet").length;
			if (instantValueSets > 0) {
				bumpScore("seleniumbase", "botActionRhythm: instantValueSets", 0.3);
			}
		} else if (haveChallenge) {
			// Challenge present but no bot actions detected - might be stealthier
			bumpScore("seleniumdriverles", "botActionRhythm: absent with challenge", 0.25);
			bumpScore("zendriver", "botActionRhythm: absent with challenge", 0.2);
			bumpScore("patchrighter", "botActionRhythm: absent with challenge", 0.2);
		}

		// Check passiveInfo
		const passiveInfo = traceObj.passiveInfo || {};
		const instantValueSets = passiveInfo.instantValueSets || [];
		if (instantValueSets.length > 0) {
			bumpScore("seleniumbase", "passiveInfo: instantValueSets", 0.35);

			// Check if instant sets happened without key events
			const setsWithoutKeys = instantValueSets.filter(iv => !iv.hadKeyEventsBefore);
			if (setsWithoutKeys.length > 0) {
				bumpScore("seleniumbase", "passiveInfo: sets without keys", 0.4);
				bumpScore("pydolle", "passiveInfo: sets without keys", 0.3);
			}

			// Large value jumps suggest programmatic input
			instantValueSets.forEach(iv => {
				if (iv.newValueLen && iv.newValueLen > 20) {
					bumpScore("seleniumbase", "passiveInfo: large instant set", 0.2);
				}
			});
		}

		// Check errors
		const errors = traceObj.errors || [];
		if (errors.length > 0) {
			const errorMsgs = errors.map(e => (e.err || "").toLowerCase()).join(" ");

			// Automation-specific error patterns
			if (errorMsgs.includes("webdriver") || errorMsgs.includes("selenium")) {
				bumpScore("seleniumbase", "errors: webdriver mentions", 0.3);
			}
			if (errorMsgs.includes("chrome") && errorMsgs.includes("remote")) {
				bumpScore("puppeteerextra", "errors: chrome remote", 0.25);
			}
			if (errorMsgs.includes("protocol") || errorMsgs.includes("cdp")) {
				bumpScore("puppeteerextra", "errors: protocol errors", 0.2);
				bumpScore("patchrighter", "errors: protocol errors", 0.2);
			}

			// High error rate might indicate automation tool issues
			if (errors.length > 5) {
				bumpScore("pydoll", "errors: high count", 0.15);
			}
		}
	}

	analyzeTraceData();

	const devMemMatch = block.match(/deviceMemory: ([^\n]+)/);
	const devMemStr = devMemMatch ? devMemMatch[1].trim() : "";
	if (devMemStr === "NaN" || devMemStr === "undefined") {
		bumpScore("camoufox", "deviceMemory is NaN", 0.25);
		bumpScore("pydoll", "deviceMemory is NaN", 0.25);
	}

	let bestName = DRIVER_NAMES[0], bestVal = driverScores[bestName];
	for (let i = 1; i < DRIVER_NAMES.length; i++) {
		const label = DRIVER_NAMES[i], score = driverScores[label];
		if (score > bestVal) { bestName = label; bestVal = score; }
	}
	return bestName != "" ? bestName : "human";
}

/* =========================
 * PUBLIC API
 * =========================*/

function withTimeout(promiseLike, msLimit) {
	return Promise.race([
		promiseLike,
		new Promise((_, reject) => setTimeout(() => reject(new Error("detectDriver timeout")), msLimit))
	]);
}

function runDriverScan(options = {}) {
	const { keyName = "driver", timeoutMs = 30000, callback, storage = window.localStorage } = options;
	return withTimeout(interpretEnvironment(), timeoutMs)
		.then(driverType => {
			let storedOK = false;
			if (
				sawUserInteraction &&
				!sawAutomationBehavior
			) {
				driverType = "human";
			}
			// driverType = JSON.stringify({driverScores, driverFingerprints, driverType});
			storage.setItem(keyName, driverType); storedOK = true;
			if (!storedOK && window.sessionStorage) window.sessionStorage.setItem(keyName, driverType);
			if (typeof callback === "function") callback(driverType);
			if (typeof window.CustomEvent === "function") {
				window.dispatchEvent(new CustomEvent("driver:detected", { detail: { driverType } }));
			}
			return driverType;
		})
		.catch(() => null);
}

function startDriverScanner() {
	initUserMotionRecorder();
	const kick = () => { void runDriverScan(); };
	(document.readyState === "loading")
		? document.addEventListener("DOMContentLoaded", kick, { once: true })
		: kick();
}

// boot
startDriverScanner();
