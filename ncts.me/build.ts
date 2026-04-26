import { compileFile, renderFile } from 'pug'
import markdownit from 'markdown-it'
import { createHighlighter } from 'shiki'
import { Feed } from 'feed'
import { watch as _watch } from 'chokidar'
import ignore from 'ignore'
import { readdir } from 'node:fs/promises'
import { lstatSync, Stats } from 'node:fs'

const siteConfig = {
	name: '墨原',
	nameEnglish: 'Blair Noctis',
	handle: 'ncts',
	baseUrl: 'https://ncts.me',
}
const buildDir = '_build'
const resourceExtensions = ['.css', '.js', '.webp', '.png', '.jpg', '.woff2']

const isDev = process.argv.includes('--dev')
const host = process.env.HOST || 'localhost'
const port = Number(process.env.PORT || 7001)

const ig = ignore().add(await Bun.file('../.gitignore').text())

const highlighter = await createHighlighter({
	themes: ['vitesse-dark'],
	langs: ['javascript', 'typescript', 'css', 'html', 'bash', 'json', 'rust', 'python', 'markdown'],
})

const md = markdownit({ html: true, highlight: (code, lang) => {
	if(!lang || !highlighter.getLoadedLanguages().includes(lang)) {
		return ''
	}
	return highlighter.codeToHtml(code, { lang, theme: 'vitesse-dark' })
}})

/* Plain renderer for feed content (no syntax highlighting) */
const mdPlain = markdownit({ html: true })

/* Wrap images with non-empty alt text in <figure>/<figcaption> */
md.renderer.rules.image = (tokens, idx) => {
	const token = tokens[idx]
	const src = token.attrGet('src')
	const alt = token.content
	const title = token.attrGet('title') || ''
	const img = `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''}>`
	if(!alt) return img
	return `<figure>${img}<figcaption>${alt}</figcaption></figure>`
}

const templates = {}

const chineseMonths = ['一月', '二月', '三月', '四月', '五月', '六月',
	'七月', '八月', '九月', '十月', '十一月', '十二月']
const chineseYearDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const templateHelpers = {
	formatDate: (d: Date | string) => {
		const date = d instanceof Date ? d : new Date(d)
		return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
	},
	formatDateISO: (d: Date | string) => {
		const date = d instanceof Date ? d : new Date(d)
		return date.toISOString().slice(0, 10)
	},
	chineseYear: (d: Date | string) => {
		const year = (d instanceof Date ? d : new Date(d)).getFullYear().toString()
		return year.split('').map(c => chineseYearDigits[+c]).join('')
	},
	chineseMonth: (d: Date | string) => {
		return chineseMonths[(d instanceof Date ? d : new Date(d)).getMonth()]
	},
}

await buildAll()
isDev && dev()

function isJiEntry(p: string) {
	return p.startsWith('ji/') && p !== 'ji/index.pug'
}

async function buildAll() {
	const files = (await readdir('.', { recursive: true }))
		.filter((p) => !ig.ignores(p) && lstatSync(p).isFile())
	const pages = files.filter(p => p.endsWith('.md') || (p.endsWith('.pug') && !p.endsWith('.template.pug')))

	// build standalone pages
	for(const p of pages.filter(p => !isJiEntry(p))) {
		await build(p, { pages })
	}
	// build ji entries individually, then generate the list page
	const jiEntries = pages.filter(isJiEntry)
	for(const p of jiEntries) {
		await build(p, { pages })
	}
	await buildJiList(jiEntries)

	for(const p of files.filter(p => resourceExtensions.some(e => p.endsWith(e)))) {
		await writeToBuildDir(p, Bun.file(p))
	}
}

function dev() {
	const sseClients = new Set<ReadableStreamDefaultController>()

	function notifyReload() {
		for(const controller of sseClients) {
			controller.enqueue('data: reload\n\n')
		}
	}

	// Watch for source changes and rebuild
	_watch('.', {
		ignored: (path, stats) => path !== '.' && ig.ignores(path),
		persistent: true
	})
		.on('change', async (path) => {
			// Invalidate cached templates when a template changes
			if(path.endsWith('.template.pug')) {
				delete templates[path.replace('.template.pug', '')]
			}
			await buildAll()
			notifyReload()
		})
		.on('ready', () => console.log('[dev] watching for changes'))

	const liveReloadScript = `<script>
new EventSource('/__reload').onmessage = () => location.reload()
</script>`

	const mimeTypes: Record<string, string> = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.json': 'application/json',
		'.xml': 'application/xml',
		'.webp': 'image/webp',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.woff2': 'font/woff2',
		'.ico': 'image/x-icon',
	}

	Bun.serve({
		host,
		port,
		async fetch(req) {
			const url = new URL(req.url)

			// SSE endpoint for live reload
			if(url.pathname === '/__reload') {
				const stream = new ReadableStream({
					start(controller) {
						sseClients.add(controller)
					},
					cancel(controller) {
						sseClients.delete(controller)
					},
				})
				return new Response(stream, {
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						'Connection': 'keep-alive',
					},
				})
			}

			// Resolve file path: try exact, then /index.html, then .html
			let filePath = buildDir + url.pathname
			let file = Bun.file(filePath)
			if(!await file.exists()) {
				file = Bun.file(filePath + '/index.html')
				filePath += '/index.html'
			}
			if(!await file.exists()) {
				file = Bun.file(filePath.replace(/\/index\.html$/, '.html'))
				filePath = filePath.replace(/\/index\.html$/, '.html')
			}
			if(!await file.exists()) {
				return new Response('404', { status: 404 })
			}

			const ext = filePath.slice(filePath.lastIndexOf('.'))
			const contentType = mimeTypes[ext] || 'application/octet-stream'

			// Inject live reload script into HTML responses
			if(ext === '.html') {
				let html = await file.text()
				html = html.replace('</body>', liveReloadScript + '</body>')
				return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
			}

			return new Response(file, { headers: { 'Content-Type': contentType } })
		},
	})

	console.log(`[dev] serving at http://${host}:${port}`)
}

async function build(path: string, locals?: object) {
	if(path.endsWith('.pug') && !path.endsWith('.template.pug')) {
		console.log('[build]', path)
		return await writeToBuildDir(path, renderFile(path, { ...siteConfig, ...templateHelpers, ...locals }))
	}

	if(!path.endsWith('.md')) {
		return
	}
	console.log('[build]', path)

	const raw = await Bun.file(path).text()
	const [frontMatter, body] = parseMarkdown(raw, lstatSync(path), path)
	if(frontMatter.publish === false) {
		return
	}
	const templateName = frontMatter.template || (path.startsWith('ji/') ? 'ji_entry' : 'page')
	const template = getTemplate(templateName)
	const content = md.render(body)
	const rendered = template({ ...siteConfig, ...templateHelpers, ...locals, ...frontMatter, content })
	await writeToBuildDir(path, rendered)
}

async function buildJiList(files: string[]) {
	const template = getTemplate('ji_list')
	const entries = (await Promise.all(files.map(async (p) => {
		const raw = await Bun.file(p).text()
		const [matter, body] = parseMarkdown(raw, lstatSync(p), p)
		matter.path = '/' + p.replace(/\.md$/, '')
		matter._body = body
		return matter
	}))).filter(m => m.publish !== false)
	// newest first
	entries.sort((a, b) => +new Date(b.date ?? b.created) - +new Date(a.date ?? a.created))

	const rendered = template({ ...siteConfig, ...templateHelpers, entries })
	await writeToBuildDir('ji/index.html', rendered)

	await buildJiFeed(entries.filter(e => e.feed !== false))
}

async function buildJiFeed(entries: Record<string, any>[]) {
	const feed = new Feed({
		title: '寄己集',
		description: 'Colorless Ink — Blair Noctis',
		id: siteConfig.baseUrl + '/ji/',
		link: siteConfig.baseUrl + '/ji/',
		language: 'zh',
		author: { name: siteConfig.nameEnglish },
		copyright: siteConfig.nameEnglish,
	})

	for(const entry of entries) {
		const date = new Date(entry.date ?? entry.created)
		const url = siteConfig.baseUrl + entry.path
		feed.addItem({
			title: entry.title,
			id: url,
			link: url,
			date,
			content: mdPlain.render(entry._body) || '',
		})
	}

	await Bun.write(buildDir + '/ji/feed.xml', feed.atom1())
	console.log('[feed]', 'ji/feed.xml')
}

function getTemplate(name: string) {
	if(templates[name] === undefined) {
		templates[name] = compileFile(`${name}.template.pug`, siteConfig)
	}
	return templates[name]
}

async function writeToBuildDir(originalPath, content) {
	const buildPath = buildDir + '/' + originalPath.replace(/\.md$/, '.html').replace(/\.pug$/, '.html')
	console.log('[writeToBuildDir]', originalPath, '=>', buildPath)
	await Bun.write(buildPath, content)
}

// Parse a markdown file into [frontMatter, body].
//
// Front matter is delimited by "---" lines, with single-level `key = value` pairs (akin to TOML).
// - Values whose key ends with "date" are parsed as Date
// - Numeric-looking values are parsed as numbers
// - "created" and "updated" default to ctime/mtime from stat
function parseMarkdown(raw: string, stat: Stats, path: string): [Record<string, any>, string] {
	const lines = raw.trim().split('\n')
	const matter: Record<string, any> = {}
	let bodyStart = 0
	let inBlock = false

	for(let i = 0; i < lines.length; i++) {
		if(lines[i].trim() === '---') {
			if(inBlock) {
				bodyStart = i + 1
				break
			} else {
				inBlock = true
				continue
			}
		}

		if(!inBlock) break

		const delimPos = lines[i].indexOf('=')
		if(delimPos === -1) continue
		const key = lines[i].slice(0, delimPos).trim()
		let value: any = lines[i].slice(delimPos + 1).trim()

		if(key.toLowerCase().endsWith('date')) {
			value = new Date(value)
		} else {
			const tryNumber = Number(value)
			if(!Number.isNaN(tryNumber)) {
				value = tryNumber
			}
		}
		matter[key] = value
	}

	if(matter.created === undefined) {
		matter.created = stat.ctime
	}
	if(matter.updated === undefined) {
		matter.updated = stat.mtime
	}
	if(matter.publish === 'false') {
		matter.publish = false
	}
	if(matter.feed === 'false') {
		matter.feed = false
	}

	if(!matter.title) {
		matter.title = path.replace(/^.*\//, '').replace(/\.\w+$/, '')
	}

	const body = lines.slice(bodyStart).join('\n').trim()
	return [matter, body]
}
