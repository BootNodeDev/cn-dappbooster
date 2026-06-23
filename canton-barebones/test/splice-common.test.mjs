import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const commonScript = path.join(projectRoot, 'scripts/splice-common.sh')

describe('Splice LocalNet shell config', () => {
  it('starts only the sv and app-user LocalNet profiles', () => {
    // Scenario: this stack activates only the app-user and SV UI profiles.
    // The official shared backend containers still expose app-provider ports.
    const output = execFileSync(
      'bash',
      ['-lc', `source "${commonScript}"; printf '%s\\n' "\${SPLICE_PROFILES[@]}"`],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    assert.deepEqual(output.trim().split('\n'), ['sv', 'app-user'])
  })

  it('loads Splice settings from the service env file', () => {
    // Scenario: Docker Compose reads IMAGE_TAG and LocalNet paths from the
    // Splice service env file before resolving image names and bind mounts.
    const output = execFileSync(
      'bash',
      [
        '-lc',
        `source "${commonScript}"; printf '%s\\n' "$IMAGE_TAG" "$LOCALNET_DIR" "$LOCALNET_ENV_DIR"`,
      ],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    assert.deepEqual(output.trim().split('\n'), [
      '0.5.18',
      '/tmp/splice-localnet-test/splice-node/docker-compose/localnet',
      '/tmp/splice-localnet-test/splice-node/docker-compose/localnet/env',
    ])
  })

  it('uses the canton-barebones compose project and the local nginx override', () => {
    // Scenario: Splice and wallet-gateway-devkit share one compose project so Docker
    // groups all local stack containers under canton-barebones. The local
    // nginx override still disables app-provider UI routes when that profile is off.
    const output = execFileSync(
      'bash',
      ['-lc', `docker() { printf '%s\\n' "$@"; }; source "${commonScript}"; splice_compose config`],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    const args = output.trim().split('\n')

    assert.match(output, /--project-name\ncanton-barebones/)
    assert.ok(args.includes(path.join(projectRoot, 'config/splice/localnet-overrides.yaml')))
  })

  it('starts Splice without removing other services from the shared project', () => {
    // Scenario: Splice and wallet-gateway-devkit now share one compose project, so
    // Splice startup must not ask Compose to remove services missing from the
    // official Splice compose files.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.doesNotMatch(upScript, /--remove-orphans/)
    assert.match(upScript, /COMPOSE_IGNORE_ORPHANS=true splice_compose up -d/)
  })

  it('starts the devkit facade without warning about Splice orphan services', () => {
    // Scenario: devkit mode uses a small local compose file while Splice uses
    // the official compose files. Both share one project, so the facade startup
    // command must explicitly ignore expected orphans.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(
      upScript,
      /COMPOSE_IGNORE_ORPHANS=true wallet_gateway_devkit_compose up -d --build wallet-gateway wallet-gateway-devkit/,
    )
  })

  it('starts only the official wallet-gateway when gateway mode is wallet-gateway', () => {
    // Scenario: operators can expose the upstream wallet-gateway without the
    // development facade. The startup script should route this mode to the
    // wallet-gateway compose files and leave the devkit service out.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(upScript, /wallet-gateway\)\n {4}start_wallet_gateway\n {4};;/)
    assert.doesNotMatch(upScript, /wallet-gateway\)\n {4}start_wallet_gateway_devkit\n {4};;/)
    assert.doesNotMatch(upScript, /docker-compose\.wallet-gateway-public\.yaml/)
  })

  it('starts wallet-gateway plus the devkit facade when gateway mode is wallet-gateway-devkit', () => {
    // Scenario: devkit mode must still start the upstream wallet-gateway
    // because the facade only owns /devkit and forwards standard gateway
    // traffic to the official service.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(upScript, /wallet-gateway-devkit\)\n.*start_wallet_gateway_devkit/s)
  })

  it('can skip Splice LocalNet when services point to external infrastructure', () => {
    // Scenario: devs can point wallet-gateway and devkit to an external
    // Splice stack. The startup script should expose a no-splice mode instead
    // of forcing the LocalNet bundle and official Splice compose files.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(upScript, /--no-splice/)
    assert.match(upScript, /--splice \| --with-splice/)
    assert.match(upScript, /WITH_SPLICE=0/)
    assert.match(upScript, /if \[ "\$WITH_SPLICE" = "1" \]/)
  })

  it('documents the single root canton:up command surface', () => {
    // Scenario: the root package exposes one canton:up script. The underlying
    // stack script should explain flags and gateway modes without requiring
    // users to inspect bash control flow.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(upScript, /Usage: npm run canton:up --/)
    assert.match(upScript, /--splice\|--no-splice/)
    assert.match(upScript, /wallet-gateway\|wallet-gateway-devkit/)
    assert.match(upScript, /-h \| --help/)
  })

  it('publishes wallet-gateway and wallet-gateway-devkit through service env files', () => {
    // Scenario: users of this stack should always be able to reach the
    // official wallet-gateway on 3010, while devkit gets a separate public
    // port. The defaults live in service env files, not environment JSON.
    const composeFile = execFileSync('cat', [path.join(projectRoot, 'docker-compose.yaml')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    const walletGatewayBlock = composeFile.split('\n  wallet-gateway-devkit:')[0] ?? ''

    assert.match(walletGatewayBlock, /wallet-gateway:/)
    assert.match(walletGatewayBlock, /env_file:\n {6}- \.\/env\/\.env\.wallet-gateway/)
    assert.match(
      walletGatewayBlock,
      /\$\{WALLET_GATEWAY_CONFIG:-\.\/config\/wallet-gateway\/config\.json\}:\/config\/wallet-gateway\.json:ro/,
    )
    assert.match(walletGatewayBlock, /\$\{WALLET_GATEWAY_PORT:-3010\}:3030/)
    assert.match(composeFile, /env_file:\n {6}- \.\/env\/\.env\.wallet-gateway-devkit/)
    assert.match(composeFile, /\$\{WALLET_GATEWAY_DEVKIT_PORT:-3011\}:3010/)
  })

  it('checks gateway health through the service port env files', () => {
    // Scenario: gateway port overrides live in service env files. Health
    // checks must read the same files instead of hardcoding public ports.
    const healthScript = execFileSync('cat', [path.join(projectRoot, 'scripts/health-check.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(healthScript, /load_env_file "\$ROOT\/env\/\.env\.wallet-gateway"/)
    assert.match(healthScript, /load_env_file "\$ROOT\/env\/\.env\.wallet-gateway-devkit"/)
    assert.match(healthScript, /http:\/\/localhost:\$\{WALLET_GATEWAY_PORT:-3010\}\/readyz/)
    assert.match(healthScript, /http:\/\/localhost:\$\{WALLET_GATEWAY_DEVKIT_PORT:-3011\}\/health/)
  })

  it('keeps wallet-gateway-devkit compose environment minimal', () => {
    // Scenario: devkit reads direct service env values. Docker should not
    // select an environment name or mount a monolithic root .env file.
    const composeFile = execFileSync('cat', [path.join(projectRoot, 'docker-compose.yaml')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.doesNotMatch(composeFile, /CANTON_ENVIRONMENT/)
    assert.doesNotMatch(composeFile, /config\/environments/)
    assert.doesNotMatch(composeFile, /source: \.\/\.env/)
  })
})
