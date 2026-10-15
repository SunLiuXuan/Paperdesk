$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'releases'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$staging = Join-Path $releaseRoot "paperdesk-source-$stamp"
New-Item -ItemType Directory -Path $staging -Force | Out-Null
# Explicit allowlist: never include .env, data, .git or local deployment metadata.
$items = @('README.md', 'THIRD_PARTY_NOTICES.md', '.env.example', '.gitignore',
  '.gitattributes', 'package.json', 'start.cmd', 'server.mjs', 'storage.mjs', 'metadata.mjs',
  'Paperdesk.html', 'dist', 'docs', 'prompts', 'scripts', 'tests')
foreach ($item in $items) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $item) -Destination $staging -Recurse
}
$zip = "$staging.zip"
Compress-Archive -LiteralPath $staging -DestinationPath $zip
Write-Output "Source folder: $staging"
Write-Output "Source archive: $zip"

