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

  it('exports the official compose variables required by LocalNet', () => {
    // Scenario: Docker Compose reads IMAGE_TAG and LocalNet paths from the
    // environment before resolving image names and bind mounts.
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
    // Scenario: Splice and wallet-service share one compose project so Docker
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
    // Scenario: Splice and wallet-service now share one compose project, so
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
      /COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "\$ROOT" up -d --build wallet-gateway wallet-service/,
    )
  })

  it('starts only the official wallet-gateway when gateway mode is wallet-gateway', () => {
    // Scenario: operators can expose the upstream wallet-gateway without the
    // development facade. The startup script should route this mode to the
    // wallet-gateway service and leave the devkit service out.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(upScript, /wallet-gateway\)\n {4}start_wallet_gateway\n {4};;/)
    assert.doesNotMatch(upScript, /wallet-gateway\)\n {4}start_wallet_gateway_devkit\n {4};;/)
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

  it('publishes wallet-gateway and the devkit facade on stable host ports', () => {
    // Scenario: local developers can target the official gateway directly on
    // 3010 or use the devkit facade on 3011 for helper RPCs.
    const composeFile = execFileSync('cat', [path.join(projectRoot, 'docker-compose.yaml')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    const walletGatewayBlock = composeFile.split('\n  wallet-service:')[0] ?? ''

    assert.match(walletGatewayBlock, /wallet-gateway:/)
    assert.match(walletGatewayBlock, /ports:\n {6}- "3010:3030"/)
    assert.match(composeFile, /ports:\n {6}- "3011:3010"/)
    assert.match(composeFile, /WALLET_GATEWAY_UPSTREAM_URL: "http:\/\/wallet-gateway:3030"/)
  })

  it('passes Docker-reachable Splice URLs into wallet-service', () => {
    // Scenario: wallet-service runs inside its own container, so URLs that are
    // valid in a browser, such as localhost, would point back to wallet-service.
    // The compose config must inject host.docker.internal URLs so SDK helpers
    // can reach the LocalNet nginx routes from inside Docker.
    const composeFile = execFileSync('cat', [path.join(projectRoot, 'docker-compose.yaml')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(
      composeFile,
      /SPLICE_VALIDATOR_URL: "\$\{SPLICE_VALIDATOR_URL:-http:\/\/host\.docker\.internal:2000\/api\/validator\}"/,
    )
    assert.match(
      composeFile,
      /SPLICE_SCAN_API_URL: "\$\{SPLICE_SCAN_API_URL:-http:\/\/host\.docker\.internal:4000\/api\/scan\}"/,
    )
    assert.match(
      composeFile,
      /SPLICE_REGISTRY_API_URL: "\$\{SPLICE_REGISTRY_API_URL:-http:\/\/host\.docker\.internal:2000\/api\/validator\/v0\/scan-proxy\}"/,
    )
  })
})
