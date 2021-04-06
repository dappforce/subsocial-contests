// In order to have a fair random selection of the winners, we decided to take a hash of a block
// that was created at the end of this contest  on 2021-04-04 05:00:00 UTC+0.
// In this case it is a block # 3419517 with a hash
// 0x8b78fea9ac95c604174b7efbd9bf59e5113b022ae2f1c52d694f98100b074172.
// 
// You can see this block on Subsocial's blockchain explorer:
// https://subsocial.polkastats.io/block?blockNumber=3419517
// 
// We use this block hash as a seed for Xorshift - a random number generator that is used to 
// randomly select winners among all valid results of this contest. Read more about Xorshift on
// Wikipedia: https://en.wikipedia.org/wiki/Xorshift

const XorShift = require('xorshift.js').XorShift1024Star
const { readFileSync, writeFileSync } = require('fs')
const { GenericAccountId } = require('@polkadot/types')
const registry = require('@subsocial/types/substrate/registry')

const dataDir = __dirname + '/data'
const resultsFilePath = `${dataDir}/all-results.csv`
const validAccountsFilePath = `${dataDir}/valid-accounts.csv`
const shuffledResultsFilePath = `${dataDir}/shuffled-results.json`
const shuffledAccountsFilePath = `${dataDir}/shuffled-accounts.csv`

const BLOCK_HASH = '0x8b78fea9ac95c604174b7efbd9bf59e5113b022ae2f1c52d694f98100b074172'
const MIN_REQUIRED_POINTS = 65

const isAccountAddress = (address) => {
  try {
    new GenericAccountId(registry, address)
    return true
  } catch {
    return false
  }
}

const hexToByteArray = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g)
    .map(byte => parseInt(byte, 16)));

const parseValidResults = () => {
  const csvText = readFileSync(resultsFilePath, { encoding: 'utf-8' })
  const [ _header, ...resultLines ] = csvText.split('\r\n')

  let parsedLines = []
  resultLines.map((line) => {
    const [ _points, _twitter, _maybeAccount ] = line.split(',')

    const points = parseInt(_points)
    const twitter = _twitter.replace('@', '')
    const accountId = _maybeAccount.split('/').pop()

    if (points >= MIN_REQUIRED_POINTS && isAccountAddress(accountId)) {
      parsedLines.push({ points, twitter, accountId })
    }
  })

  return parsedLines
}

const main = () => {
  const blockHash = BLOCK_HASH
  console.log('Block hash:', blockHash)

  const seedBytes = hexToByteArray(blockHash.replace('0x', ''))
  console.log(`Seed bytes (${seedBytes.length}):`, seedBytes)

  const prng = new XorShift(seedBytes)

  const candidates = parseValidResults()

  writeFileSync(validAccountsFilePath, JSON.stringify(candidates, null, 2))

  let generatedNumbers = []
  let numbersModulo = []
  let randomWinners = []
  const uniqueNums = new Set()

  while (uniqueNums.size < 660) {
    const randNum = prng.randomInt64()[0]
    const modNum = randNum % candidates.length

    if (uniqueNums.has(modNum)) {
      continue
    }

    uniqueNums.add(modNum) 
    generatedNumbers.push(randNum)
    numbersModulo.push(modNum)
    randomWinners.push(candidates[modNum])
  }

  console.log('Unique nums:', uniqueNums.size)
  console.log('Total filtered list length:', candidates.length)
  console.log('Generated numbers:', generatedNumbers)
  console.log('Numbers modulo list length:', numbersModulo)

  // Just Substrate accounts:
  writeFileSync(
    shuffledAccountsFilePath,
    randomWinners.map(x => x.accountId).join('\n')
  )

  writeFileSync(
    shuffledResultsFilePath,
    JSON.stringify(
      {
        blockHash: blockHash,
        randomNumbers: generatedNumbers,
        randomWinners,
      },
      null,
      2
    )
  )
  console.log(`Winners list is written to file '${shuffledResultsFilePath}'`)
}

main()
