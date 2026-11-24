;(function () {
	'use strict'

	var CHANNEL = 'elofy.external-scripts'
	var VERSION = 1
	var TOKEN_FUNCTION = 'theoReceiveToken'
	var ELOFY_CLIENT_ID = '6b20818b-5068-4815-925a-33e61842f736'
	var CLOSED_SIZE = { width: 64, height: 64 }
	var OPEN_SIZE = { width: 440, height: 600 }

	var script = document.currentScript
	if (!script || window.__entraTokenChecker__) return
	window.__entraTokenChecker__ = true

	var appOrigin = script.getAttribute('data-elofy-origin')
	if (!appOrigin) return

	var expected = {
		tenant: (script.getAttribute('data-expected-tenant') || '').toLowerCase(),
		audience: script.getAttribute('data-expected-audience') || '',
		scope: script.getAttribute('data-expected-scope') || '',
		client: (script.getAttribute('data-expected-client') || ELOFY_CLIENT_ID).toLowerCase(),
	}
	var label = script.getAttribute('data-label') || 'Token Entra'

	var state = { open: false, received: 0, lastAt: null, result: null }

	var style = document.createElement('style')
	style.textContent = [
		'html,body{margin:0;height:100%;background:transparent;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
		'.etc-fab{position:fixed;right:6px;bottom:6px;width:52px;height:52px;border:none;border-radius:50%;',
		'background:#3b3fd8;color:#fff;font-size:12px;font-weight:700;cursor:pointer}',
		'.etc-fab[data-status=ok]{background:#1f7a46}.etc-fab[data-status=fail]{background:#b42318}',
		'.etc-win{position:fixed;inset:0;display:none;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}',
		'.etc-win.open{display:flex}',
		'.etc-head{background:#3b3fd8;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;font-weight:600}',
		'.etc-head button{background:none;border:none;color:#fff;cursor:pointer;font-size:16px}',
		'.etc-body{flex:1;overflow-y:auto;padding:12px;font-size:13px;color:#0f172a}',
		'.etc-meta{color:#64748b;margin-bottom:8px}',
		'.etc-check{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9}',
		'.etc-check b{min-width:18px}.etc-check .ok{color:#1f7a46}.etc-check .fail{color:#b42318}.etc-check .skip{color:#a16207}',
		'.etc-detail{color:#475569;word-break:break-all}',
		'pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;white-space:pre-wrap;word-break:break-all;font-size:12px}',
	].join('')
	document.head.appendChild(style)

	function el(tag, className, text) {
		var node = document.createElement(tag)
		if (className) node.className = className
		if (text !== undefined) node.textContent = text
		return node
	}

	var fab = el('button', 'etc-fab', 'JWT')
	fab.type = 'button'
	fab.setAttribute('aria-label', 'Abrir ' + label)
	var win = el('div', 'etc-win')
	var head = el('div', 'etc-head')
	head.appendChild(el('span', '', label))
	var closeButton = el('button', '', '✕')
	closeButton.type = 'button'
	closeButton.setAttribute('aria-label', 'Fechar')
	head.appendChild(closeButton)
	var body = el('div', 'etc-body')
	win.appendChild(head)
	win.appendChild(body)
	document.body.appendChild(fab)
	document.body.appendChild(win)

	function post(type, extra) {
		var message = { channel: CHANNEL, v: VERSION, type: type }
		for (var key in extra || {}) message[key] = extra[key]
		window.parent.postMessage(message, appOrigin)
	}

	function resize(size) {
		post('resize', { width: size.width, height: size.height })
	}

	function openPanel() {
		if (state.open) return
		state.open = true
		win.classList.add('open')
		fab.style.display = 'none'
		post('open')
		resize(OPEN_SIZE)
	}

	function closePanel() {
		if (!state.open) return
		state.open = false
		win.classList.remove('open')
		fab.style.display = ''
		post('close')
		resize(CLOSED_SIZE)
	}

	function base64UrlToBytes(value) {
		var b64 = value.replace(/-/g, '+').replace(/_/g, '/')
		while (b64.length % 4) b64 += '='
		var raw = atob(b64)
		var bytes = new Uint8Array(raw.length)
		for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
		return bytes
	}

	function decodeJson(part) {
		return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)))
	}

	function check(name, status, detail) {
		return { name: name, status: status, detail: detail || '' }
	}

	function claimChecks(payload) {
		var now = Math.floor(Date.now() / 1000)
		var checks = []
		var tid = String(payload.tid || '').toLowerCase()
		var azp = String(payload.azp || payload.appid || '').toLowerCase()
		var scopes = String(payload.scp || '').split(' ')

		checks.push(
			expected.tenant
				? check('tid = tenant esperado', tid === expected.tenant ? 'ok' : 'fail', payload.tid)
				: check('tid', 'skip', (payload.tid || '-') + ' (sem data-expected-tenant)')
		)
		checks.push(
			expected.audience
				? check('aud = audiência esperada', payload.aud === expected.audience ? 'ok' : 'fail', payload.aud)
				: check('aud', 'skip', (payload.aud || '-') + ' (sem data-expected-audience)')
		)
		checks.push(
			expected.scope
				? check('scp contém ' + expected.scope, scopes.indexOf(expected.scope) !== -1 ? 'ok' : 'fail', payload.scp)
				: check('scp', 'skip', (payload.scp || '-') + ' (sem data-expected-scope)')
		)
		checks.push(check('azp/appid = client do Elofy', azp === expected.client ? 'ok' : 'fail', azp || '-'))
		checks.push(
			check(
				'exp no futuro',
				payload.exp > now ? 'ok' : 'fail',
				payload.exp ? new Date(payload.exp * 1000).toLocaleString('pt-BR') + ' (' + (payload.exp - now) + 's)' : '-'
			)
		)
		checks.push(check('nbf já passou', !payload.nbf || payload.nbf <= now + 60 ? 'ok' : 'fail', payload.nbf || '-'))
		var issOk = tid && (payload.iss === 'https://sts.windows.net/' + tid + '/' || payload.iss === 'https://login.microsoftonline.com/' + tid + '/v2.0')
		checks.push(check('iss do tenant do token', issOk ? 'ok' : 'fail', payload.iss))
		return checks
	}

	function verifySignature(parts, header, payload) {
		if (header.alg !== 'RS256') return Promise.resolve(check('assinatura', 'fail', 'alg ' + header.alg + ' (esperado RS256)'))
		if (header.nonce) return Promise.resolve(check('assinatura', 'skip', 'token com nonce (Graph): não verificável fora da Microsoft'))
		if (!window.crypto || !crypto.subtle) return Promise.resolve(check('assinatura', 'skip', 'WebCrypto indisponível neste contexto'))

		var jwksUrl = 'https://login.microsoftonline.com/' + encodeURIComponent(payload.tid || 'common') + '/discovery/v2.0/keys'
		return fetch(jwksUrl)
			.then(function (response) {
				if (!response.ok) throw new Error('JWKS HTTP ' + response.status)
				return response.json()
			})
			.then(function (jwks) {
				var jwk = (jwks.keys || []).filter(function (key) {
					return key.kid === header.kid
				})[0]
				if (!jwk) return check('assinatura', 'fail', 'kid ' + header.kid + ' não está no JWKS do tenant')
				return crypto.subtle
					.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
					.then(function (key) {
						return crypto.subtle.verify(
							'RSASSA-PKCS1-v1_5',
							key,
							base64UrlToBytes(parts[2]),
							new TextEncoder().encode(parts[0] + '.' + parts[1])
						)
					})
					.then(function (valid) {
						return check('assinatura (JWKS do tenant)', valid ? 'ok' : 'fail', 'kid ' + header.kid)
					})
			})
			.catch(function (error) {
				return check('assinatura', 'skip', 'não verificada: ' + error.message + ' (login.microsoftonline.com em Domínios de conexão?)')
			})
	}

	function render() {
		body.textContent = ''
		var meta = el(
			'div',
			'etc-meta',
			state.received
				? 'Tokens recebidos: ' + state.received + ' · último às ' + state.lastAt.toLocaleTimeString('pt-BR')
				: 'Nenhum token recebido ainda. No modo Entra, entre no Elofy pelo login Microsoft.'
		)
		body.appendChild(meta)
		if (!state.result) return

		state.result.checks.forEach(function (item) {
			var row = el('div', 'etc-check')
			row.appendChild(el('b', item.status, item.status === 'ok' ? '✓' : item.status === 'fail' ? '✗' : '–'))
			var text = el('div')
			text.appendChild(el('div', '', item.name))
			if (item.detail) text.appendChild(el('div', 'etc-detail', String(item.detail)))
			row.appendChild(text)
			body.appendChild(row)
		})

		if (state.result.claims) {
			body.appendChild(el('div', 'etc-meta', 'Claims (o token em si não é exibido):'))
			body.appendChild(el('pre', '', JSON.stringify(state.result.claims, null, 2)))
		}
	}

	function receiveToken(token) {
		if (typeof token !== 'string' || token === '') return
		state.received += 1
		state.lastAt = new Date()

		var parts = token.split('.')
		var header
		var payload
		try {
			if (parts.length !== 3) throw new Error('não tem 3 partes')
			header = decodeJson(parts[0])
			payload = decodeJson(parts[1])
		} catch (error) {
			state.result = { checks: [check('formato JWT', 'fail', error.message)], claims: null }
			fab.setAttribute('data-status', 'fail')
			render()
			return
		}

		var checks = [check('formato JWT', 'ok', 'alg ' + header.alg + ' · kid ' + header.kid)].concat(claimChecks(payload))
		state.result = { checks: checks, claims: payload }
		render()

		verifySignature(parts, header, payload).then(function (signature) {
			state.result.checks.push(signature)
			var failed = state.result.checks.some(function (item) {
				return item.status === 'fail'
			})
			fab.setAttribute('data-status', failed ? 'fail' : 'ok')
			render()
		})
	}

	fab.addEventListener('click', openPanel)
	closeButton.addEventListener('click', closePanel)

	window.addEventListener('message', function (event) {
		var data = event.data
		if (event.source !== window.parent || event.origin !== appOrigin) return
		if (!data || data.channel !== CHANNEL || data.v !== VERSION) return
		if (data.type === 'close_request') closePanel()
	})

	window[TOKEN_FUNCTION] = receiveToken
	render()
	resize(CLOSED_SIZE)
})()
