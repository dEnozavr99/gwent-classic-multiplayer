/*
 * PROTOTYPE (#4, main menu): THROWAWAY. Lives on branch prototype/main-menu only.
 *
 * Question: what should the Main menu and the Player vs Player entry look like?
 * Three structurally different variants, switchable with ?variant=A|B|C (or the bottom bar / arrow keys),
 * mounted in front of the REAL index.html so the real deck-maker and board sit behind them.
 *
 * Everything here is mock: no networking, no rules. The simulator panel (bottom right) fires the events
 * you cannot trigger alone: opponent joins / readies / leaves, finishing a Game.
 * The Lobby is the real deck-maker with Start game -> Ready and the Opponent's Deck panel -> opponent status.
 */
(() => {
'use strict';

const KEYS = ['A', 'B', 'C'];
const NAMES = { A: 'Stacked menu', B: 'Split doors', C: 'Flip cards' };
let variant = KEYS.includes(new URLSearchParams(location.search).get('variant')) ? new URLSearchParams(location.search).get('variant') : 'A';

// ---------- mock state ----------
const fresh = () => ({
	screen: 'menu',   // menu | entry | waiting | deck (Player vs AI) | lobby | game | end
	mode: null,       // null | 'ai' | 'room'
	joinCode: '', error: '', code: '', isHost: false,
	opp: { present: false, ready: false, name: 'Triss' },
	meReady: false,
});
const P = Object.assign(fresh(), { name: '', pvpEnabled: true });

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOk = () => P.name.trim().length > 0;
const genCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const roomLink = () => `${location.origin === 'null' ? 'file://' : location.origin}${location.pathname}#room=${P.code}`;

// ---------- DOM scaffolding ----------
const dc = $('#deck-customization');
const es = $('#end-screen');
const startBtn = $('#start-game');
const root = Object.assign(document.createElement('div'), { id: 'pm-root' });
const back = Object.assign(document.createElement('a'), { id: 'pm-back' });
const gameBanner = Object.assign(document.createElement('div'), { id: 'pm-game' });
const bar = Object.assign(document.createElement('div'), { id: 'pm-bar' });
const sim = Object.assign(document.createElement('div'), { id: 'pm-sim' });
document.body.append(root, back, gameBanner, bar, sim);

const oppBlock = document.createElement('div');
oppBlock.id = 'pm-opp';
oppBlock.innerHTML = '<span class="pm-lbl">Opponent:</span><span class="pm-name"></span><span class="pm-chip"></span>';
$('#opponent-preview').appendChild(oppBlock);

const endStatus = Object.assign(document.createElement('div'), { id: 'pm-end-status' });
es.appendChild(endStatus);

gameBanner.innerHTML = '<span>Game in progress (stub)</span><button data-pm="exit">Exit game</button><button data-pm="finish">Finish game</button>';

// ---------- shared fragments ----------
const nameInput = () => `<input class="pm-input" data-input="name" maxlength="20" placeholder="Your name" autocomplete="off" value="${esc(P.name)}">`;
const codeInput = () => `<input class="pm-input pm-code-in" data-input="code" maxlength="8" placeholder="Room code" autocomplete="off" value="${esc(P.joinCode)}">`;
const gateHint = () => '<div class="pm-hint" data-gate-hint>Enter a name to create or join a Room</div>';
const errorLine = () => `<div class="pm-error">${esc(P.error)}</div>`;
const pvpButton = cls => P.pvpEnabled
	? `<button class="${cls}" data-act="pvp">Player vs Player</button>`
	: `<button class="${cls}" disabled title="Coming soon">Player vs Player<span class="pm-soon">Coming soon</span></button>`;

const entryForm = (backLabel = '← Back') => `
	<div class="pm-label">Your name</div>${nameInput()}${gateHint()}
	<button class="pm-btn" data-act="create" data-gate>Create Room</button>
	<div class="pm-or">or join a friend's Room</div>
	<div class="pm-row">${codeInput()}<button class="pm-btn" data-act="join" data-gate>Join</button></div>
	${errorLine()}
	<button class="pm-link" data-act="back">${backLabel}</button>`;

const waitingView = () => `
	<div class="pm-label">Room code</div><div class="pm-code">${esc(P.code)}</div>
	<div class="pm-label">or share this link</div>
	<div class="pm-linkbox"><span>${esc(roomLink())}</span><button class="pm-btn" data-act="copy">Copy</button></div>
	<div class="pm-wait">Waiting for opponent</div>
	<button class="pm-link" data-act="back">Cancel and leave Room</button>`;

// ---------- variants ----------
const V = {
	// A: classic stacked menu; Room entry is a separate screen (navigation)
	A() {
		if (P.screen === 'menu') return `<div class="pmA-col">
			<h1 class="pm-title">Gwent<small>Classic</small></h1>
			<button class="pm-btn pmA-big" data-act="pvai">Player vs AI</button>
			${pvpButton('pm-btn pmA-big')}</div>`;
		if (P.screen === 'entry') return `<div class="pmA-panel"><div class="pm-h2">Player vs Player</div>${entryForm()}</div>`;
		return `<div class="pmA-panel"><div class="pm-h2">Your Room</div>${waitingView()}</div>`;
	},

	// B: split doors; the right half expands in place, so there is no separate Room screen
	B() {
		const open = P.screen !== 'menu';
		let right;
		if (P.screen === 'entry') right = `<div class="pmB-form"><h2>Player vs Player</h2>${entryForm()}</div>`;
		else if (P.screen === 'waiting') right = `<div class="pmB-form"><h2>Your Room</h2>${waitingView()}</div>`;
		else right = `<div class="pmB-ribbon">Coming soon</div><h2>Player vs Player</h2><p>Invite a friend into a private Room.</p>`;
		return `<div class="pmB-halves">
			<section class="pmB-half pmB-ai ${open ? 'pmB-shrunk' : ''}" ${open ? '' : 'data-act="pvai"'}>
				<h2>Player vs AI</h2><p>Build a deck and face the computer.</p></section>
			<section class="pmB-half pmB-pvp ${open ? 'pmB-open' : ''} ${P.pvpEnabled ? '' : 'pmB-locked'}" ${(!open && P.pvpEnabled) ? 'data-act="pvp"' : ''}>${right}</section>
		</div>`;
	},

	// C: two Gwent-style cards; the PvP card flips over to show the Room entry on its back
	C() {
		const flipped = P.screen !== 'menu';
		let back = '';
		if (P.screen === 'entry') back = `<div class="pmC-back"><div class="pm-h2">Player vs Player</div>${entryForm()}</div>`;
		if (P.screen === 'waiting') back = `<div class="pmC-back"><div class="pm-h2">Your Room</div>${waitingView()}</div>`;
		return `<div class="pmC-stage">
			<h1 class="pm-title">Gwent<small>Classic</small></h1>
			<div class="pmC-cards">
				<div class="pmC-card pmC-ai ${flipped ? 'pmC-away' : ''}" data-act="pvai">
					<div class="pmC-art"></div><div class="pmC-label"><b>Player vs AI</b><span>Face the computer</span></div></div>
				<div class="pmC-card pmC-pvp ${flipped ? 'pmC-flipped' : ''} ${P.pvpEnabled ? '' : 'pmC-locked'}" ${(!flipped && P.pvpEnabled) ? 'data-act="pvp"' : ''}>
					${flipped ? back : '<div class="pmC-art"></div><div class="pmC-label"><b>Player vs Player</b><span>Play a friend in a private Room</span></div>'}
				</div>
			</div></div>`;
	},
};

// ---------- rendering ----------
function render() {
	const overlay = ['menu', 'entry', 'waiting'].includes(P.screen);
	root.classList.toggle('pm-hidden', !overlay);
	if (overlay) {
		const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.input : null;
		root.innerHTML = V[variant]();
		syncGate();
		if (focused) { const el = $(`[data-input="${focused}"]`, root); if (el) el.focus(); }
		else if (P.screen === 'entry') { const el = $('[data-input="name"]', root); if (el && !nameOk()) el.focus(); }
	}
	dc.classList.toggle('hide', P.screen === 'game' || P.screen === 'end');
	dc.classList.toggle('pm-room', P.mode === 'room');
	back.classList.toggle('pm-on', P.screen === 'deck' || P.screen === 'lobby');
	back.textContent = P.mode === 'room' ? '← Leave Room' : '← Main menu';
	gameBanner.classList.toggle('pm-on', P.screen === 'game');
	if (P.screen === 'end') {
		es.classList.remove('hide'); es.style.opacity = 1;
		es.children[0].className = 'end-win';
		const b = es.querySelectorAll('button'); b[2].textContent = 'Leave Room';
		const rows = es.getElementsByTagName('tr');   // names via textContent (Q6), never innerHTML
		rows[1].children[0].textContent = P.name || 'You';
		rows[2].children[0].textContent = P.opp.name;
	} else es.classList.add('hide');
	syncRoom(); syncSim();
	bar.innerHTML = `<button data-v="-1">←</button><span>${variant} · ${NAMES[variant]}</span><button data-v="1">→</button>`;
}

function syncGate() {
	const ok = nameOk();
	root.querySelectorAll('[data-gate]').forEach(b => { b.disabled = !ok; });
	root.querySelectorAll('[data-gate-hint]').forEach(h => { h.style.visibility = ok ? 'hidden' : 'visible'; });
}

function syncRoom() {
	const o = P.opp;
	oppBlock.querySelector('.pm-name').textContent = o.present ? o.name : '';
	const chip = oppBlock.querySelector('.pm-chip');
	chip.textContent = !o.present ? 'Waiting for opponent to join…' : o.ready ? 'Ready ✓' : 'Choosing a deck…';
	chip.classList.toggle('pm-ready', o.present && o.ready);
	startBtn.textContent = P.mode !== 'room' ? 'Start game' : P.meReady ? 'Ready ✓' : 'Ready';
	startBtn.classList.toggle('pm-is-ready', P.mode === 'room' && P.meReady);
	endStatus.textContent = P.screen !== 'end' ? '' : P.meReady ? 'You are ready. Waiting for your opponent…' : P.opp.ready ? 'Your opponent is ready for a rematch.' : '';
}

// ---------- actions ----------
const go = s => { P.screen = s; render(); };
const resetRoom = () => Object.assign(P, { ...fresh(), name: P.name, pvpEnabled: P.pvpEnabled });
const leaveRoom = () => { resetRoom(); go('menu'); };

async function notify(name, force = false) {
	if (!force) return ui.notification(name, 1600); // real component, respects the "game messages" toggle
	const el = ui.notif_elem;                       // Room-critical: shown even when game messages are off
	el.children[0].id = 'notif-' + name;
	await fadeIn(el, 150); await sleep(1500); await fadeOut(el, 150);
}

function maybeStart() {
	if ((P.screen === 'lobby' || P.screen === 'end') && P.meReady && P.opp.present && P.opp.ready) {
		P.meReady = false; P.opp.ready = false; go('game');
	}
}

function join() {
	if (!nameOk()) return;
	const code = P.joinCode.trim().toUpperCase();
	if (!code) P.error = 'Enter a Room code.';
	else if (code === 'FULL') P.error = 'This Room is full.';
	else if (code !== 'PLAY' && code !== P.code) P.error = 'No Room with that code.';
	else {
		Object.assign(P, { mode: 'room', isHost: false, error: '', opp: { present: true, ready: false, name: 'Triss' }, meReady: false });
		go('lobby'); notify('room-joined'); return;
	}
	const el = $('.pm-error', root); if (el) el.textContent = P.error;
}

function act(a, el) {
	switch (a) {
		case 'pvai': P.mode = 'ai'; go('deck'); break;
		case 'pvp': if (P.pvpEnabled) { P.error = ''; go('entry'); } break;
		case 'back': leaveRoom(); break;
		case 'create': if (nameOk()) { Object.assign(P, { mode: 'room', isHost: true, code: genCode(), error: '' }); go('waiting'); } break;
		case 'join': join(); break;
		case 'copy': try { navigator.clipboard.writeText(roomLink()); } catch (e) {} el.textContent = 'Copied ✓'; break;
	}
}

root.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act, b); });
root.addEventListener('input', e => {
	const t = e.target;
	if (t.dataset.input === 'name') { P.name = t.value; syncGate(); syncSim(); }
	if (t.dataset.input === 'code') { P.joinCode = t.value; P.error = ''; const er = $('.pm-error', root); if (er) er.textContent = ''; }
});
root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.input === 'code') act('join'); });
back.addEventListener('click', e => { e.preventDefault(); leaveRoom(); });

// Lobby: intercept the REAL Start game / end-screen buttons so they never start a real Game in Room mode
startBtn.addEventListener('click', e => {
	if (P.mode !== 'room') return;
	e.stopImmediatePropagation(); e.preventDefault();
	if (!P.meReady && (dm.stats.units < 22 || dm.stats.special > 10)) return alert('Your deck must have at least 22 unit cards and no more than 10 special cards.');
	P.meReady = !P.meReady; syncRoom(); syncSim(); maybeStart();
}, true);
const endBtns = [...es.querySelectorAll('button')];
const onEnd = fn => e => { if (P.mode !== 'room') return; e.stopImmediatePropagation(); e.preventDefault(); fn(); };
endBtns[0].addEventListener('click', onEnd(() => { P.meReady = false; go('lobby'); }), true);          // Customize
endBtns[1].addEventListener('click', onEnd(() => { P.meReady = true; syncRoom(); syncSim(); maybeStart(); }), true); // Rematch = Ready, same deck
endBtns[2].addEventListener('click', onEnd(() => leaveRoom()), true);                                   // Leave Room

gameBanner.addEventListener('click', e => {
	const k = e.target.dataset.pm;
	if (k === 'finish') go('end');
	if (k === 'exit') ui.popup('Resume', () => {}, 'Leave Room', () => leaveRoom(), 'Leave the Room?', 'The Game is forfeited and the Room closes for both players.');
});

// ---------- variant switcher ----------
function setVariant(v) {
	variant = v;
	const u = new URL(location.href); u.searchParams.set('variant', v); history.replaceState(null, '', u);
	render();
}
bar.addEventListener('click', e => {
	const d = e.target.dataset.v; if (!d) return;
	setVariant(KEYS[(KEYS.indexOf(variant) + Number(d) + KEYS.length) % KEYS.length]);
});
document.addEventListener('keydown', e => {
	if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
	if (document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]')) return;
	bar.querySelector(`[data-v="${e.key === 'ArrowLeft' ? -1 : 1}"]`).click();
});

// ---------- simulator ----------
sim.innerHTML = `<h4>Simulator (mock events)</h4><div class="pm-sim-body">
	<pre data-sim-state></pre>
	<button data-sim="toggle-pvp"></button>
	<button data-sim="opp-join">Opponent joins my Room</button>
	<button data-sim="opp-ready">Opponent: Ready</button>
	<button data-sim="opp-custom">Opponent: customizing</button>
	<button data-sim="opp-left">Opponent leaves / drops</button>
	<button data-sim="finish">Finish the Game (end screen)</button>
	<button data-sim="reset">Reset everything</button>
	<div class="pm-sim-note">Join codes: PLAY works, FULL = full Room, anything else = not found.</div></div>`;
sim.querySelector('h4').addEventListener('click', () => sim.classList.toggle('pm-collapsed'));

function syncSim() {
	const s = P.screen;
	$('[data-sim-state]', sim).textContent =
		`screen   ${s}\nmode     ${P.mode || '-'}\nname     "${P.name}" ${nameOk() ? '' : '(empty: gated)'}\nroom     ${P.code || '-'}${P.mode === 'room' ? (P.isHost ? ' (host)' : ' (guest)') : ''}\nopponent ${!P.opp.present ? 'absent' : P.opp.ready ? 'ready' : 'customizing'}\nme       ${P.meReady ? 'ready' : 'not ready'}`;
	const q = k => $(`[data-sim="${k}"]`, sim);
	q('toggle-pvp').textContent = `Player vs Player button: ${P.pvpEnabled ? 'ENABLED' : 'DISABLED (as shipped)'}`;
	q('opp-join').disabled = s !== 'waiting';
	q('opp-ready').disabled = !(P.opp.present && ['lobby', 'end'].includes(s));
	q('opp-custom').disabled = !(P.opp.present && ['lobby', 'end'].includes(s));
	q('opp-left').disabled = !(P.opp.present && ['lobby', 'game', 'end'].includes(s));
	q('finish').disabled = s !== 'game';
}
sim.addEventListener('click', e => {
	const k = e.target.dataset.sim; if (!k) return;
	if (k === 'toggle-pvp') { P.pvpEnabled = !P.pvpEnabled; render(); }
	if (k === 'opp-join') { P.opp.present = true; go('lobby'); notify('opp-joined'); }
	if (k === 'opp-ready') { P.opp.ready = true; syncRoom(); syncSim(); notify('opp-ready'); maybeStart(); }
	if (k === 'opp-custom') { P.opp.ready = false; syncRoom(); syncSim(); notify('opp-customizing'); }
	if (k === 'opp-left') notify('room-left', true).then(leaveRoom);
	if (k === 'finish') go('end');
	if (k === 'reset') { resetRoom(); P.name = ''; go('menu'); }
});

render();
})();
