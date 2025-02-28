import fs from 'fs/promises'
import fsold from 'fs'
import path from 'path'
import process from 'process'
import util from 'util'
import * as child from 'child_process'

const runInShell = util.promisify(child.exec)

import { parseFile } from 'music-metadata'
import { inspect } from 'util'

/**
 * Processing code IIFE.
 */
(async () => {

    /* quoted arg */
    Object.defineProperty(Array.prototype, 'pushQuoted', {
      value: function (arg) { this.push('"' + arg + '"') }
    })


    async function * walkr (dir) {
      for await (const d of await fs.opendir(dir)) {
        const entry = path.join(dir, d.name)
        if (d.isDirectory()) yield * walkr(entry)
        else if (d.isFile()) yield entry
      }
    }

    async function * walk (dir) {
      const savedCwd = process.cwd()
      process.chdir(dir)
      try {
        for await (const result of walkr('.')) {
          yield result
        }
      } finally {
        process.chdir(savedCwd)
      }
    }

    async function getMeta (pathname) {
      return await parseFile(pathname)
    }

    /* Build table of song names from .cda files where they are present. */
    async function extracted (dir) {
      const track2Name = new Map()

      for await (const p of walk(dir)) {
        if ('.cda' === path.extname(p)) {
          const q = p.substring(0, p.length - 4)
          const base = path.basename(q)
          const splits = base.split(/([- ])/)
          if (splits.length >= 3 && !Number.isNaN(parseInt(splits[0]))) {
            const key = path.join(path.dirname(p), splits.shift())
            splits.shift()
            const val = splits.join('')
            track2Name.set(key, val)
          }

        }
      }
      return track2Name
    }

    const dir = 'C:\\Users\\ollie\\Downloads\\Khalmyk Disc 1-\\Khalmyk Disc 1'

    const track2Name = await extracted(dir)

    const trackName = new RegExp('^[0-9]{1,2} Track [0-9]{1,2}.*')
    for await (const p of walk(dir)) {
      if ('.m4a' === path.extname(p)) {

        const meta = await getMeta(p)

        const q = p.substring(0, p.length - 4)
        const base = path.basename(q)
        let replacement = base
        let trackno = '??'
        let trackint = 0
        if (typeof meta.common.track.no === 'number') {
          trackint = meta.common.track.no
          trackno = meta.common.track.no.toString().padStart(2,'0')
        } else if (trackName.test(base)) {
          const splits = base.split(/ +/)
          trackint = Number.parseInt(splits[0])
          trackno = trackint.toString().padStart(2,'0')
        }

        if (typeof meta.common.title === 'string' && meta.common.title.length > 0) {
          replacement = meta.common.title
        } else if (trackName.test(base)) {

          const key = path.join(path.dirname(p), trackint.toString())
          if (track2Name.has(key)) {
            replacement = track2Name.get(key)
          } else {
            replacement = 'Unknown Title'
          }
        }
        replacement = trackno + ' ' + replacement

        const inpath = path.resolve(p)
        const outdir = path.resolve(path.join(path.dirname(p),'out'))
        fsold.existsSync(outdir) || fsold.mkdirSync(outdir)
        const outpath = path.resolve(path.join(path.dirname(p),'out', replacement + '.mp3'))


        fsold.existsSync(outpath) && fsold.rmSync(outpath)

        const command = []

        //ffmpeg -hide_banner -loglevel error -i 01\ Bitchken\ Nar_n\ Hulsen.m4a -f ffmetadata -

        command.push('ffmpeg -hide_banner -loglevel error')
        command.push('-i')
        command.pushQuoted(inpath)
        command.push('-b:a 80k')
        command.push('-ac 1')
        command.pushQuoted(outpath)

        try {
          const result = await runInShell(command.join(' '))
          const foo = result
        } catch (err) {
          const foo = err
        }
//        console.log (p, replacement, meta)
      }
    }

  }
)

()
