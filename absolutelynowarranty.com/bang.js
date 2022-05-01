;(function() {
	const $ = document.querySelector.bind(document)
	const bangEl = $('.bang')
	const halfSide = Math.floor(parseInt(window.getComputedStyle(bangEl).width) / 2)

	function updateBangPosition(e) {
		Object.assign(bangEl.style, {
			left: `${e.clientX - halfSide}px`,
			top: `${e.clientY - halfSide}px`,
		})
	}
	document.addEventListener('mousemove', updateBangPosition)

	function registerBang() {
		bangEl.style.visibility = 'visible'
		document.removeEventListener('mousemove', registerBang)
		document.removeEventListener('mouseenter', registerBang)
	}
	document.addEventListener('mousemove', registerBang)
	document.addEventListener('mouseenter', registerBang)
})();
