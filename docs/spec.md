Ниже — спецификация пакета. Я буду считать, что цель не «угадать версию из воздуха», а дать детерминированную CLI-команду, которая меняет SemVer проекта и синхронизирует эту версию в строго заданных местах.

Важное ограничение: «сразу без уязвимостей» нельзя гарантировать формально. Можно спроектировать пакет так, чтобы  **не иметь runtime-зависимостей** , не выполнять сторонний код, не ходить в сеть, не иметь install-скриптов и минимизировать поверхность атаки. Это резко снижает риск транзитивных CVE, но не отменяет ошибок в собственном коде.

---

# Спецификация npm-пакета `@your-scope/pvs`

Рабочее имя: **Project Version Sync**
Пакет: `@your-scope/pvs`
CLI-команда: `pvs`
Runtime dependencies: `0`
Формат: ESM, Node.js CLI
Основной сценарий:

```bash
pvs bump patch
pvs bump minor
pvs bump major
pvs bump 1.4.0
pvs sync
pvs check
```

SemVer берется как базовая модель: нормальная версия имеет вид `X.Y.Z`, без ведущих нулей; уже опубликованная версия не должна изменяться задним числом, а любые изменения должны выпускаться новой версией. Это соответствует SemVer 2.0.0. ([Semantic Versioning](https://semver.org/?utm_source=chatgpt.com "Semantic Versioning 2.0.0 | Semantic Versioning"))

---

## 1. Цель пакета

Пакет должен:

1. Читать текущую версию проекта из `package.json`.
2. Рассчитывать новую версию по правилу `patch`, `minor`, `major`, `prerelease` или по явно переданной версии.
3. Обновлять:
   * `package.json`;
   * `package-lock.json`, если он есть;
   * `npm-shrinkwrap.json`, если он есть;
   * любые пользовательские файлы, указанные в конфиге.
4. Позволять вставлять версию в HTML, CSS, TS, JS, JSON, Markdown и другие текстовые файлы.
5. Работать без runtime-зависимостей.
6. Не выполнять пользовательские скрипты по умолчанию.
7. Не делать сетевых запросов.
8. Поддерживать `--dry-run`, чтобы показать план изменений без записи на диск.
9. Быть безопасным по умолчанию: только явные файлы, только внутри корня проекта, без JS-конфига.

---

## 2. Нецели

Не нужно включать в MVP:

1. Автоматический анализ Conventional Commits.
2. Генерацию changelog.
3. GitHub Releases.
4. Публикацию пакета пользователя.
5. Изменение версий зависимостей.
6. Полноценный glob-движок уровня `minimatch`.
7. JS/TS-конфиг, потому что он требует исполнения произвольного кода.
8. Автоматическое изменение бинарных файлов.
9. Автоматическое сканирование всего проекта по умолчанию.

Причина: каждый из этих пунктов либо добавляет зависимости, либо увеличивает поверхность атаки, либо делает поведение менее предсказуемым.

---

## 3. Главный принцип дизайна

Источник истины — `package.json.version`.

Все остальные места — производные значения.

То есть пользователь не должен руками менять версию в футере сайта, CSS, `version.ts` или `README.md`. Он меняет ее через:

```bash
pvs bump patch
```

После этого пакет синхронизирует все настроенные места.

---

## 4. Режимы работы

### 4.1 `pvs bump`

Меняет версию проекта.

```bash
pvs bump patch
pvs bump minor
pvs bump major
pvs bump 2.0.0
pvs bump prepatch --preid rc
```

Поведение:

1. Читает `package.json`.
2. Проверяет текущую версию.
3. Вычисляет новую.
4. Обновляет manifest-файлы.
5. Обновляет пользовательские targets.
6. Валидирует итог.
7. Печатает отчет.

---

### 4.2 `pvs sync`

Не меняет версию, а только синхронизирует текущую `package.json.version` в пользовательские файлы.

```bash
pvs sync
```

Полезно, если пользователь уже использует:

```bash
npm version patch
```

`npm version` сам умеет bump-ить `package.json`, `package-lock.json` и `npm-shrinkwrap.json`; также он может создавать git commit/tag и запускать lifecycle-скрипты. ([docs.npmjs.com](https://docs.npmjs.com/cli/v11/commands/npm-version "npm-version | npm Docs"))

Например:

```json
{
  "scripts": {
    "version": "pvs sync && git add -A"
  }
}
```

Но standalone-режим `pvs bump` должен работать и без `npm version`.

---

### 4.3 `pvs check`

Проверяет, что все настроенные места уже содержат текущую версию.

```bash
pvs check
```

Если найдено расхождение:

```bash
Version mismatch:
- package.json: 1.4.2
- src/version.ts: 1.4.1
- public/version.json: 1.4.1

Run: pvs sync
```

---

### 4.4 `pvs current`

Печатает текущую версию.

```bash
pvs current
```

Вывод:

```text
1.4.2
```

С JSON:

```bash
pvs current --json
```

```json
{
  "version": "1.4.2",
  "major": 1,
  "minor": 4,
  "patch": 2
}
```

---

### 4.5 `pvs init`

Создает минимальный конфиг.

```bash
pvs init
```

Результат:

```text
Created pvs.config.json
```

---

## 5. Конфигурация

Файл: `pvs.config.json`

Формат только JSON, не JS.

Причина: JS-конфиг потребовал бы `import()` или `require()`, то есть выполнение произвольного кода из проекта пользователя. Для security-first CLI это плохое значение по умолчанию.

### 5.1 Минимальный конфиг

```json
{
  "schemaVersion": 1,
  "targets": [
    {
      "file": "src/version.ts",
      "type": "replace",
      "match": "export const APP_VERSION = \"[^\"]+\";",
      "replace": "export const APP_VERSION = \"$version\";"
    }
  ]
}
```

---

### 5.2 Рекомендуемый конфиг через markers

Лучше не искать старую версию regex-ом, а использовать управляемый блок.

```json
{
  "schemaVersion": 1,
  "targets": [
    {
      "file": "src/version.ts",
      "type": "marker",
      "id": "app-version",
      "template": "export const APP_VERSION = \"$version\";"
    },
    {
      "file": "src/styles/version.css",
      "type": "marker",
      "id": "css-version",
      "template": "--app-version: \"$version\";"
    },
    {
      "file": "public/version.json",
      "type": "json",
      "values": {
        "version": "$version",
        "major": "$major",
        "minor": "$minor",
        "patch": "$patch"
      }
    }
  ]
}
```

---

## 6. Форматы target-ов

### 6.1 `type: "marker"`

Самый безопасный формат.

Исходный файл:

```ts
// pvs:start app-version
export const APP_VERSION = "1.4.1";
// pvs:end app-version
```

После:

```ts
// pvs:start app-version
export const APP_VERSION = "1.4.2";
// pvs:end app-version
```

Правила:

1. Маркеры должны быть уникальны внутри файла.
2. Если найдено 0 блоков — ошибка.
3. Если найдено больше 1 блока — ошибка, если не указано `"multiple": true`.
4. Маркеры сохраняются.
5. Меняется только содержимое между маркерами.

---

### 6.2 `type: "replace"`

Гибкий, но менее безопасный режим.

```json
{
  "file": "README.md",
  "type": "replace",
  "match": "Current version: v[0-9]+\\.[0-9]+\\.[0-9]+",
  "replace": "Current version: v$version"
}
```

Правила:

1. По умолчанию regex должен сработать ровно 1 раз.
2. Если не найдено совпадений — ошибка.
3. Если найдено несколько — ошибка.
4. Разрешить несколько замен можно явно:

```json
{
  "multiple": true
}
```

---

### 6.3 `type: "json"`

Для JSON-файлов.

```json
{
  "file": "public/version.json",
  "type": "json",
  "values": {
    "version": "$version",
    "build.iso": "$isoDate",
    "build.git": "$gitSha"
  }
}
```

Результат:

```json
{
  "version": "1.4.2",
  "build": {
    "iso": "2026-06-22T00:00:00.000Z",
    "git": "abc1234"
  }
}
```

Правила:

1. JSON парсится строго через `JSON.parse`.
2. Комментарии не поддерживаются.
3. Порядок существующих ключей по возможности сохраняется, но новые ключи добавляются в конец объекта.
4. Отступ определяется из исходного файла: 2 пробела, 4 пробела или tab.
5. Финальный перевод строки сохраняется.

---

### 6.4 `type: "generated"`

Пакет полностью генерирует файл.

```json
{
  "file": "src/generated/version.ts",
  "type": "generated",
  "template": "export const APP_VERSION = \"$version\";\n"
}
```

Это лучший вариант для фронтенда.

Например, вместо прямой правки компонентов:

```ts
import { APP_VERSION } from "./generated/version";

console.log(APP_VERSION);
```

---

## 7. Переменные шаблонов

Поддерживаемые переменные:

```text
$version       -> 1.4.2
$major         -> 1
$minor         -> 4
$patch         -> 2
$prerelease    -> rc.1
$build         -> 20260622
$isoDate       -> 2026-06-22T14:35:00.000Z
$date          -> 2026-06-22
$gitSha        -> abc1234
$gitShaLong    -> full commit sha
```

По умолчанию `gitSha` вычисляется только если в проекте есть `.git` и команда `git` доступна. Если нет — значение пустое или ошибка, если target явно требует git:

```json
{
  "requireGit": true
}
```

---

## 8. CSS / сайт / “переменная в любом месте”

Если речь про CSS, не стоит записывать версию в реальный `padding`, потому что `1.4.2` не является валидным CSS-размером. Лучше использовать CSS custom property или generated-файл.

Пример:

```css
:root {
  /* pvs:start css-version */
  --app-version: "1.4.2";
  /* pvs:end css-version */
}

.footer::after {
  content: "v" var(--app-version);
}
```

Или HTML:

```html
<!-- pvs:start app-version -->
<meta name="app-version" content="1.4.2">
<!-- pvs:end app-version -->
```

Или React/Vue/Svelte через generated-файл:

```ts
export const APP_VERSION = "1.4.2";
```

---

## 9. Manifest-файлы

### 9.1 `package.json`

Обновляется всегда.

```json
{
  "version": "1.4.2"
}
```

---

### 9.2 `package-lock.json`

Если файл есть, обновляются:

```json
{
  "version": "1.4.2",
  "packages": {
    "": {
      "version": "1.4.2"
    }
  }
}
```

`package-lock.json` описывает конкретное дерево зависимостей и предназначен для commit-а в репозиторий; npm также указывает, что `package-lock.json` не публикуется как lockfile библиотеки, а `npm-shrinkwrap.json` — publishable-вариант. ([docs.npmjs.com](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/ "package-lock.json | npm Docs"))

---

### 9.3 `npm-shrinkwrap.json`

Если файл есть, обновляется аналогично `package-lock.json`.

Но рекомендация: для этого пакета, пока runtime-зависимостей нет,  **не нужен `npm-shrinkwrap.json`** . npm-документация отдельно предупреждает, что `npm-shrinkwrap.json` publishable и обычно не рекомендуется для библиотек; допустимый кейс — приложения/CLI, но при нулевых зависимостях пользы почти нет. ([docs.npmjs.com](https://docs.npmjs.com/cli/v11/configuring-npm/npm-shrinkwrap-json/ "npm-shrinkwrap.json | npm Docs"))

---

## 10. Monorepo / workspaces

Поддержать, но осторожно.

Конфиг:

```json
{
  "schemaVersion": 1,
  "workspaces": {
    "mode": "root-only"
  },
  "targets": []
}
```

Режимы:

```text
root-only   -> меняется только корневой package.json
fixed       -> одна версия для root и всех workspace package.json
manual      -> workspaces задаются явно
off         -> workspaces игнорируются
```

Пример fixed-version monorepo:

```json
{
  "schemaVersion": 1,
  "workspaces": {
    "mode": "fixed"
  },
  "targets": []
}
```

Правила:

1. В MVP не поддерживать independent versioning.
2. Не менять версии зависимостей между workspace-пакетами.
3. Не пытаться понимать pnpm/yarn lockfile в MVP.
4. Для npm workspaces достаточно обновить package manifests и npm lockfile root-структуру.

---

## 11. CLI API

### 11.1 Общий формат

```bash
pvs <command> [args] [options]
```

### 11.2 Глобальные опции

```text
--config <path>       путь к конфигу, default pvs.config.json
--root <path>         корень проекта, default process.cwd()
--dry-run             не писать файлы
--json                машинно-читаемый вывод
--quiet               только ошибки
--verbose             подробный отчет
--no-lockfile         не менять lockfile
--no-git              не читать git metadata
--allow-dirty         разрешить работу при dirty git tree
--version             версия самого CLI
--help                помощь
```

---

### 11.3 `bump`

```bash
pvs bump patch
pvs bump minor
pvs bump major
pvs bump 2.0.0
pvs bump prerelease --preid rc
```

Опции:

```text
--preid <id>          rc, beta, alpha
--commit              создать git commit
--tag                 создать git tag
--tag-prefix <value>  default "v"
--message <value>     commit message, default "chore: release v$version"
```

По умолчанию `commit` и `tag` выключены.

Причина: CLI не должен неожиданно менять Git-историю.

---

### 11.4 `sync`

```bash
pvs sync
```

Опции:

```text
--dry-run
--json
--no-git
```

---

### 11.5 `check`

```bash
pvs check
```

Exit codes:

```text
0 -> все синхронизировано
1 -> найден mismatch
2 -> ошибка конфигурации
3 -> ошибка файловой системы
4 -> invalid semver
5 -> unsafe path
```

---

## 12. Алгоритм `pvs bump`

Псевдопроцесс:

```text
1. Resolve root.
2. Load pvs.config.json.
3. Validate config.
4. Read package.json.
5. Parse current version.
6. Compute next version.
7. Build mutation plan:
   - package.json
   - package-lock.json, if present
   - npm-shrinkwrap.json, if present
   - configured targets
8. Read all target files.
9. Apply replacements in memory.
10. Validate that each target changed exactly as expected.
11. If --dry-run:
    - print plan
    - exit 0
12. Write files atomically:
    - write temp file
    - fsync if supported/configured
    - rename temp to final
13. Re-read and verify.
14. Optional git commit/tag.
15. Print summary.
```

Node’s built-in `node:fs` module provides promise-based and synchronous filesystem APIs, so для такого CLI не нужны `fs-extra`, `rimraf`, `mkdirp` и похожие зависимости. ([Node.js](https://nodejs.org/api/fs.html "File system | Node.js v26.3.1 Documentation"))

---

## 13. SemVer-логика

Поддерживаемые входы:

```text
patch
minor
major
prepatch
preminor
premajor
prerelease
1.2.3
1.2.3-rc.1
1.2.3+build.5
```

Правила:

```text
1.2.3 + patch -> 1.2.4
1.2.3 + minor -> 1.3.0
1.2.3 + major -> 2.0.0

1.2.3 + prepatch --preid rc -> 1.2.4-rc.0
1.2.3 + preminor --preid rc -> 1.3.0-rc.0
1.2.3 + premajor --preid rc -> 2.0.0-rc.0
1.2.3-rc.0 + prerelease -> 1.2.3-rc.1
```

Запрещено:

```text
1
1.2
01.2.3
1.02.3
1.2.03
v1.2.3 в package.json.version
```

`v` допустим только в git tag, не в `package.json.version`.

---

## 14. Безопасность

### 14.1 Runtime dependencies

В `package.json` самого пакета:

```json
{
  "dependencies": {}
}
```

Dev dependencies тоже можно держать пустыми, если использовать:

```bash
node --test
```

и писать код на plain JS с JSDoc/types вручную.

---

### 14.2 Не использовать install scripts

В пакете не должно быть:

```json
{
  "scripts": {
    "preinstall": "...",
    "install": "...",
    "postinstall": "..."
  }
}
```

Пакет не должен выполнять код при установке.

---

### 14.3 Только JSON-конфиг

Запрещено:

```text
pvs.config.js
pvs.config.mjs
pvs.config.ts
```

Разрешено:

```text
pvs.config.json
```

---

### 14.4 Защита путей

Каждый target path нормализуется и проверяется:

```text
resolvedTarget.startsWith(projectRoot)
```

Запрещены:

```text
../outside.txt
/absolute/path/outside.txt
C:\outside.txt
symlink outside root
```

Для symlink:

1. Если target — symlink, по умолчанию ошибка.
2. Разрешить можно только явно:

```json
{
  "allowSymlinks": true
}
```

---

### 14.5 Ограничение размера файлов

По умолчанию:

```json
{
  "limits": {
    "maxFileSizeBytes": 2097152
  }
}
```

То есть 2 MB на один target.

Причина: пользовательский regex на огромном файле может стать DoS-фактором.

---

### 14.6 Нет сетевых запросов

Пакет не должен использовать:

```text
http
https
fetch
net
tls
dns
```

Исключений в MVP нет.

---

### 14.7 Нет shell-команд по умолчанию

Git metadata можно получать через `child_process.spawn("git", ...)`, но только для:

```text
git rev-parse --short HEAD
git status --porcelain
git add
git commit
git tag
```

И только если пользователь включил git-функцию.

---

## 15. Производительность

Требования:

```text
Cold start: < 80 ms на обычном проекте
Runtime deps: 0
Default scanned files: 0
Default modified files: только package.json + явно заданные targets
node_modules: никогда не сканировать
.git: никогда не сканировать
dist/build: не сканировать без явного target
```

Пакет должен работать через явный список файлов, а не через сканирование всего проекта.

Плохой дизайн:

```json
{
  "include": ["**/*"]
}
```

Хороший дизайн:

```json
{
  "targets": [
    { "file": "src/version.ts", "type": "generated", "template": "..." },
    { "file": "public/version.json", "type": "json", "values": { "version": "$version" } }
  ]
}
```

---

## 16. Структура пакета

```text
pvs/
  bin/
    pvs.js
  src/
    cli.js
    commands/
      bump.js
      sync.js
      check.js
      current.js
      init.js
    core/
      config.js
      semver.js
      manifest.js
      lockfile.js
      targets.js
      template.js
      writer.js
      git.js
      errors.js
    index.js
    index.d.ts
  schema/
    pvs.schema.json
  test/
    semver.test.js
    config.test.js
    marker-target.test.js
    replace-target.test.js
    json-target.test.js
    manifest.test.js
    lockfile.test.js
    cli.test.js
  README.md
  LICENSE
  package.json
```

---

## 17. `package.json` самого npm-пакета

```json
{
  "name": "@your-scope/pvs",
  "version": "0.1.0",
  "description": "Zero-dependency CLI for syncing project version across package manifests and configured files.",
  "type": "module",
  "bin": {
    "pvs": "./bin/pvs.js"
  },
  "exports": {
    ".": {
      "types": "./src/index.d.ts",
      "default": "./src/index.js"
    }
  },
  "files": [
    "bin",
    "src",
    "schema",
    "README.md",
    "LICENSE"
  ],
  "sideEffects": false,
  "engines": {
    "node": ">=20.11"
  },
  "dependencies": {},
  "devDependencies": {},
  "scripts": {
    "test": "node --test",
    "check": "node --check bin/pvs.js && node --test",
    "pack:dry": "npm pack --dry-run"
  },
  "keywords": [
    "version",
    "semver",
    "release",
    "cli",
    "zero-dependency"
  ],
  "license": "MIT"
}
```

Для новых Node-пакетов стоит явно указывать `"type"` и использовать `"exports"` для определения публичного API; Node.js документация указывает, что `"exports"` является рекомендуемым entry-point механизмом для новых пакетов и ограничивает доступные subpath imports. ([Node.js](https://nodejs.org/api/packages.html "Modules: Packages | Node.js v26.3.1 Documentation"))

---

## 18. `bin/pvs.js`

Требования:

```js
#!/usr/bin/env node
import { runCli } from "../src/cli.js";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error.message || String(error));
  process.exit(error.exitCode || 1);
});
```

Файл должен быть executable в git:

```bash
chmod +x bin/pvs.js
```

---

## 19. Внутренний API

Минимальный публичный API:

```ts
export interface BumpOptions {
  root?: string;
  config?: string;
  dryRun?: boolean;
  json?: boolean;
  preid?: string;
}

export interface SyncOptions {
  root?: string;
  config?: string;
  dryRun?: boolean;
  json?: boolean;
}

export interface BumpResult {
  oldVersion: string;
  newVersion: string;
  changedFiles: string[];
}

export function bump(
  release: string,
  options?: BumpOptions
): Promise<BumpResult>;

export function sync(options?: SyncOptions): Promise<BumpResult>;

export function check(options?: SyncOptions): Promise<void>;

export function parseVersion(version: string): Semver;
export function incrementVersion(version: string, release: string, preid?: string): string;
```

---

## 20. Ошибки

Все ошибки должны иметь стабильный `code`.

```text
PVS_CONFIG_NOT_FOUND
PVS_CONFIG_INVALID
PVS_PACKAGE_NOT_FOUND
PVS_VERSION_INVALID
PVS_TARGET_NOT_FOUND
PVS_TARGET_NO_MATCH
PVS_TARGET_MULTI_MATCH
PVS_UNSAFE_PATH
PVS_FILE_TOO_LARGE
PVS_BINARY_FILE
PVS_LOCKFILE_INVALID
PVS_GIT_DIRTY
PVS_WRITE_FAILED
```

JSON-ошибка:

```json
{
  "ok": false,
  "code": "PVS_TARGET_NO_MATCH",
  "message": "No marker block 'app-version' found in src/version.ts",
  "file": "src/version.ts"
}
```

---

## 21. Тестовая стратегия

Использовать только встроенный Node test runner.

Тесты:

```text
semver.test.js
- parses 1.2.3
- rejects 1.2
- rejects 01.2.3
- patch/minor/major
- prerelease increment

config.test.js
- loads pvs.config.json
- rejects unknown schemaVersion
- rejects unsafe path

marker-target.test.js
- updates marker block
- fails on missing marker
- fails on duplicate marker

replace-target.test.js
- updates one match
- fails on zero matches
- fails on multiple matches unless multiple=true

json-target.test.js
- updates nested value
- preserves indentation
- fails on invalid JSON

manifest.test.js
- updates package.json version
- preserves newline

lockfile.test.js
- updates root version
- updates packages[""].version
- fails on invalid lockfile

cli.test.js
- pvs current
- pvs bump patch --dry-run
- pvs sync --json
- exit codes
```

---

## 22. Пример использования в реальном проекте

### `package.json` проекта

```json
{
  "name": "my-site",
  "version": "1.4.1",
  "scripts": {
    "version:patch": "pvs bump patch",
    "version:minor": "pvs bump minor",
    "version:major": "pvs bump major",
    "version:check": "pvs check"
  },
  "devDependencies": {
    "@your-scope/pvs": "^0.1.0"
  }
}
```

### `pvs.config.json`

```json
{
  "schemaVersion": 1,
  "targets": [
    {
      "file": "src/generated/version.ts",
      "type": "generated",
      "template": "export const APP_VERSION = \"$version\";\n"
    },
    {
      "file": "public/version.json",
      "type": "json",
      "values": {
        "version": "$version",
        "major": "$major",
        "minor": "$minor",
        "patch": "$patch"
      }
    },
    {
      "file": "src/styles/version.css",
      "type": "marker",
      "id": "css-version",
      "template": "--app-version: \"$version\";"
    }
  ]
}
```

### Команда

```bash
npm run version:patch
```

Результат:

```text
pvs 0.1.0

Version:
  1.4.1 -> 1.4.2

Changed:
  package.json
  package-lock.json
  src/generated/version.ts
  public/version.json
  src/styles/version.css
```

---

## 23. Публикация самого пакета

Для scoped public package первая публикация:

```bash
npm publish --access public
```

npm-документация указывает, что scoped-пакеты по умолчанию публикуются как private, поэтому для public scoped package нужен `--access public`. ([docs.npmjs.com](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/ "Creating and publishing scoped public packages | npm Docs"))

Перед публикацией:

```bash
npm test
npm pack --dry-run
npm publish --access public
```

---

## 24. Рекомендуемый безопасный release-flow

Лучший вариант — GitHub Actions + npm trusted publishing, без long-lived npm token.

npm trusted publishing использует OIDC и устраняет необходимость в долгоживущих npm-токенах; по текущей документации для trusted publishing нужны npm CLI `11.5.1+` и Node.js `22.14.0+`. ([docs.npmjs.com](https://docs.npmjs.com/trusted-publishers/ "Trusted publishing for npm packages | npm Docs"))

Пример `.github/workflows/publish.yml`:

```yaml
name: publish

on:
  push:
    tags:
      - "v*"

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci
      - run: npm test
      - run: npm publish --access public
```

Если trusted publishing включен, npm provenance создается автоматически без `--provenance`; без trusted publishing для provenance в GitHub Actions используется `npm publish --provenance`. ([docs.npmjs.com](https://docs.npmjs.com/generating-provenance-statements/ "Generating provenance statements | npm Docs"))

---

## 25. Acceptance criteria для MVP

MVP считается готовым, если:

```text
1. npm install -D @your-scope/pvs работает.
2. Команда pvs доступна через npm scripts.
3. pvs bump patch меняет package.json.
4. pvs bump patch меняет package-lock.json, если он есть.
5. pvs sync обновляет marker/generated/json/replace targets.
6. pvs check возвращает exit code 1 при рассинхронизации.
7. pvs --dry-run не пишет файлы.
8. Пакет имеет 0 runtime dependencies.
9. npm pack --dry-run показывает только ожидаемые файлы.
10. Нет preinstall/install/postinstall scripts.
11. Все пути проверяются на выход за root.
12. Invalid SemVer приводит к ошибке.
13. Binary files не модифицируются.
14. Тесты проходят через node --test.
```

---

## 26. Что я бы не делал

Не стоит строить MVP вокруг пакетов:

```text
semver
commander
yargs
chalk
fast-glob
globby
fs-extra
execa
cosmiconfig
```

Они удобны, но сразу создают транзитивное дерево. Для такого CLI достаточно:

```text
node:fs
node:path
node:process
node:child_process
node:crypto
node:test
```

Также не стоит в MVP делать:

```bash
pvs bump auto
```

Пока нет строгой политики, что считать breaking change. Автоматический выбор `major/minor/patch` без проверяемых правил будет создавать ложную уверенность.

---

## 27. Итоговый дизайн

Оптимальный пакет:

```text
@your-scope/pvs
- zero runtime dependencies
- JSON-only config
- source of truth: package.json.version
- commands: bump, sync, check, current, init
- target types: marker, replace, json, generated
- no network
- no install scripts
- no default git mutations
- explicit files only
- safe path checks
- atomic writes
- Node built-ins only
- trusted publishing for release
```

Самая безопасная модель для сайта — не искать и заменять версию по всему проекту, а генерировать один файл:

```ts
export const APP_VERSION = "1.4.2";
```

и импортировать его там, где нужно. Для мест, где импорт невозможен, использовать marker-блоки.
