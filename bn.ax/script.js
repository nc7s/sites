(() => {
	let unveil = {
		state: 'veiled',
		hasInput: false,
		startingAreaRatio: .8,
		borderGradientDeg: 60,
		animationSpeed: 30,
		pointedAt: {},
		linear: {},
		elVeil: document.querySelector('.veil'),
		elContent: document.querySelector('.content'),
		drawBorder(refX, refY) {
			let tanG = Math.tan(this.borderGradientDeg * Math.PI / 180),
				upperXPercentage = (refY / tanG + refX) * 100 / document.body.clientWidth,
				lowerXPercentage = (refX - (document.body.clientHeight - refY) / tanG) * 100 / document.body.clientWidth
			this.elVeil.style.clipPath = `polygon(0 0, ${upperXPercentage}% 0, ${lowerXPercentage}% 100%, 0 100%)`
			this.elContent.style.clipPath = `polygon(100% 100%, 0 100%, ${lowerXPercentage}% 100%, ${upperXPercentage}% 0, 100% 0)`
		},
		_boundOnInput: null,
		onInput(e) {
			e.preventDefault()
			this.linear.a = - document.body.clientHeight / document.body.clientWidth
			this.linear.b = document.body.clientHeight
			let point = e.type.startsWith('touch') ? Array.prototype.find.call(e.touches, t => t.identifier == 0) : e
			if(point) {
				this.pointedAt.x = point.clientX
				this.pointedAt.y = point.clientY
			}
			switch(e.type) {
				case 'mousedown':
				case 'touchstart':
					this.hasInput = true
					if(this.state != 'veiled') { return }
					if(point.clientX < document.body.clientWidth * this.startingAreaRatio || point.clientY < document.body.clientHeight * this.startingAreaRatio) { return  }
					this.state = 'inProgress'
					window.requestAnimationFrame(() => this.drawBorder(point.clientX, point.clientY))
					break
				case 'mousemove':
				case 'touchmove':
					if(this.state != 'inProgress') { return }
					window.requestAnimationFrame(() => this.drawBorder(point.clientX, point.clientY))
					break
				case 'mouseup':
				case 'touchend':
					this.hasInput = false
					if(this.state != 'inProgress') { return }
					if(this.linear.a * this.pointedAt.x + this.linear.b > this.pointedAt.y) {
						window.requestAnimationFrame(this._boundAnimateAfterUnveil)
					} else {
						this.state = 'veiled'
						window.requestAnimationFrame(this._boundAnimateUnfinishedUnveil)
					}
			}
		},
		animateAfterUnveil() {
			if(this.hasInput) { return }
			this.drawBorder(this.pointedAt.x, this.pointedAt.y)
			this.pointedAt.x -= this.animationSpeed
			if(this.pointedAt.x > 0) {
				window.requestAnimationFrame(this._boundAnimateAfterUnveil)
			} else {
				this.state = 'unveiled'
				this.elVeil.style.display = 'none'
				this.elContent.style.clipPath = 'none'
				this.close()
			}
		},
		_boundAnimateAfterUnveil: null,
		animateUnfinishedUnveil() {
			if(this.hasInput) { return }
			this.drawBorder(this.pointedAt.x, this.pointedAt.y)
			this.pointedAt.x += this.animationSpeed
			if(this.pointedAt.x < document.body.clientHeight) {
				window.requestAnimationFrame(this._boundAnimateUnfinishedUnveil)
			} else {
				this.state = 'veiled'
			}
		},
		_boundAnimateUnfinishedUnveil: null,
		listen() {
			window.addEventListener('mousedown', this._boundOnInput)
			window.addEventListener('mousemove', this._boundOnInput)
			window.addEventListener('mouseup', this._boundOnInput)
			window.addEventListener('touchstart', this._boundOnInput)
			window.addEventListener('touchmove', this._boundOnInput)
			window.addEventListener('touchend', this._boundOnInput)
		},
		close() {
			window.removeEventListener('mousedown', this._boundOnInput)
			window.removeEventListener('mousemove', this._boundOnInput)
			window.removeEventListener('mouseup', this._boundOnInput)
			window.removeEventListener('touchstart', this._boundOnInput)
			window.removeEventListener('touchmove', this._boundOnInput)
			window.removeEventListener('touchend', this._boundOnInput)
		}
	}
	unveil._boundOnInput = unveil.onInput.bind(unveil)
	unveil._boundAnimateAfterUnveil = unveil.animateAfterUnveil.bind(unveil)
	unveil._boundAnimateUnfinishedUnveil = unveil.animateUnfinishedUnveil.bind(unveil)
	return unveil
})().listen()
