// This test utility runs the JSON-specified tests in build/test/test.json.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deepEqual, fail, AssertionError } from 'node:assert'


// Runner does make use of these struct utilities, and this usage is
// circular. This is a trade-off tp make the runner code simpler.
import {
  clone,
  getpath,
  inject,
  items,
  stringify,
  walk,
} from '../dist/struct'


const NULLMARK = '__NULL__'


class Client {

  #opts: Record<string, any>
  #utility: Record<string, any>

  constructor(opts?: Record<string, any>) {
    this.#opts = opts || {}
    this.#utility = {
      struct: {
        clone,
        getpath,
        inject,
        items,
        stringify,
        walk,
      },
      check: (ctx: any): any => {
        return {
          zed: 'ZED' +
            (null == this.#opts ? '' : null == this.#opts.foo ? '' : this.#opts.foo) +
            '_' +
            (null == ctx.bar ? '0' : ctx.bar)
        }
      }
    }
  }

  static async test(opts?: Record<string, any>): Promise<Client> {
    return new Client(opts)
  }

  utility() {
    return this.#utility
  }
}


type Subject = (...args: any[]) => any
type RunSet = (testspec: any, testsubject: Function) => Promise<any>
type RunSetFlags = (testspec: any, flags: Record<string, boolean>, testsubject: Function)
  => Promise<any>

type RunPack = {
  spec: Record<string, any>
  runset: RunSet
  runsetflags: RunSetFlags
  subject: Subject
}

type TestPack = {
  client: Client
  subject: Subject
  utility: ReturnType<Client['utility']>
}

type Flags = Record<string, boolean>


async function runner(
  name: string,
  store: any,
  testfile: string
): Promise<RunPack> {

  const client = await Client.test()
  const utility = client.utility()
  const structUtils = utility.struct

  let spec = resolveSpec(name, testfile)
  let clients = await resolveClients(spec, store, structUtils)
  let subject = resolveSubject(name, utility)

  let runsetflags: RunSetFlags = async (
    testspec: any,
    flags: Flags,
    testsubject: Function
  ) => {
    subject = testsubject || subject
    flags = resolveFlags(flags)
    const testspecmap = fixJSON(testspec, flags)

    const testset: any[] = testspecmap.set
    for (let entry of testset) {
      try {
        entry = resolveEntry(entry, flags)

        let testpack = resolveTestPack(name, entry, subject, client, clients)
        let args = resolveArgs(entry, testpack)

        let res = await testpack.subject(...args)
        res = fixJSON(res, flags)
        entry.res = res

        checkResult(entry, res, structUtils)
      }
      catch (err: any) {
        handleError(entry, err, structUtils)
      }
    }
  }

  let runset: RunSet = async (
    testspec: any,
    testsubject: Function
  ) => runsetflags(testspec, {}, testsubject)

  const runpack: RunPack = {
    spec,
    runset,
    runsetflags,
    subject,
  }

  return runpack
}


function resolveSpec(name: string, testfile: string): Record<string, any> {
  const alltests =
    JSON.parse(readFileSync(join(
      __dirname, testfile), 'utf8'))

  let spec = alltests.primary?.[name] || alltests[name] || alltests
  return spec
}


async function resolveClients(
  spec: Record<string, any>,
  store: any,
  structUtils: Record<string, any>
):
  Promise<Record<string, Client>> {

  const clients: Record<string, Client> = {}
  if (spec.DEF && spec.DEF.client) {
    for (let cn in spec.DEF.client) {
      const cdef = spec.DEF.client[cn]
      const copts = cdef.test.options || {}
      if ('object' === typeof store && structUtils?.inject) {
        structUtils.inject(copts, store)
      }

      clients[cn] = await Client.test(copts)
    }
  }
  return clients
}


function resolveSubject(name: string, container: any) {
  return container?.[name]
}


function resolveFlags(flags?: Flags): Flags {
  if (null == flags) {
    flags = {}
  }
  flags.null = null == flags.null ? true : !!flags.null
  return flags
}


function resolveEntry(entry: any, flags: Flags): any {
  entry.out = null == entry.out && flags.null ? NULLMARK : entry.out
  return entry
}


function checkResult(entry: any, res: any, structUtils: Record<string, any>) {
  if (undefined === entry.match || undefined !== entry.out) {
    // NOTE: don't use clone as we want to strip functions
    deepEqual(null != res ? JSON.parse(JSON.stringify(res)) : res, entry.out)
  }

  if (entry.match) {
    match(
      entry.match,
      { in: entry.in, out: entry.res, ctx: entry.ctx },
      structUtils
    )
  }
}


// Handle errors from test execution
function handleError(entry: any, err: any, structUtils: Record<string, any>) {
  entry.thrown = err

  const entry_err = entry.err

  if (null != entry_err) {
    if (true === entry_err || matchval(entry_err, err.message, structUtils)) {
      if (entry.match) {
        match(
          entry.match,
          { in: entry.in, out: entry.res, ctx: entry.ctx, err },
          structUtils
        )
      }
      return
    }

    fail('ERROR MATCH: [' + structUtils.stringify(entry_err) +
      '] <=> [' + err.message + ']')
  }
  // Unexpected error (test didn't specify an error expectation)
  else if (err instanceof AssertionError) {
    fail(err.message + '\n\nENTRY: ' + JSON.stringify(entry, null, 2))
  }
  else {
    fail(err.stack + '\\nnENTRY: ' + JSON.stringify(entry, null, 2))
  }
}


function resolveArgs(entry: any, testpack: TestPack): any[] {
  let args = [clone(entry.in)]

  if (entry.ctx) {
    args = [entry.ctx]
  }
  else if (entry.args) {
    args = entry.args
  }

  if (entry.ctx || entry.args) {
    let first = args[0]
    if ('object' === typeof first && null != first) {
      entry.ctx = first = args[0] = clone(args[0])
      first.client = testpack.client
      first.utility = testpack.utility
    }
  }

  return args
}


function resolveTestPack(
  name: string,
  entry: any,
  subject: Subject,
  client: Client,
  clients: Record<string, Client>
) {
  const testpack: TestPack = {
    client,
    subject,
    utility: client.utility(),
  }

  if (entry.client) {
    testpack.client = clients[entry.client]
    testpack.utility = testpack.client.utility()
    testpack.subject = resolveSubject(name, testpack.utility)
  }

  return testpack
}


function match(
  check: any,
  base: any,
  structUtils: Record<string, any>
) {
  structUtils.walk(check, (_key: any, val: any, _parent: any, path: any) => {
    let scalar = 'object' != typeof val
    if (scalar) {
      let baseval = structUtils.getpath(path, base)

      if (!matchval(val, baseval, structUtils)) {
        fail('MATCH: ' + path.join('.') +
          ': [' + structUtils.stringify(val) +
          '] <=> [' + structUtils.stringify(baseval) + ']')
      }
    }
  })
}


function matchval(
  check: any,
  base: any,
  structUtils: Record<string, any>
) {
  check = NULLMARK === check ? undefined : check

  let pass = check === base

  if (!pass) {

    if ('string' === typeof check) {
      let basestr = structUtils.stringify(base)

      let rem = check.match(/^\/(.+)\/$/)
      if (rem) {
        pass = new RegExp(rem[1]).test(basestr)
      }
      else {
        pass = basestr.toLowerCase().includes(structUtils.stringify(check).toLowerCase())
      }
    }
    else if ('function' === typeof check) {
      pass = true
    }
  }

  return pass
}


function fixJSON(val: any, flags: Flags): any {
  if (null == val) {
    return flags.null ? NULLMARK : val
  }

  const replacer: any = (_k: any, v: any) => null == v && flags.null ? NULLMARK : v
  return JSON.parse(JSON.stringify(val, replacer))
}


function nullModifier(
  val: any,
  key: any,
  parent: any
) {
  if ("__NULL__" === val) {
    parent[key] = null
  }
  else if ('string' === typeof val) {
    parent[key] = val.replaceAll('__NULL__', 'null')
  }
}


export {
  NULLMARK,
  nullModifier,
  runner,
  Client,
}

