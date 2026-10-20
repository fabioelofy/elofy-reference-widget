;(function () {
	const CHANNEL = 'elofy.external-scripts'
	const VERSION = 1
	const BUTTON_SIZE = { width: 64, height: 64 }
	const PANEL_SIZE = { width: 360, height: 480 }
	const TOKEN_ATTRIBUTE = 'data-elofy-token'
	const TOKEN_FUNCTION = 'elofyReferenceWidgetToken'
	const CLAIM_LABELS = {
		user_id: 'ID do usuário',
		user_name: 'Nome',
		job_title: 'Cargo',
		company_id: 'ID da empresa',
		company_name: 'Empresa',
	}

	const script = document.currentScript
	if (!script || window.parent === window) return

	const appOrigin = script.getAttribute('data-elofy-origin')
	if (!appOrigin) return

	const memory = {}
	const storage = {
		get: function (key) {
			try {
				return window.localStorage.getItem(key)
			} catch (error) {
				return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null
			}
		},
		set: function (key, value) {
			try {
				window.localStorage.setItem(key, value)
			} catch (error) {
				memory[key] = value
			}
		},
	}

	const config = {}
	Array.prototype.forEach.call(script.attributes, attribute => {
		if (attribute.name.indexOf('data-') === 0 && attribute.name !== TOKEN_ATTRIBUTE) {
			config[attribute.name] = attribute.value
		}
	})

	const state = { open: false, token: null }

	function send(type, extra) {
		const message = { channel: CHANNEL, v: VERSION, type: type }
		Object.keys(extra || {}).forEach(key => {
			message[key] = extra[key]
		})
		window.parent.postMessage(message, appOrigin)
	}

	function resize(size) {
		send('resize', { width: size.width, height: size.height })
	}

	const root = document.createElement('div')
	root.setAttribute('data-reference-widget', 'root')

	const button = document.createElement('button')
	button.setAttribute('type', 'button')
	button.setAttribute('data-reference-widget', 'button')
	button.setAttribute('aria-expanded', 'false')
	button.textContent = config['data-label'] || 'Chat'
	button.style.cssText =
		'width:56px;height:56px;margin:4px;border:0;border-radius:28px;background:#1f6feb;color:#fff;cursor:pointer;font:600 13px sans-serif'

	const panel = document.createElement('div')
	panel.setAttribute('data-reference-widget', 'panel')
	panel.setAttribute('role', 'dialog')
	panel.hidden = true
	panel.style.cssText =
		'box-sizing:border-box;width:352px;height:472px;margin:4px;padding:16px;border-radius:12px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.2);font:14px sans-serif;color:#1d2939'

	const title = document.createElement('strong')
	title.textContent = config['data-title'] || 'Widget de referência'

	const status = document.createElement('p')
	status.setAttribute('data-reference-widget', 'status')

	const claims = document.createElement('dl')
	claims.setAttribute('data-reference-widget', 'claims')
	claims.style.cssText = 'margin:0 0 12px;font:13px sans-serif'

	const close = document.createElement('button')
	close.setAttribute('type', 'button')
	close.setAttribute('data-reference-widget', 'close')
	close.textContent = 'Fechar'

	panel.appendChild(title)
	panel.appendChild(status)
	panel.appendChild(claims)
	panel.appendChild(close)
	root.appendChild(button)
	root.appendChild(panel)
	document.body.appendChild(root)

	function decodeClaims(token) {
		try {
			const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
			const json = decodeURIComponent(
				Array.prototype.map
					.call(window.atob(payload), char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
					.join(''),
			)
			return JSON.parse(json)
		} catch (error) {
			return {}
		}
	}

	function renderClaims() {
		while (claims.firstChild) claims.removeChild(claims.firstChild)
		const payload = state.token ? decodeClaims(state.token) : {}
		Object.keys(CLAIM_LABELS).forEach(key => {
			if (payload[key] === undefined) return
			const term = document.createElement('dt')
			term.style.cssText = 'color:#667085'
			term.textContent = CLAIM_LABELS[key]
			const value = document.createElement('dd')
			value.style.cssText = 'margin:0 0 6px'
			value.setAttribute('data-claim', key)
			value.textContent = String(payload[key])
			claims.appendChild(term)
			claims.appendChild(value)
		})
	}

	function render() {
		const visits = Number(storage.get('reference-widget-visits') || 0)
		status.textContent = state.token
			? 'Identificado pelo Elofy. Dados lidos do token sem validar: valide a assinatura no seu servidor pelo JWKS.'
			: 'Sem identificação.'
		renderClaims()
		status.setAttribute('data-visits', String(visits))
		status.setAttribute('data-identified', state.token ? 'true' : 'false')
	}

	function openPanel() {
		if (state.open) return
		state.open = true
		storage.set('reference-widget-visits', String(Number(storage.get('reference-widget-visits') || 0) + 1))
		button.hidden = true
		panel.hidden = false
		button.setAttribute('aria-expanded', 'true')
		render()
		send('open')
		resize(PANEL_SIZE)
	}

	function closePanel() {
		if (!state.open) return
		state.open = false
		panel.hidden = true
		button.hidden = false
		button.setAttribute('aria-expanded', 'false')
		send('close')
		resize(BUTTON_SIZE)
	}

	function receiveToken(token) {
		if (typeof token !== 'string' || token === '') return
		state.token = token
		render()
	}

	button.addEventListener('click', openPanel)
	close.addEventListener('click', closePanel)

	window.addEventListener('message', event => {
		const data = event.data
		if (event.source !== window.parent || event.origin !== appOrigin) return
		if (!data || typeof data !== 'object' || data.channel !== CHANNEL || data.v !== VERSION) return
		if (data.type === 'close_request') closePanel()
	})

	window[TOKEN_FUNCTION] = receiveToken
	if (window.MutationObserver) {
		new window.MutationObserver(() => {
			receiveToken(script.getAttribute(TOKEN_ATTRIBUTE))
		}).observe(script, { attributes: true, attributeFilter: [TOKEN_ATTRIBUTE] })
	}
	receiveToken(script.getAttribute(TOKEN_ATTRIBUTE))

	render()
	resize(BUTTON_SIZE)
})()
