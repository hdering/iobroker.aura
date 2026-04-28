'use strict';

const http  = require('node:http');
const https = require('node:https');

// Headers that prevent iframe embedding — stripped from proxy responses
const STRIP_HEADERS = new Set([
    'x-frame-options',
    'content-security-policy',
    'x-content-type-options',
    'x-xss-protection',
    'cross-origin-resource-policy',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
]);

const TIMEOUT_MS = 15_000;
// Proxy path prefix used to detect same-origin WS URLs constructed by apps
const PROXY_PATH = '/aura/proxy';

// ── HTML / CSS rewriting ──────────────────────────────────────────────────────

function rewriteHtml(html, baseUrl) {
    function toProxy(url) {
        if (!url) return url;
        const trimmed = url.trim();
        if (/^(data:|javascript:|blob:|mailto:|tel:|#)/.test(trimmed)) return url;
        try {
            const abs = new URL(trimmed, baseUrl).toString();
            return '/aura/proxy?url=' + encodeURIComponent(abs);
        } catch { return url; }
    }

    // Split the document into alternating [outside-script, script-content] segments
    // so we never rewrite URLs inside <script>...</script> or <style>...</style> blocks.
    // Regex: match <script...>...</script> or <style...>...</style> (non-greedy, dotAll)
    const SKIP_RE = /(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)>)/gi;

    function rewriteSegment(seg, isFirstSegment) {
        // Remove any existing <base> tag, then inject <base href="/"> so SPA
        // routers (Angular, Vue, React) resolve routes from "/" without any
        // history.replaceState manipulation (which caused popstate events to
        // fire on the parent Aura window, briefly re-rendering without widgets).
        let out = seg.replace(/<base\b[^>]*>/gi, '');
        if (isFirstSegment) {
            out = out.replace(/(<head\b[^>]*>)/i, '$1<base href="/">');
        }

        // Rewrite src=, href=, action= on HTML tags only
        out = out.replace(
            /\b(src|href|action)(\s*=\s*)(["'])([^"']*)\3/gi,
            (_, attr, eq, q, url) => `${attr}${eq}${q}${toProxy(url)}${q}`,
        );
        // Add explicit action to <form> tags without one (e.g. Django login template)
        out = out.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
            if (/\baction\s*=/i.test(attrs)) return match;
            return `<form${attrs} action="${toProxy(baseUrl)}">`;
        });
        // Rewrite srcset
        out = out.replace(
            /\bsrcset(\s*=\s*)(["'])([^"']*)\2/gi,
            (_, eq, q, val) => {
                const rw = val.replace(/([^,\s]+)(\s*(?:[^,]*))/g, (m, url, rest) => toProxy(url) + rest);
                return `srcset${eq}${q}${rw}${q}`;
            },
        );
        return out;
    }

    // Split on script/style blocks, rewrite only the HTML parts.
    // isFirstSegment=true on the first part so <base href="/"> is injected once.
    const parts = [];
    let last = 0;
    let m;
    let firstSegment = true;
    SKIP_RE.lastIndex = 0;
    while ((m = SKIP_RE.exec(html)) !== null) {
        parts.push(rewriteSegment(html.slice(last, m.index), firstSegment));
        firstSegment = false;
        parts.push(rewriteSegment(m[1]) + m[2] + m[3]); // rewrite attrs in opening tag, leave content untouched
        last = m.index + m[0].length;
    }
    parts.push(rewriteSegment(html.slice(last), firstSegment));
    let out = parts.join('');

    // Inject interceptors for WebSocket, XHR and fetch so any same-origin
    // request made by the app's JS is routed back through /aura/proxy.
    const targetOrigin = new URL(baseUrl).origin;
    const tgtNoProto = targetOrigin.replace(/^https?:/, '');  // e.g. //192.168.188.22:8000
    const wsProto    = targetOrigin.startsWith('https:') ? 'wss:' : 'ws:';
    const wsSnippet  = `<script>(function(){` +
        `var tgt=${JSON.stringify(targetOrigin)},tgtNP=${JSON.stringify(tgtNoProto)},wsp=${JSON.stringify(wsProto)};` +
        // Reset pathname to '/' so apps (Angular, Paperless etc.) that construct
        // URLs via location.pathname + 'api/...' or location.pathname + 'ws/...'
        // don't embed '/aura/proxy' in those URLs.
        // replaceState does NOT fire popstate, so the parent Aura window is unaffected.
        `history.replaceState(history.state,'','/');` +
        // rw(url): rewrite same-origin non-proxy requests and target-origin
        // requests to go through /aura/proxy.
        // Guard: only skip URLs that are already going through OUR proxy endpoints
        // (/aura/proxy… or /aura/proxyws…). Do NOT skip other /aura/… paths —
        // they might be app paths that landed here because location.pathname was
        // '/aura/proxy' before the replaceState above ran.
        `function rw(u){` +
            `try{` +
                `var s=String(u);` +
                `if(s.startsWith('/aura/proxy'))return u;` + // already proxied — leave alone
                // Absolute path — map directly to target origin
                `if(s.charAt(0)==='/'&&s.charAt(1)!=='/'){` +
                    `return '/aura/proxy?url='+encodeURIComponent(tgt+s);` +
                `}` +
                `var a=new URL(s,location.href);` +
                `if((a.origin===location.origin&&!a.pathname.startsWith('/aura/proxy'))||a.origin===tgt){` +
                    `return '/aura/proxy?url='+encodeURIComponent(tgt+a.pathname+a.search+a.hash);` +
                `}` +
            `}catch(e){}` +
            `return u;` +
        `}` +
        // WebSocket interceptor
        `var _W=window.WebSocket;` +
        `window.WebSocket=function(u,p){` +
            `try{` +
                `var a=new URL(u.replace(/^wss?:/,'https:'),location.href);` +
                // Skip if already routed through our WS proxy
                `if(a.pathname.startsWith('/aura/proxyws'))return new _W(u,p);` +
                `if(a.origin===location.origin||a.origin===tgt){` +
                    `u='/aura/proxyws?url='+encodeURIComponent(wsp+tgtNP+a.pathname+(a.search||''));` +
                `}` +
            `}catch(e){}` +
            `return new _W(u,p);` +
        `};` +
        `Object.assign(window.WebSocket,_W);` +
        // XHR
        `var _xo=XMLHttpRequest.prototype.open;` +
        `XMLHttpRequest.prototype.open=function(){` +
            `if(arguments[1])arguments[1]=rw(String(arguments[1]));` +
            `return _xo.apply(this,arguments);` +
        `};` +
        // fetch
        `var _f=window.fetch;` +
        `if(_f)window.fetch=function(r,o){` +
            `if(typeof r==='string')r=rw(r);` +
            `return _f.call(window,r,o);` +
        `};` +
        // location.href setter (direct navigation: window.location.href = '/accounts/logout/')
        `try{` +
            `var _lp=Object.getPrototypeOf(location),_hd=Object.getOwnPropertyDescriptor(_lp,'href');` +
            `if(_hd&&_hd.set)Object.defineProperty(_lp,'href',{get:_hd.get,set:function(u){_hd.set.call(this,rw(String(u)));},configurable:true});` +
        `}catch(e){}` +
        // location.assign / location.replace
        `['assign','replace'].forEach(function(m){` +
            `var o=location[m].bind(location);` +
            `try{location[m]=function(u){o(rw(u));};}catch(e){}` +
        `});` +
        // click listener for <a> tags rendered dynamically by the SPA.
        // Uses BUBBLE phase (false) so Angular's RouterLink directive fires
        // first (capture/early-bubble) and calls e.preventDefault() for
        // internal SPA routes. We skip those (defaultPrevented=true) and only
        // intercept server-side links (logout, login redirects etc.) that
        // Angular does not handle — preventing full-page-reload flicker.
        `document.addEventListener('click',function(e){` +
            `if(e.defaultPrevented)return;` +
            `var el=e.target;` +
            `while(el&&el.tagName!=='A')el=el.parentElement;` +
            `if(!el)return;` +
            `var h=el.getAttribute('href');` +
            `if(!h)return;` +
            `var rh=rw(h);` +
            `if(rh!==h){e.preventDefault();location.href=rh;}` +
        `},false);` +
        // submit listener for dynamically rendered forms without action attribute
        `document.addEventListener('submit',function(e){` +
            `var form=e.target;` +
            `if(!form||form.tagName!=='FORM')return;` +
            `var act=form.getAttribute('action')||'';` +
            `if(act.indexOf('/aura/')===0)return;` +
            `var abs=form.action;` +
            `var rh=rw(abs);` +
            `if(rh!==abs){e.preventDefault();form.setAttribute('action',rh);form.submit();}` +
        `},true);` +
        // MutationObserver: rewrite src= on dynamically created/updated elements
        // (Angular sets img.src via [src] bindings — not caught by XHR/fetch interceptors)
        `try{` +
            `function rwAttr(el,a){var v=el.getAttribute&&el.getAttribute(a);if(v){var r=rw(v);if(r!==v)el.setAttribute(a,r);}}` +
            `function rwTree(n){` +
                `if(n.nodeType!==1)return;` +
                `rwAttr(n,'src');` +
                `try{n.querySelectorAll('[src]').forEach(function(c){rwAttr(c,'src');});}catch(e){}` +
            `}` +
            `var _mo=new MutationObserver(function(muts){` +
                `muts.forEach(function(m){` +
                    `if(m.type==='attributes'){rwAttr(m.target,m.attributeName);}` +
                    `else{m.addedNodes.forEach(rwTree);}` +
                `});` +
            `});` +
            `_mo.observe(document,{attributes:true,attributeFilter:['src'],childList:true,subtree:true});` +
        `}catch(e){}` +
        `})();</script>`;

    // Inject before </head> or at the very start
    if (/<\/head>/i.test(out)) {
        out = out.replace(/<\/head>/i, `${wsSnippet}</head>`);
    } else if (/<head>/i.test(out)) {
        out = out.replace(/<head>/i, `<head>${wsSnippet}`);
    } else {
        out = wsSnippet + out;
    }

    return out;
}

function rewriteCss(css, baseUrl) {
    function toProxy(url) {
        const trimmed = url.replace(/^['"]|['"]$/g, '').trim();
        if (!trimmed || /^(data:|#)/.test(trimmed)) return url;
        try {
            return `'${'/aura/proxy?url=' + encodeURIComponent(new URL(trimmed, baseUrl).toString())}'`;
        } catch { return url; }
    }
    return css.replace(/url\(([^)]*)\)/gi, (_, inner) => `url(${toProxy(inner)})`);
}

function bufferResponse(proxyRes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        proxyRes.on('data', c => chunks.push(c));
        proxyRes.on('end', () => resolve(Buffer.concat(chunks)));
        proxyRes.on('error', reject);
    });
}

// ── HTTP proxy ────────────────────────────────────────────────────────────────

function buildFwdHeaders(req) {
    const h = {
        'Accept':          req.headers['accept']          || 'text/html,*/*',
        'Accept-Language': req.headers['accept-language'] || 'en',
        'User-Agent':      'Mozilla/5.0 (ioBroker-Aura)',
    };
    // Forward relevant client headers
    for (const k of ['content-type', 'content-length', 'cookie',
                      'x-csrftoken', 'x-requested-with']) {
        if (req.headers[k]) h[k.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('-')] = req.headers[k];
    }
    return h;
}

function buildHeaders(incoming) {
    const out = {};
    for (const [key, val] of Object.entries(incoming)) {
        if (!STRIP_HEADERS.has(key.toLowerCase())) out[key] = val;
    }
    return out;
}

// ── WebSocket proxy ───────────────────────────────────────────────────────────

function proxyWebSocket(req, socket, targetWsUrl, adapter) {
    let targetUrl;
    try {
        targetUrl = new URL(targetWsUrl);
        if (!['ws:', 'wss:'].includes(targetUrl.protocol)) throw new Error('Only ws/wss');
    } catch (e) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
    }

    const isSecure = targetUrl.protocol === 'wss:';
    const lib = isSecure ? https : http;
    const opts = {
        hostname: targetUrl.hostname,
        port:     targetUrl.port || (isSecure ? 443 : 80),
        path:     targetUrl.pathname + (targetUrl.search || ''),
        method:   'GET',
        headers:  {
            Connection:             'Upgrade',
            Upgrade:                'websocket',
            Host:                   targetUrl.host,
            'Sec-WebSocket-Version': req.headers['sec-websocket-version'] || '13',
            'Sec-WebSocket-Key':     req.headers['sec-websocket-key'],
        },
        rejectUnauthorized: false,
    };
    if (req.headers['sec-websocket-protocol']) {
        opts.headers['Sec-WebSocket-Protocol'] = req.headers['sec-websocket-protocol'];
    }
    if (req.headers['cookie']) opts.headers['Cookie'] = req.headers['cookie'];

    const proxyReq = lib.request(opts);
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        const lines = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${proxyRes.headers['sec-websocket-accept']}`,
        ];
        if (proxyRes.headers['sec-websocket-protocol']) {
            lines.push(`Sec-WebSocket-Protocol: ${proxyRes.headers['sec-websocket-protocol']}`);
        }
        socket.write(lines.join('\r\n') + '\r\n\r\n');
        if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
        proxySocket.on('error', () => socket.destroy());
        socket.on('error',      () => proxySocket.destroy());
    });
    proxyReq.on('error', e => {
        adapter.log.debug(`aura: WS proxy error for ${targetWsUrl}: ${e.message}`);
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
    });
    proxyReq.end();
}

// ── Extension entry point ─────────────────────────────────────────────────────

class webExtension {
    constructor(server, webSettings, adapter, instanceSettings, app) {

        // ── HTTP(S) proxy ─────────────────────────────────────────────────────
        app.all('/aura/proxy', (req, res) => {
            const urlParam = req.query && req.query.url;
            if (!urlParam || typeof urlParam !== 'string') {
                res.status(400).send('Missing url parameter');
                return;
            }

            let targetUrl;
            try {
                targetUrl = new URL(urlParam);
                if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error('Only http/https allowed');
            } catch (e) {
                res.status(400).send(`Invalid proxy URL: ${e.message}`);
                return;
            }

            const lib = targetUrl.protocol === 'https:' ? https : http;
            const fwdHeaders = buildFwdHeaders(req);
            // Override Referer to the target origin so Django CSRF passes
            fwdHeaders['Referer'] = targetUrl.origin + '/';

            const reqOptions = {
                hostname: targetUrl.hostname,
                port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path:     targetUrl.pathname + targetUrl.search,
                method:   req.method,
                timeout:  TIMEOUT_MS,
                headers:  fwdHeaders,
                rejectUnauthorized: false,
            };

            const proxyReq = lib.request(reqOptions, (proxyRes) => {
                if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
                    const absLocation = new URL(proxyRes.headers.location, targetUrl.toString()).toString();
                    const rh = buildHeaders(proxyRes.headers);
                    rh['location'] = `/aura/proxy?url=${encodeURIComponent(absLocation)}`;
                    res.writeHead(proxyRes.statusCode, rh);
                    res.end();
                    return;
                }

                const ct = (proxyRes.headers['content-type'] || '').toLowerCase();
                const isHtml = ct.includes('text/html');
                const isCss  = ct.includes('text/css');

                if (isHtml || isCss) {
                    const resHeaders = buildHeaders(proxyRes.headers);
                    delete resHeaders['content-length'];
                    bufferResponse(proxyRes).then(buf => {
                        const charset = (ct.match(/charset=([^\s;]+)/) || [])[1] || 'utf-8';
                        const enc = charset.toLowerCase() === 'utf-8' ? 'utf8' : 'latin1';
                        let text = buf.toString(enc);
                        text = isHtml
                            ? rewriteHtml(text, targetUrl.toString())
                            : rewriteCss(text, targetUrl.toString());
                        res.writeHead(proxyRes.statusCode || 200, resHeaders);
                        res.end(text, enc);
                    }).catch(e => {
                        if (!res.headersSent) res.status(502).send(`Proxy rewrite error: ${e.message}`);
                    });
                } else {
                    const resHeaders = buildHeaders(proxyRes.headers);
                    res.writeHead(proxyRes.statusCode || 200, resHeaders);
                    proxyRes.pipe(res, { end: true });
                }
            });

            proxyReq.on('timeout', () => { proxyReq.destroy(); if (!res.headersSent) res.status(504).send('Proxy timeout'); });
            proxyReq.on('error',   e  => { if (!res.headersSent) res.status(502).send(`Proxy error: ${e.message}`); });
            req.pipe(proxyReq, { end: true });
        });

        // ── WebSocket proxy ───────────────────────────────────────────────────
        server.on('upgrade', (req, socket, head) => {
            let parsedUrl;
            try { parsedUrl = new URL(req.url, 'http://localhost'); } catch { return; }
            if (parsedUrl.pathname !== '/aura/proxyws') return;

            const targetWsUrl = parsedUrl.searchParams.get('url');
            if (!targetWsUrl) { socket.destroy(); return; }

            proxyWebSocket(req, socket, targetWsUrl, adapter);
        });

        adapter.log.info('aura: proxy routes /aura/proxy and /aura/proxyws registered');
    }
}

module.exports = webExtension;
