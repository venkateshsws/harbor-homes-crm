
import readline from 'node:readline'
import { stdin, stdout } from 'node:process'
import { connectDB, disconnectDB, redactUri } from '../src/config/db.js'
import { hashPassword, passwordProblem } from '../src/lib/password.js'
import { User } from '../src/models/User.js'

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
  terminal: stdin.isTTY,
})

const lines = rl[Symbol.asyncIterator]()
let muted = false
const writeToOutput = rl._writeToOutput.bind(rl)

rl._writeToOutput = (text) => {
  if (!muted) writeToOutput(text)
}

async function ask(question, { hidden = false } = {}) {
  stdout.write(question)
  muted = hidden

  const { value, done } = await lines.next()
  muted = false

  if (hidden) stdout.write('\n')
  if (done) throw new Error('Input ended before all details were entered.')

  return hidden ? value : value.trim()
}

async function main() {
  await connectDB()
  await User.init()

  console.log('\nCreate a Yahoo CRM Super Admin account.\n')

  const full_name = await ask('Full name: ')
  const email = (await ask('Email: ')).toLowerCase()
  const employee_code = (
    (await ask('Employee ID [SA001]: ')) || 'SA001'
  ).toUpperCase()
  const phone = (await ask('Phone (optional): ')) || null

  if (!full_name || !email) {
    throw new Error('Full name and email are required.')
  }

  const existing = await User.findOne({
    $or: [{ email }, { employee_code }],
  }).lean()

  if (existing) {
    throw new Error(
      'An account with that email or employee ID already exists. Nothing was changed.',
    )
  }

  const password = await ask('Password (hidden): ', { hidden: true })
  const problem = passwordProblem(password)

  if (problem) throw new Error(problem)

  const confirmation = await ask('Confirm password (hidden): ', {
    hidden: true,
  })

  if (confirmation !== password) {
    throw new Error('Passwords do not match.')
  }

  const user = await User.create({
    full_name,
    email,
    employee_code,
    phone,
    role: 'super_admin',
    is_assignment_eligible: false,
    is_active: true,
    password_hash: await hashPassword(password),
  })

  console.log(
    `\nSUCCESS: Super Admin created (${user.email}, employee ID ${user.employee_code}).`,
  )
  console.log('You can now log in using this email or employee ID.')
}

try {
  await main()
  process.exitCode = 0
} catch (err) {
  const message =
    err?.code === 11000
      ? 'An account with that email or employee ID already exists.'
      : redactUri(err?.message)

  console.error(`\nFAILED: ${message}`)
  process.exitCode = 1
} finally {
  rl.close()
  await disconnectDB().catch(() => {})
}
