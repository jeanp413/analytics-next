/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Analytics } from '..'
import puppeteer from 'puppeteer'
import { SerializedContext } from '../core/context'
import mem from 'micro-memoize'

function makeStub(page: puppeteer.Page) {
  const stub = {
    async register(...args: Parameters<Analytics['register']>): Promise<void> {
      return await page.evaluate((...innerArgs) => {
        // @ts-ignore
        return window.analytics.register(...innerArgs)
        // @ts-ignore
      }, ...args)
    },
    async track(...args: Parameters<Analytics['track']>): Promise<SerializedContext> {
      const ctx = await page.evaluate((...innerArgs) => {
        // @ts-ignore
        return window.analytics.track(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, ...args)

      return ctx
    },
    async page(...args: Parameters<Analytics['page']>): Promise<SerializedContext> {
      const ctx = await page.evaluate(async (...innerArgs) => {
        // @ts-ignore
        return window.analytics.page(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, ...args)
      return ctx
    },

    async identify(...args: Parameters<Analytics['identify']>): Promise<SerializedContext> {
      const ctx = await page.evaluate((...innerArgs) => {
        // @ts-ignore
        return window.analytics.identify(...innerArgs).then((ctx) => {
          return ctx.toJSON()
        })
        // @ts-ignore
      }, ...args)

      return ctx
    },

    puppeteerPage: page,
  }

  return stub
}

const getBrowser = mem(async () => {
  const browser = await puppeteer.launch({ headless: true, devtools: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })

  process.on('unhandledRejection', () => {
    browser && browser.close()
  })

  return browser
})

export async function tester(_writeKey: string): Promise<ReturnType<typeof makeStub>> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  await page.goto(`file://${process.cwd()}/src/tester/__fixtures__/index.html`)
  await page.evaluate(`
    window.AnalyticsNext.Analytics.load({
      writeKey: '${_writeKey}',
    }).then(([ajs]) => {
      window.analytics = ajs
    })
  `)

  await page.waitForFunction('window.analytics !== undefined')
  return makeStub(page)
}
