const oppressedEls = [...document.querySelectorAll('.nameplay .oppressed')]

function onOppressedMouseEnter(e) {
	document.body.classList.add('oppressed-body')
	e.target.classList.add('oppressed-item')
}

function onOppressedMouseLeave(e) {
	document.body.classList.remove('oppressed-body')
	e.target.classList.remove('oppressed-item')
}

oppressedEls.forEach((el) => el.addEventListener('mouseenter', onOppressedMouseEnter))
oppressedEls.forEach((el) => el.addEventListener('mouseleave', onOppressedMouseLeave))

