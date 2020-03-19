const
	fs = require('fs'),
	pug = require('pug'),
	sass = require('sass'),
	adoc = require('asciidoctor')(),
	path = require('path')

/* render redirects */
let goPug = pug.compileFile('_go.pug')
fs.readFileSync('./go.list')
	.toString()
	.split('\n')
	.filter(i => i.length != 0)
	.forEach(line => {
		let colonPos = line.indexOf(':'),
			item = line.substring(0, colonPos),
			target = line.substring(colonPos + 1)
		fs.writeFileSync(path.join('go', `${item}.html`), goPug({ target }))
		console.info(`Rendered redirect target ${target} at go/${item}.html`)
	})

/* render front page */
fs.writeFileSync('index.html', pug.renderFile('index.pug'))
fs.writeFileSync('index.css', sass.renderSync({ file: 'index.sass' }).css)
console.log('Rendered front page')

