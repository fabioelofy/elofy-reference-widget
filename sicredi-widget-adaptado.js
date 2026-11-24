;(function () {
	'use strict'

	var CHANNEL = 'elofy.external-scripts'
	var VERSION = 1
	var TOKEN_FUNCTION = 'theoReceiveToken'
	var CLOSED_SIZE = { width: 64, height: 64 }
	var OPEN_SIZE = { width: 420, height: 560 }

	var script = document.currentScript
	if (!script || window.__theoWidgetInitialized__) return
	window.__theoWidgetInitialized__ = true

	var appOrigin = script.getAttribute('data-elofy-origin')
	var apiBaseUrl = (script.getAttribute('data-api-base-url') || '').replace(/\/+$/, '')
	var agentPath = script.getAttribute('data-agent-path') || '/feedback-agent'
	if (!appOrigin || !/^https:\/\//.test(apiBaseUrl)) return

	var state = {
		token: null,
		open: false,
		sessionId: window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'theo-' + Date.now(),
	}

	var style = document.createElement('style')
	style.textContent = [
		'html,body{margin:0;height:100%;background:transparent;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
		'.theo-fab{position:fixed;right:6px;bottom:6px;width:52px;height:52px;border:none;border-radius:50%;',
		'background:linear-gradient(135deg,#1f6f42,#2d8a5d);color:#fff;font-size:22px;cursor:pointer}',
		'.theo-window{position:fixed;inset:0;display:none;flex-direction:column;background:#fff;border-radius:14px;',
		'border:1px solid #e5e7eb;overflow:hidden}',
		'.theo-window.open{display:flex}',
		'.theo-header{background:#1f6f42;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;font-weight:600}',
		'.theo-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:16px}',
		'.theo-body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc}',
		'.theo-msg{margin:8px 0;padding:10px 12px;border-radius:10px;max-width:85%;line-height:1.4;word-break:break-word}',
		'.theo-msg.bot{background:#eaf7ee;color:#0f172a;margin-right:auto}',
		'.theo-msg.user{background:#1f6f42;color:#fff;margin-left:auto}',
		'.theo-footer{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #e5e7eb}',
		'.theo-footer input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px}',
		'.theo-footer button{border:none;border-radius:10px;background:#1f6f42;color:#fff;font-weight:600;padding:10px 14px;cursor:pointer}',
		'.theo-status{font-size:12px;color:#64748b;padding:0 12px 8px}',
	].join('')
	document.head.appendChild(style)

	function element(tag, className, text) {
		var node = document.createElement(tag)
		if (className) node.className = className
		if (text) node.textContent = text
		return node
	}

	var fab = element('button', 'theo-fab', '✦')
	fab.type = 'button'
	fab.setAttribute('aria-label', 'Abrir assistente')

	var win = element('div', 'theo-window')
	win.setAttribute('aria-live', 'polite')
	var header = element('div', 'theo-header')
	header.appendChild(element('span', '', 'Assistente'))
	var closeButton = element('button', '', '✕')
	closeButton.type = 'button'
	closeButton.setAttribute('aria-label', 'Fechar chat')
	header.appendChild(closeButton)
	var body = element('div', 'theo-body')
	body.appendChild(element('div', 'theo-msg bot', 'Olá! Como posso ajudar?'))
	var status = element('div', 'theo-status')
	var footer = element('div', 'theo-footer')
	var input = element('input')
	input.type = 'text'
	input.maxLength = 500
	input.placeholder = 'Digite sua mensagem...'
	var send = element('button', '', 'Enviar')
	send.type = 'button'
	footer.appendChild(input)
	footer.appendChild(send)
	win.appendChild(header)
	win.appendChild(body)
	win.appendChild(status)
	win.appendChild(footer)
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

	function renderStatus() {
		status.textContent = state.token ? '' : 'Não identificado: entre no Elofy com a conta Microsoft para usar o assistente.'
		send.disabled = !state.token
		input.disabled = !state.token
	}

	function append(text, sender) {
		body.appendChild(element('div', 'theo-msg ' + sender, text))
		body.scrollTop = body.scrollHeight
	}

	function openPanel() {
		if (state.open) return
		state.open = true
		win.classList.add('open')
		fab.style.display = 'none'
		post('open')
		resize(OPEN_SIZE)
		input.focus()
	}

	function closePanel() {
		if (!state.open) return
		state.open = false
		win.classList.remove('open')
		fab.style.display = ''
		post('close')
		resize(CLOSED_SIZE)
	}

	function receiveToken(token) {
		state.token = typeof token === 'string' && token !== '' ? token : null
		renderStatus()
	}

	function ask(text) {
		if (!text || !state.token) return
		append(text, 'user')
		fetch(apiBaseUrl + agentPath, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
			body: JSON.stringify({
				session_id: state.sessionId,
				message: text,
				interaction_source: 'input_livre',
				timestamp: new Date().toISOString(),
			}),
		})
			.then(function (response) {
				if (!response.ok) throw new Error(String(response.status))
				return response.json()
			})
			.then(function (result) {
				append(result.assistant_answer || result.answer || 'Resposta indisponível.', 'bot')
			})
			.catch(function () {
				append('Não foi possível processar sua mensagem no momento.', 'bot')
			})
	}

	function submit() {
		var value = input.value.trim()
		input.value = ''
		ask(value)
	}

	fab.addEventListener('click', openPanel)
	closeButton.addEventListener('click', closePanel)
	send.addEventListener('click', submit)
	input.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') submit()
	})

	window.addEventListener('message', function (event) {
		var data = event.data
		if (event.source !== window.parent || event.origin !== appOrigin) return
		if (!data || data.channel !== CHANNEL || data.v !== VERSION) return
		if (data.type === 'close_request') closePanel()
	})

	window[TOKEN_FUNCTION] = receiveToken
	receiveToken(null)
	resize(CLOSED_SIZE)
})()
