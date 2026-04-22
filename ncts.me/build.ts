import { compileFile, renderFile } from 'pug'
import markdownit from 'markdown-it'
import { watch as _watch } from 'chokidar'
import ignore from 'ignore'
import { readdir } from 'node:fs/promises'
import { lstatSync, Stats } from 'node:fs'
import { relative } from 'node:path'

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

async function buildAll() {
	const files = (await readdir('.', { recursive: true }))
		.filter((p) => !ig.ignores(p) && lstatSync(p).isFile())
	const pages = files.filter(p => p.endsWith('.md') || (p.endsWith('.pug') && !p.endsWith('.template.pug')))

	// build everything not under ji/
	pages.filter(p => !relative('ji/', p)).forEach(p => build(p, { pages }))
	// needs a list page, so, its own file listing
	buildJiList(pages.filter(p => relative('ji/', p)))

	files.filter(p => resourceExtensions.filter(e => p.endsWith(e)).length !== 0)
		.map(p => writeToBuildDir(p, Bun.file(p)))
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

	const markdown = await Bun.file(path).text()
	const frontMatter = parseFrontMatter(markdown, lstatSync(path))
	if(frontMatter.publish === false) {
		return
	}
	const template = getTemplate(frontMatter.template || relative('ji/', path) ? 'ji_entry' : 'base_page')
	const rendered = template({ ...siteConfig, ...locals, ...frontMatter, content: md.render(markdown) })
	await Bun.file(path.replace(/\.md$/, '.html'), rendered)
}

async function buildJiList(files: string[]) {
	const template = getTemplate('ji_list')
	const frontMatters = (await Promise.all(files.map(async(p) => parseFrontMatter(await Bun.file(p).text(), lstatSync(p)))))
		.filter(m => m.publish !== false)
	frontMatters.sort((a, b) => a.created < b.created)
	await writeToBuildDir('ji/index.html', { ...siteConfig, entries: frontMatters})
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

// A simplified "front matter" parser.
//
// - "---" as delimiter
// - single level `key = value` lines, akin to TOML
// - parse into Date if key ends with "date" (like "date", "stardate")
// - parse into number if parsed like one
// - take "created" (ctime) and "updated" (mtime) from stat if absent
function parseFrontMatter(markdown: string, stat: Stats) {
	const lines = markdown.trim().split('\n')
	const matter = {}
	let inBlock = false

	for(const line of lines) {
		if(line.trim() === '---') {
			if(inBlock) {
				break
			} else {
				inBlock = true
				continue
			}
		}

		const delimPos = line.indexOf('=')
		const key = line.slice(0, delimPos).trim()
		let value = line.slice(delimPos + 1).trim()

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

	return matter
}
