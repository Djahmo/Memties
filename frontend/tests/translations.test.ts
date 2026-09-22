import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'
import { createInstance } from 'i18next'
import { en, fr } from '../src/i18n/messages.ts'

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(item =>
  item.isDirectory() ? sourceFiles(join(directory, item.name)) : /\.tsx?$/.test(item.name) && !item.name.endsWith('.test.ts') ? [join(directory, item.name)] : [])

const visit = (node: ts.Node, check: (node: ts.Node) => void) => {
  check(node)
  ts.forEachChild(node, child => visit(child, check))
}

const checkKey = (node: ts.Node | undefined, location: string) => {
  if (!node) return
  if (ts.isStringLiteral(node) && node.text) {
    assert.ok(Object.hasOwn(fr, node.text), `${location}: missing French translation for ${node.text}`)
    assert.ok(Object.hasOwn(en, node.text), `${location}: missing English translation for ${node.text}`)
  } else if (ts.isConditionalExpression(node)) {
    checkKey(node.whenTrue, location)
    checkKey(node.whenFalse, location)
  } else if (ts.isBinaryExpression(node)) {
    checkKey(node.left, location)
    checkKey(node.right, location)
  }
}

test('UI translation keys and API service errors exist in both languages', () => {
  for (const directory of ['../src/', '../../backend/src/routes/', '../../backend/src/services/', '../../backend/src/auth/']) {
    for (const file of sourceFiles(fileURLToPath(new URL(directory, import.meta.url)))) {
      if (file.endsWith('messages.ts')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      visit(source, node => {
        if (ts.isCallExpression(node) && ['t', 'i18n.t', 'setError', 'setNotice'].includes(node.expression.getText(source))) {
          checkKey(node.arguments[0], file)
        }
        if (ts.isNewExpression(node) && node.expression.getText(source) === 'ServiceError') checkKey(node.arguments?.[1], file)
      })
    }
  }
})

test('UI text and accessible labels are translated instead of hardcoded', () => {
  for (const file of sourceFiles(fileURLToPath(new URL('../src/', import.meta.url))).filter(file => file.endsWith('.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    visit(source, node => {
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) {
        assert.ok(['Memties', 'Français', 'English'].includes(node.text.trim()), `${file}: untranslated text ${node.text.trim()}`)
      }
      if (ts.isJsxAttribute(node) && ['placeholder', 'title', 'aria-label', 'alt'].includes(node.name.getText(source))) {
        assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer) || !/\p{L}/u.test(node.initializer.text), `${file}: untranslated ${node.name.getText(source)}`)
      }
    })
  }
})

test('both dictionaries preserve interpolation and work without a fallback language', async () => {
  const i18n = createInstance()
  await i18n.init({ resources: { en: { translation: en }, fr: { translation: fr } }, fallbackLng: false, keySeparator: false, nsSeparator: false })
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort())
  for (const language of ['fr', 'en']) {
    await i18n.changeLanguage(language)
    for (const [key, translation] of Object.entries(language === 'fr' ? fr : en)) {
      assert.ok(translation.trim(), `${language}: empty translation for ${key}`)
      assert.ok(i18n.exists(key), `${language}: missing ${key}`)
      assert.deepEqual([...translation.matchAll(/{{(.*?)}}/g)].map(match => match[1]).sort(), [...key.matchAll(/{{(.*?)}}/g)].map(match => match[1]).sort(), `${language}: mismatched placeholders for ${key}`)
    }
    assert.equal(i18n.t('Delete'), language === 'fr' ? 'Supprimer' : 'Delete')
    assert.equal(i18n.t('Account: {{email}}', { email: 'test@example.com' }), language === 'fr' ? 'Compte : test@example.com' : 'Account: test@example.com')
  }
})
