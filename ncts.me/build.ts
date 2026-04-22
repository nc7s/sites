import { compileFile, renderFile } from 'pug'
import markdownit from 'markdown-it'
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

const isWatching = process.argv.includes('--watch')

const ig = ignore().add(await Bun.file('../.gitignore').text())
const md = markdownit()
const templates = {}

await buildAll()
isWatching && watch()

function isJiEntry(p: string) {
	return p.startsWith('ji/') && p !== 'ji/index.pug'
}

async function buildAll() {
	const files = (await readdir('.', { recursive: true }))
		.filter((p) => !ig.ignores(p) && lstatSync(p).isFile())
	const pages = files.filter(p => p.endsWith('.md') || (p.endsWith('.pug') && !p.endsWith('.template.pug')))

	// build standalone pages (not ji entries, not ji/index.pug which is built by buildJiList)
	for(const p of pages.filter(p => !isJiEntry(p) && p !== 'ji/index.pug')) {
		await build(p, { pages })
	}
	// ji entries need a list page, so build them together
	await buildJiList(pages.filter(isJiEntry))

	for(const p of files.filter(p => resourceExtensions.some(e => p.endsWith(e)))) {
		await writeToBuildDir(p, Bun.file(p))
	}
}

function watch() {
	_watch('.', {
		ignored: (path, stats) => path !== '.' && ig.ignores(path),
		persistent: true
	})
		.on('add', build)
		.on('change', build)
		.on('ready', () => console.log(`[watch] started`))
		.on('error', (e) => console.error(`[watch] error: ${e}`))
}

async function build(path: string, locals?: object) {
	if(path.endsWith('.pug') && !path.endsWith('.template.pug')) {
		console.log('[build]', path)
		return await writeToBuildDir(path, renderFile(path, { ...siteConfig, ...locals }))
	}

	if(!path.endsWith('.md')) {
		return
	}
	console.log('[build]', path)

	const raw = await Bun.file(path).text()
	const [frontMatter, body] = parseMarkdown(raw, lstatSync(path))
	if(frontMatter.publish === false) {
		return
	}
	const templateName = frontMatter.template || (path.startsWith('ji/') ? 'ji_entry' : 'page')
	const template = getTemplate(templateName)
	const content = md.render(body)
	const rendered = template({ ...siteConfig, ...locals, ...frontMatter, content })
	await writeToBuildDir(path, rendered)
}

async function buildJiList(files: string[]) {
	const template = getTemplate('ji_list')
	const entries = (await Promise.all(files.map(async (p) => {
		const [matter] = parseMarkdown(await Bun.file(p).text(), lstatSync(p))
		matter.path = p.replace(/\.md$/, '')
		return matter
	}))).filter(m => m.publish !== false)
	// newest first
	entries.sort((a, b) => +new Date(b.date ?? b.created) - +new Date(a.date ?? a.created))
	const rendered = template({ ...siteConfig, entries })
	await writeToBuildDir('ji/index.html', rendered)
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
function parseMarkdown(raw: string, stat: Stats): [Record<string, any>, string] {
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
		}
		const tryNumber = Number(value)
		if(!Number.isNaN(tryNumber)) {
			value = tryNumber
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

	const body = lines.slice(bodyStart).join('\n').trim()
	return [matter, body]
}
